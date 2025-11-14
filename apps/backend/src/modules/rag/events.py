from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, Optional

import redis
from redis.asyncio import Redis as AsyncRedis

from apps.backend.src.core.config import settings

logger = logging.getLogger(__name__)

GRAPH_RAG_CHANNEL = "graph_rag.suggestions"

_PUBLISHERS: Dict[str, redis.Redis] = {}
_ASYNC_CLIENTS: Dict[str, AsyncRedis] = {}


def _get_redis_url() -> str:
    return settings.CELERY_BROKER_URL


def _publisher(url: Optional[str] = None) -> redis.Redis:
    key = url or _get_redis_url()
    if key not in _PUBLISHERS:
        _PUBLISHERS[key] = redis.Redis.from_url(key, decode_responses=True)
    return _PUBLISHERS[key]


def _async_client(url: Optional[str] = None) -> AsyncRedis:
    key = url or _get_redis_url()
    if key not in _ASYNC_CLIENTS:
        _ASYNC_CLIENTS[key] = AsyncRedis.from_url(key, decode_responses=True)
    return _ASYNC_CLIENTS[key]


def _ensure_utc(ts: datetime) -> datetime:
    if ts.tzinfo is None:
        return ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(timezone.utc)


@dataclass(slots=True)
class GraphRagRefreshEvent:
    trigger: str
    persona_id: Optional[int] = None
    campaign_id: Optional[int] = None
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    meta: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        obj = asdict(self)
        obj["updated_at"] = _ensure_utc(self.updated_at).isoformat()
        return obj


def publish_graph_rag_refresh(
    event: GraphRagRefreshEvent,
    *,
    channel: str = GRAPH_RAG_CHANNEL,
) -> None:
    try:
        payload = json.dumps(event.to_dict(), ensure_ascii=False)
        _publisher().publish(channel, payload)
    except Exception:  # pragma: no cover - defensive logging
        logger.exception("Failed to publish Graph RAG refresh event", extra={"event": event.to_dict()})


@asynccontextmanager
async def stream_graph_rag_refresh(
    *,
    channel: str = GRAPH_RAG_CHANNEL,
) -> AsyncIterator[AsyncIterator[str]]:
    client = _async_client()
    pubsub = client.pubsub()
    await pubsub.subscribe(channel)

    async def _iterator() -> AsyncIterator[str]:
        try:
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if not message:
                    await asyncio.sleep(0)
                    continue
                if message.get("type") != "message":
                    continue
                data = message.get("data")
                if isinstance(data, str):
                    yield data
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()

    try:
        yield _iterator()
    finally:
        pass


__all__ = [
    "GraphRagRefreshEvent",
    "publish_graph_rag_refresh",
    "stream_graph_rag_refresh",
    "GRAPH_RAG_CHANNEL",
]

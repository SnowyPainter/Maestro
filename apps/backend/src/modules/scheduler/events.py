from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
import asyncio
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Callable, Dict, Optional

import redis
from redis.asyncio import Redis as AsyncRedis

from apps.backend.src.core.config import settings

logger = logging.getLogger(__name__)

REDIS_URL_ENV = "REDIS_URL"
DEFAULT_REDIS_URL = settings.CELERY_BROKER_URL

_PUBLISHERS: Dict[str, redis.Redis] = {}
_ASYNC_CLIENTS: Dict[str, AsyncRedis] = {}


class ScheduleEventType(str, Enum):
    CREATED = "schedule.created"
    UPDATED = "schedule.updated"
    DELETED = "schedule.deleted"
    RUNNING = "schedule.running"
    DONE = "schedule.done"
    FAILED = "schedule.failed"
    RESCHEDULED = "schedule.rescheduled"


@dataclass(slots=True)
class ScheduleEvent:
    id: int
    status: str
    persona_account_id: Optional[int]
    queue: Optional[str]
    due_at: Optional[datetime]
    updated_at: datetime
    event_type: ScheduleEventType
    payload: Dict[str, Any] = field(default_factory=dict)
    meta: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        obj = asdict(self)
        obj["updated_at"] = _ensure_utc(self.updated_at).isoformat()
        if self.due_at is not None:
            obj["due_at"] = _ensure_utc(self.due_at).isoformat()
        return obj


def _get_redis_url() -> str:
    return os.getenv(REDIS_URL_ENV, DEFAULT_REDIS_URL)


def get_publisher(url: Optional[str] = None) -> redis.Redis:
    key = url or _get_redis_url()
    if key not in _PUBLISHERS:
        _PUBLISHERS[key] = redis.Redis.from_url(key, decode_responses=True)
    return _PUBLISHERS[key]


def get_async_client(url: Optional[str] = None) -> AsyncRedis:
    key = url or _get_redis_url()
    if key not in _ASYNC_CLIENTS:
        _ASYNC_CLIENTS[key] = AsyncRedis.from_url(key, decode_responses=True)
    return _ASYNC_CLIENTS[key]


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _json_default(value: Any) -> Any:
    if isinstance(value, datetime):
        return _ensure_utc(value).isoformat()
    return value


@asynccontextmanager
async def stream_schedule_events(
    *,
    channel: str = "schedule.events",
    redis_url: Optional[str] = None,
) -> AsyncIterator[AsyncIterator[str]]:
    client = get_async_client(redis_url)
    pubsub = client.pubsub()
    await pubsub.subscribe(channel)

    async def _gen() -> AsyncIterator[str]:
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
        yield _gen()
    finally:
        pass


def publish_schedule_event(
    event: ScheduleEvent,
    *,
    publisher_factory: Callable[[], redis.Redis] | None = None,
    channel: str = "schedule.events",
) -> None:
    publisher_factory = publisher_factory or get_publisher
    try:
        publisher = publisher_factory()
    except Exception:
        logger.exception("Failed to create Redis publisher")
        return

    try:
        payload = json.dumps(event.to_dict(), ensure_ascii=False, default=_json_default)
        publisher.publish(channel, payload)
    except Exception:
        logger.exception("Failed to publish schedule event", extra={"event": event.to_dict(), "channel": channel})


__all__ = [
    "ScheduleEvent",
    "ScheduleEventType",
    "publish_schedule_event",
    "get_publisher",
    "stream_schedule_events",
]

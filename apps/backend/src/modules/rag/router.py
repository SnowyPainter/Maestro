from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.websockets import WebSocketState

from apps.backend.src.core.context import (
    set_campaign_id,
    set_persona_account_id,
    set_request_id,
    set_user_id,
)
from apps.backend.src.core.db import SessionLocal
from apps.backend.src.core.security import decode_token
from apps.backend.src.modules.rag.events import stream_graph_rag_refresh
from apps.backend.src.modules.rag.schemas import RagSearchMode
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import ExecutionRuntime, orchestrate_flow
from apps.backend.src.orchestrator.flows.graph_rag.graph_rag import GraphRagSuggestPayload
from apps.backend.src.orchestrator.registry import FLOWS

router = APIRouter(prefix="/graph-rag", tags=["graph_rag", "stream"])


def _parse_int(value: Optional[str], *, default: Optional[int] = None) -> Optional[int]:
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _parse_bool(value: Optional[str], *, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_mode(value: Optional[str]) -> RagSearchMode:
    allowed: set[str] = {"default", "quickstart", "memory", "next_action"}
    target = (value or "default").strip().lower()
    if target not in allowed:
        target = "default"
    return target  # type: ignore[return-value]


def _extract_token(websocket: WebSocket, query_token: Optional[str]) -> Optional[str]:
    if query_token:
        return query_token
    header = websocket.headers.get("Authorization")
    if header and header.lower().startswith("bearer "):
        return header.split(" ", 1)[1].strip()
    return None


async def _authenticate_user(token: Optional[str]) -> Optional[User]:
    if not token:
        return None
    try:
        payload = decode_token(token)
        raw_sub = payload.get("sub")
    except JWTError:
        return None
    if raw_sub is None:
        return None
    try:
        user_id = int(raw_sub)
    except (TypeError, ValueError):
        return None

    async with SessionLocal() as session:
        user = await session.get(User, user_id)
        return user


async def _send_event(websocket: WebSocket, event_type: str, payload: Any) -> None:
    await websocket.send_json({"type": event_type, "data": payload})


def _mock_suggestion(counter: int) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    card = {
        "id": f"mock-card-{counter}",
        "category": "mock",
        "title": f"[MOCK] Suggestion #{counter}",
        "description": "Synthetic Graph RAG card (no-op)",
        "cta_label": "Acknowledge",
        "operator_key": "graph_rag.mock.noop",
        "operator_payload": {"counter": counter, "generated_at": now},
        "flow_path": "/graph-rag/mock/ack",
        "priority": 100 - counter,
        "confidence": 0.95,
        "meta": {"mock": True, "counter": counter, "ts": now},
    }
    roi = {
        "memory_reuse_count": counter,
        "automated_decisions": counter * 2,
        "saved_minutes": counter * 5,
        "ai_intervention_rate": 0.9,
    }
    return {"generated_at": now, "cards": [card], "roi": roi}


@router.websocket("/suggestions/stream")
async def graph_rag_suggestions_stream(websocket: WebSocket) -> None:
    params = websocket.query_params
    persona_id = _parse_int(params.get("persona_id"))
    persona_account_id = _parse_int(params.get("persona_account_id"))
    campaign_id = _parse_int(params.get("campaign_id"))
    limit = max(1, min(_parse_int(params.get("limit"), default=20) or 20, 50))
    mode = _parse_mode(params.get("mode"))
    include_quickstart = _parse_bool(params.get("include_quickstart"), default=True)
    include_memory = _parse_bool(params.get("include_memory"), default=True)
    include_next_actions = _parse_bool(params.get("include_next_actions"), default=True)
    include_roi = _parse_bool(params.get("include_roi"), default=True)
    debug = _parse_bool(params.get("debug"))
    mock = _parse_bool(params.get("mock"))
    token = _extract_token(websocket, params.get("token"))

    user: Optional[User] = None
    if not mock:
        user = await _authenticate_user(token)
        if not user:
            await websocket.close(code=1008, reason="Unauthorized")
            return

    await websocket.accept()

    request_id = str(uuid.uuid4())
    set_request_id(request_id)
    set_user_id(str(user.id) if user else None)
    set_persona_account_id(str(persona_account_id) if persona_account_id else None)
    set_campaign_id(str(campaign_id) if campaign_id else None)

    flow = FLOWS.get("graph_rag.suggest")
    if flow is None and not mock:
        await _send_event(
            websocket,
            "graph_rag.debug",
            {"kind": "error", "message": "graph_rag.suggest flow missing", "ts": datetime.now(timezone.utc).isoformat()},
        )
        await websocket.close(code=1011, reason="Flow not available")
        return

    base_payload = GraphRagSuggestPayload(
        persona_id=persona_id,
        persona_account_id=persona_account_id,
        campaign_id=campaign_id,
        mode=mode,
        limit=limit,
        include_quickstart=include_quickstart,
        include_memory=include_memory,
        include_next_actions=include_next_actions,
        include_roi=include_roi,
    )

    async def _render() -> dict[str, Any]:
        if mock:
            return _mock_suggestion(0)

        data = (
            base_payload.model_dump()
            if hasattr(base_payload, "model_dump")
            else base_payload.dict()
        )
        payload = GraphRagSuggestPayload(**data)
        async with SessionLocal() as session:
            runtime = ExecutionRuntime()
            runtime.provide(session, type_hint=AsyncSession)
            if user:
                runtime.provide(user, type_hint=User)
            result = await orchestrate_flow(flow, payload, runtime)

        encoded = jsonable_encoder(result)
        if isinstance(encoded, str):
            try:
                return json.loads(encoded)
            except json.JSONDecodeError:
                return {"raw": encoded}
        return encoded

    async def _run_mock() -> None:
        if debug:
            await _send_event(
                websocket,
                "graph_rag.debug",
                {
                    "kind": "connected",
                    "persona_id": persona_id,
                    "campaign_id": campaign_id,
                    "mock": True,
                    "ts": datetime.now(timezone.utc).isoformat(),
                },
            )
        counter = 0
        await _send_event(websocket, "graph_rag.suggestion", _mock_suggestion(counter))
        try:
            while True:
                await asyncio.sleep(2.0)
                counter += 1
                tick_payload = {
                    "kind": "mock_tick",
                    "counter": counter,
                    "persona_id": persona_id,
                    "campaign_id": campaign_id,
                    "ts": datetime.now(timezone.utc).isoformat(),
                }
                await _send_event(websocket, "graph_rag.mock", tick_payload)
                await _send_event(websocket, "graph_rag.suggestion", _mock_suggestion(counter))
        except (asyncio.CancelledError, WebSocketDisconnect):
            return

    async def _run_real() -> None:
        if debug:
            await _send_event(
                websocket,
                "graph_rag.debug",
                {
                    "kind": "connected",
                    "persona_id": persona_id,
                    "campaign_id": campaign_id,
                    "ts": datetime.now(timezone.utc).isoformat(),
                },
            )
        await _send_event(websocket, "graph_rag.suggestion", await asyncio.shield(_render()))
        try:
            async with stream_graph_rag_refresh() as events:
                async for message in events:
                    try:
                        payload = json.loads(message)
                    except json.JSONDecodeError:
                        if debug:
                            await _send_event(
                                websocket,
                                "graph_rag.debug",
                                {
                                    "kind": "invalid_message",
                                    "raw": message,
                                    "ts": datetime.now(timezone.utc).isoformat(),
                                },
                            )
                        continue
                    if not _matches_event(payload, persona_id, campaign_id):
                        if debug:
                            await _send_event(
                                websocket,
                                "graph_rag.debug",
                                {
                                    "kind": "skipped",
                                    "payload": payload,
                                    "ts": datetime.now(timezone.utc).isoformat(),
                                },
                            )
                        continue
                    if debug:
                        await _send_event(
                            websocket,
                            "graph_rag.debug",
                            {
                                "kind": "refresh",
                                "payload": payload,
                                "ts": datetime.now(timezone.utc).isoformat(),
                            },
                        )
                    await _send_event(websocket, "graph_rag.suggestion", await asyncio.shield(_render()))
        except (asyncio.CancelledError, WebSocketDisconnect):
            return

    try:
        if mock:
            await _run_mock()
        else:
            await _run_real()
    except WebSocketDisconnect:
        pass
    finally:
        if websocket.application_state is not WebSocketState.DISCONNECTED:
            await websocket.close()
        set_user_id(None)
        set_persona_account_id(None)
        set_campaign_id(None)


def _matches_event(payload: dict[str, Any], persona_id: Optional[int], campaign_id: Optional[int]) -> bool:
    target_persona = payload.get("persona_id")
    target_campaign = payload.get("campaign_id")
    if target_persona is not None and persona_id is not None and int(target_persona) != int(persona_id):
        return False
    if target_campaign is not None and campaign_id is not None and int(target_campaign) != int(campaign_id):
        return False
    return True


__all__ = ["router"]

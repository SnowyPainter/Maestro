from __future__ import annotations

import json
from typing import Any, AsyncIterator, Optional

from fastapi import APIRouter, Depends, Query
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.core.deps import get_current_user, get_db
from apps.backend.src.modules.rag.events import stream_graph_rag_refresh
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import ExecutionRuntime, orchestrate_flow
from apps.backend.src.orchestrator.registry import FLOWS
from apps.backend.src.orchestrator.flows.graph_rag.graph_rag import GraphRagSuggestPayload
from apps.backend.src.modules.rag.schemas import RagSearchMode

router = APIRouter(prefix="/graph-rag", tags=["graph_rag", "stream"])


def _matches_event(payload: dict[str, Any], persona_id: Optional[int], campaign_id: Optional[int]) -> bool:
    target_persona = payload.get("persona_id")
    target_campaign = payload.get("campaign_id")
    if target_persona is not None and persona_id is not None and int(target_persona) != int(persona_id):
        return False
    if target_campaign is not None and campaign_id is not None and int(target_campaign) != int(campaign_id):
        return False
    return True


@router.get(
    "/suggestions/stream",
    name="graph_rag:suggestions_stream",
    response_class=EventSourceResponse,
)
async def graph_rag_suggestions_stream(
    persona_id: Optional[int] = Query(default=None),
    persona_account_id: Optional[int] = Query(default=None),
    campaign_id: Optional[int] = Query(default=None),
    mode: RagSearchMode = Query(default="default"),
    limit: int = Query(default=8, ge=1, le=50),
    include_quickstart: bool = Query(default=True),
    include_memory: bool = Query(default=True),
    include_next_actions: bool = Query(default=True),
    include_roi: bool = Query(default=True),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EventSourceResponse:
    flow = FLOWS.get("graph_rag.suggest")
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

    runtime = ExecutionRuntime()
    runtime.provide(db, type_hint=AsyncSession)
    runtime.provide(user, type_hint=User)

    async def _render() -> str:
        data = base_payload.model_dump() if hasattr(base_payload, "model_dump") else base_payload.dict()  # type: ignore[attr-defined]
        payload = GraphRagSuggestPayload(**data)
        result = await orchestrate_flow(flow, payload, runtime.clone())
        if hasattr(result, "model_dump_json"):
            return result.model_dump_json()  # type: ignore[attr-defined]
        return result.json()  # type: ignore[no-any-return]

    async def iterator() -> AsyncIterator[dict[str, str]]:
        yield {"event": "graph_rag.suggestion", "data": await _render()}
        async with stream_graph_rag_refresh() as events:
            async for message in events:
                try:
                    payload = json.loads(message)
                except json.JSONDecodeError:
                    continue
                if not _matches_event(payload, persona_id, campaign_id):
                    continue
                yield {"event": "graph_rag.suggestion", "data": await _render()}

    return EventSourceResponse(iterator(), ping=15.0)


__all__ = ["router"]

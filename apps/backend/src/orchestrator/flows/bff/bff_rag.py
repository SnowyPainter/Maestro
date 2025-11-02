from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.accounts.service import get_persona_account
from apps.backend.src.modules.rag.schemas import RagSearchItem, RagSearchResponse
from apps.backend.src.modules.rag.search import search_rag
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


class BffRagSearchPayload(BaseModel):
    query: str = Field(..., min_length=1)
    persona_id: Optional[int] = None
    persona_account_id: Optional[int] = None
    campaign_id: Optional[int] = None
    limit: int = Field(6, ge=1, le=50)


@operator(
    key="bff.rag.search",
    title="Search RAG graph",
    side_effect="read",
)
async def op_rag_search(payload: BffRagSearchPayload, ctx: TaskContext) -> RagSearchResponse:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    if not payload.query.strip():
        return RagSearchResponse(items=[])

    persona_id = payload.persona_id
    if persona_id is None and payload.persona_account_id:
        persona_account = await get_persona_account(db, persona_account_id=payload.persona_account_id)
        if persona_account is not None:
            persona_id = persona_account.persona_id

    persona_ids = [persona_id] if persona_id else None
    campaign_ids = [payload.campaign_id] if payload.campaign_id else None

    items = await search_rag(
        db,
        query_text=payload.query,
        owner_user_id=user.id,
        persona_ids=persona_ids,
        campaign_ids=campaign_ids,
        limit=payload.limit,
    )
    return RagSearchResponse(items=items)


@FLOWS.flow(
    key="bff.rag.search",
    title="Graph RAG Search",
    description="Graph RAG Search over Maestro knowledge graph",
    input_model=BffRagSearchPayload,
    output_model=RagSearchResponse,
    method="post",
    path="/rag/search",
    tags=("bff", "rag"),
)
def _flow_bff_rag_search(builder: FlowBuilder):
    task = builder.task("rag_search", "bff.rag.search")
    builder.expect_terminal(task)


__all__ = ["BffRagSearchPayload", "RagSearchResponse"]

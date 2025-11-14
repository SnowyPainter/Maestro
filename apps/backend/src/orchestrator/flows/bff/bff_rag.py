from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.accounts.service import get_persona_account
from apps.backend.src.modules.rag.functions import (
    RagSearchMode,
    build_memory_highlights_from_graph,
    build_next_actions_from_graph,
    build_quickstart_templates,
    estimate_roi,
    fallback_query_for_mode,
    rag_mode_config,
    resolve_persona_context,
    resolve_sections,
)
from apps.backend.src.modules.rag.schemas import RagExpandResponse, RagSearchItem, RagSearchResponse
from apps.backend.src.modules.rag.search import expand_neighbors, search_rag
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


class BffRagSearchPayload(BaseModel):
    query: str = Field("", min_length=0)
    persona_id: Optional[int] = None
    persona_account_id: Optional[int] = None
    campaign_id: Optional[int] = None
    limit: int = Field(6, ge=1, le=50)
    mode: RagSearchMode = Field("default", description="Post-processing mode for the shared operator")
    include_quickstart: bool = Field(False, description="Populate quickstart templates even outside quickstart mode")
    include_memory: bool = Field(False, description="Include memory reuse summaries")
    include_next_actions: bool = Field(False, description="Include Next Action proposals")
    include_roi: bool = Field(False, description="Include ROI/value insights")


@operator(
    key="bff.rag.search",
    title="Search RAG graph",
    side_effect="read",
)
async def op_rag_search(payload: BffRagSearchPayload, ctx: TaskContext) -> RagSearchResponse:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    persona_id = payload.persona_id
    if persona_id is None and payload.persona_account_id:
        persona_account = await get_persona_account(db, persona_account_id=payload.persona_account_id)
        if persona_account is not None:
            persona_id = persona_account.persona_id

    persona_ctx = await resolve_persona_context(
        db,
        owner_user_id=user.id,
        persona_id=persona_id,
        campaign_id=payload.campaign_id,
    )

    sections = resolve_sections(
        mode=payload.mode,
        include_quickstart=payload.include_quickstart,
        include_memory=payload.include_memory,
        include_next_actions=payload.include_next_actions,
        include_roi=payload.include_roi,
    )
    query_text = payload.query.strip()
    if not query_text:
        query_text = fallback_query_for_mode(payload.mode, persona_ctx)

    persona_ids = [persona_id] if persona_id else None
    campaign_ids = [payload.campaign_id] if payload.campaign_id else None

    items: List[RagSearchItem] = []
    if query_text:
        items = await search_rag(
            db,
            query_text=query_text,
            owner_user_id=user.id,
            persona_ids=persona_ids,
            campaign_ids=campaign_ids,
            limit=payload.limit,
        )

    response = RagSearchResponse(items=items)

    if "quickstart" in sections:
        response.quickstart = build_quickstart_templates(
            query_text,
            persona_ctx,
            items,
            max(payload.limit, 3),
        )

    memory_highlights = []
    if "memory" in sections or "roi" in sections:
        memory_highlights = build_memory_highlights_from_graph(
            items,
            persona_ctx,
            max(payload.limit, 5),
        )
    if "memory" in sections:
        response.memory_highlights = memory_highlights

    next_actions = []
    if "next_actions" in sections or "roi" in sections:
        next_actions = build_next_actions_from_graph(
            items,
            persona_ctx,
            limit=5,
        )
    if "next_actions" in sections:
        response.next_actions = next_actions

    if "roi" in sections:
        response.roi = estimate_roi(
            memory_highlights,
            next_actions,
            persona_ctx,
        )

    return response

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


@FLOWS.flow(
    key="bff.rag.search.quickstart",
    title="Graph RAG Quickstart Search",
    description="Curated Graph RAG search tuned for the onboarding quickstart loop",
    input_model=BffRagSearchPayload,
    output_model=RagSearchResponse,
    method="post",
    path="/rag/search/quickstart",
    tags=("bff", "rag", "quickstart"),
)
def _flow_bff_rag_search_quickstart(builder: FlowBuilder):
    task = builder.task(
        "rag_search_quickstart",
        "bff.rag.search",
        config=rag_mode_config(
            mode="quickstart",
            include_quickstart=True,
            include_memory=True,
            include_next_actions=True,
            include_roi=True,
            default_query="What trend should we cover this week?",
            min_limit=6,
        ),
    )
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.rag.search.memory",
    title="Graph RAG Memory Reapply Search",
    description="Surface playbooks and judgements that can be reapplied immediately",
    input_model=BffRagSearchPayload,
    output_model=RagSearchResponse,
    method="post",
    path="/rag/search/memory",
    tags=("bff", "rag", "memory"),
)
def _flow_bff_rag_search_memory(builder: FlowBuilder):
    task = builder.task(
        "rag_search_memory",
        "bff.rag.search",
        config=rag_mode_config(
            mode="memory",
            include_memory=True,
            include_roi=True,
            default_query="Which stored judgement should I reuse right now?",
            min_limit=6,
        ),
    )
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.rag.search.next_action",
    title="Graph RAG Next Action Search",
    description="Translate Graph RAG context into the next recommended action",
    input_model=BffRagSearchPayload,
    output_model=RagSearchResponse,
    method="post",
    path="/rag/search/next-action",
    tags=("bff", "rag", "next_action"),
)
def _flow_bff_rag_search_next_action(builder: FlowBuilder):
    task = builder.task(
        "rag_search_next_action",
        "bff.rag.search",
        config=rag_mode_config(
            mode="next_action",
            include_next_actions=True,
            include_roi=True,
            default_query="What should we publish next for this campaign?",
            min_limit=3,
        ),
    )
    builder.expect_terminal(task)

class BffRagExpandPayload(BaseModel):
    node_id: UUID
    edge_types: Optional[List[str]] = None
    limit: int = Field(20, ge=1, le=100)


@operator(
    key="bff.rag.expand",
    title="Expand neighbors for a graph node",
    side_effect="read",
)
async def op_rag_expand(payload: BffRagExpandPayload, ctx: TaskContext) -> RagExpandResponse:
    db: AsyncSession = ctx.require(AsyncSession)
    edges = await expand_neighbors(
        db,
        node_id=payload.node_id,
        limit=payload.limit,
        edge_types=payload.edge_types,
    )
    return RagExpandResponse(items=edges)


@FLOWS.flow(
    key="bff.rag.expand",
    title="Expand neighbors for a graph node",
    description="Fetch neighboring nodes and edge types for the specified graph node",
    input_model=BffRagExpandPayload,
    output_model=RagExpandResponse,
    method="get",
    path="/rag/nodes/{node_id}/neighbors",
    tags=("bff", "rag"),
)
def _flow_bff_rag_expand(builder: FlowBuilder):
    task = builder.task("rag_expand", "bff.rag.expand")
    builder.expect_terminal(task)



__all__ = ["BffRagSearchPayload", "RagSearchResponse", "BffRagExpandPayload"]

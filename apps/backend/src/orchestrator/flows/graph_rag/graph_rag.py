"""Graph RAG action orchestration flows and operators."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set
from uuid import UUID

from apps.backend.src.modules.rag.events import logger
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.accounts.service import get_persona_account
from apps.backend.src.modules.rag.functions import (
    build_memory_highlights_from_graph,
    _looks_like_comment,
    build_next_actions_from_graph,
    build_quickstart_templates,
    estimate_roi,
    fallback_query_for_mode,
    rag_mode_config,
    resolve_persona_context,
    resolve_sections,
)
from apps.backend.src.modules.rag.schemas import (
    GraphRagActionCard,
    GraphRagActionContext,
    GraphRagActionList,
    GraphRagSuggestionResponse,
    RagPersonaContext,
    RagSearchItem,
    RagSearchMode,
    RagSearchResponse,
    RagValueInsight,
)
from apps.backend.src.modules.rag.search import search_rag
from apps.backend.src.modules.rag.utils import (
    load_completed_graph_actions,
    normalize_action_signature,
    normalize_node_key,
)
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


TREND_CARD_LIMIT = 4
DRAFT_CARD_LIMIT = 4
PLAYBOOK_CARD_LIMIT = 3
COMMENT_CARD_LIMIT = 3

TREND_ACTION_PATH = "/graph-rag/actions/trend-to-draft"
NEXT_ACTION_PATH = "/graph-rag/actions/next-action"
PLAYBOOK_ACTION_PATH = "/graph-rag/actions/playbook-reapply"


class GraphRagSuggestPayload(BaseModel):
    query: str = Field("", min_length=0)
    persona_id: Optional[int] = None
    persona_account_id: Optional[int] = None
    campaign_id: Optional[int] = None
    limit: int = Field(20, ge=1, le=50)
    mode: RagSearchMode = Field("quickstart", description="Action generation mode")
    include_quickstart: bool = Field(True, description="Include quickstart templates")
    include_memory: bool = Field(True, description="Include memory reuse cards")
    include_next_actions: bool = Field(True, description="Include Next Action proposals")
    include_roi: bool = Field(True, description="Include ROI/value insights")


class GraphRagAggregatePayload(BaseModel):
    persona: Optional[RagPersonaContext] = None
    limit: int = Field(12, ge=1, le=50)
    buckets: List[GraphRagActionList] = Field(default_factory=list)
    roi: Optional[RagValueInsight] = None


@operator(
    key="graph_rag.collect_context",
    title="Collect Graph RAG context",
    side_effect="read",
)
async def op_graph_rag_collect_context(payload: GraphRagSuggestPayload, ctx: TaskContext) -> GraphRagActionContext:
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
    effective_limit = max(payload.limit, 1)

    if "quickstart" in sections:
        response.quickstart = build_quickstart_templates(
            query_text,
            persona_ctx,
            items,
            max(effective_limit, 3),
        )

    memory_highlights: List = []
    if "memory" in sections or "roi" in sections:
        memory_highlights = build_memory_highlights_from_graph(
            items,
            persona_ctx,
            max(effective_limit, 5),
        )
        if "memory" in sections:
            response.memory_highlights = memory_highlights

    next_actions: List = []
    if "next_actions" in sections or "roi" in sections:
        next_actions = build_next_actions_from_graph(
            items,
            persona_ctx,
            limit=max(3, min(6, effective_limit)),
        )
        if "next_actions" in sections:
            response.next_actions = next_actions

    if "roi" in sections:
        response.roi = estimate_roi(
            memory_highlights,
            next_actions,
            persona_ctx,
        )

    completed = await load_completed_graph_actions(
        db,
        persona_id=persona_id,
        campaign_id=payload.campaign_id,
    )

    return GraphRagActionContext(
        owner_user_id=user.id,
        persona_id=persona_id,
        campaign_id=payload.campaign_id,
        persona=persona_ctx,
        query=query_text,
        mode=payload.mode,
        sections=sorted(sections),
        limit=effective_limit,
        response=response,
        completed_node_ids=completed.node_ids,
        completed_playbook_ids=completed.playbook_ids,
        completed_action_signatures=completed.action_signatures,
    )


@operator(
    key="graph_rag.actions.trend",
    title="Trend oriented Graph RAG cards",
    side_effect="read",
)
async def op_graph_rag_trend_actions(payload: GraphRagActionContext, ctx: TaskContext) -> GraphRagActionList:
    limit = min(TREND_CARD_LIMIT, max(1, payload.limit))
    cards: List[GraphRagActionCard] = []
    completed_nodes = payload.completed_node_ids

    for idx, template in enumerate(payload.response.quickstart):
        if len(cards) >= limit:
            break
        node_key = normalize_node_key(template.source_node_id)
        if node_key and node_key in completed_nodes:
            continue
        persona = template.persona or payload.persona
        cards.append(
            GraphRagActionCard(
                id=f"trend:quickstart:{template.source_node_id or idx}",
                category="trend",
                title=template.title,
                description=template.description or template.query,
                persona=persona,
                cta_label="Draft from this trend",
                operator_key="graph_rag.actions.trend_to_draft",
                flow_path=TREND_ACTION_PATH,
                operator_payload={
                    "query": template.query,
                    "persona_id": persona.persona_id if persona else payload.persona_id,
                    "campaign_id": persona.campaign_id if persona else payload.campaign_id,
                    "title": template.title,
                    "description": template.description or template.query,
                    "source_node_id": str(template.source_node_id) if template.source_node_id else None,
                },
                source_node_id=template.source_node_id,
                priority=90 - idx,
                meta={"kind": "quickstart", "query": template.query},
            )
        )

    if len(cards) < limit:
        for idx, item in enumerate(payload.response.items):
            if not _looks_like_trend(item):
                continue
            node_key = normalize_node_key(item.node_id)
            if node_key and node_key in completed_nodes:
                continue
            cards.append(
                GraphRagActionCard(
                    id=f"trend:item:{item.node_id}",
                    category="trend",
                    title=item.title or "Trend insight",
                    description=item.summary,
                    persona=payload.persona,
                    cta_label="Plan response to trend",
                    operator_key="graph_rag.actions.trend_to_draft",
                    flow_path=TREND_ACTION_PATH,
                    operator_payload={
                        "query": payload.query,
                        "persona_id": payload.persona_id,
                        "campaign_id": payload.campaign_id,
                        "title": item.title or "Trend insight",
                        "description": item.summary,
                        "source_node_id": str(item.node_id) if item.node_id else None,
                    },
                    source_node_id=item.node_id,
                    priority=80 - idx,
                    meta={"kind": "trend_node", "score": item.score},
                )
            )
            if len(cards) >= limit:
                break

    return GraphRagActionList(cards=cards)


@operator(
    key="graph_rag.actions.draft",
    title="Draft oriented Graph RAG cards",
    side_effect="read",
)
async def op_graph_rag_draft_actions(payload: GraphRagActionContext, ctx: TaskContext) -> GraphRagActionList:
    limit = min(DRAFT_CARD_LIMIT, max(2, payload.limit))
    cards: List[GraphRagActionCard] = []
    completed_nodes = payload.completed_node_ids
    completed_actions = payload.completed_action_signatures

    for idx, action in enumerate(payload.response.next_actions):
        if len(cards) >= limit:
            break
        node_key = normalize_node_key((action.meta or {}).get("source_node_id"))
        action_signature = normalize_action_signature(action.title, action.action)
        if node_key and node_key in completed_nodes:
            continue
        if action_signature and action_signature in completed_actions:
            continue
        persona = action.persona or payload.persona
        cards.append(
            GraphRagActionCard(
                id=f"draft:next_action:{idx}:{action.playbook_id or 'na'}",
                category="draft",
                title=action.title,
                description=action.action,
                persona=persona,
                cta_label=None,  # informational only; no direct execute CTA
                operator_key=None,
                flow_path=None,
                operator_payload={},
                source_node_id=_safe_uuid((action.meta or {}).get("source_node_id")),
                priority=85 - idx,
                confidence=action.confidence,
                meta={"kind": "next_action", "source_node_id": (action.meta or {}).get("source_node_id")},
            )
        )

    if len(cards) < limit:
        for idx, item in enumerate(payload.response.items):
            if not _looks_like_draft(item):
                continue
            node_key = normalize_node_key(item.node_id)
            if node_key and node_key in completed_nodes:
                continue
            cards.append(
                GraphRagActionCard(
                    id=f"draft:item:{item.node_id}",
                    category="draft",
                    title=item.title or "High performing draft",
                    description=item.summary,
                    persona=payload.persona,
                    cta_label="Open draft",
                    operator_payload={
                        "node_id": str(item.node_id),
                        "source_table": item.source_table,
                    },
                    source_node_id=item.node_id,
                    priority=70 - idx,
                    meta={"kind": "draft_node", "score": item.score},
                )
            )
            if len(cards) >= limit:
                break

    return GraphRagActionList(cards=cards)


@operator(
    key="graph_rag.actions.comment",
    title="Comment oriented Graph RAG cards",
    side_effect="read",
)
async def op_graph_rag_comment_actions(payload: GraphRagActionContext, ctx: TaskContext) -> GraphRagActionList:
    limit = min(COMMENT_CARD_LIMIT, max(1, payload.limit))
    cards: List[GraphRagActionCard] = []
    completed_nodes = payload.completed_node_ids
    for idx, item in enumerate(payload.response.items):
        if len(cards) >= limit:
            break
        if not _looks_like_comment(item):
            continue
        node_key = normalize_node_key(item.node_id)
        if node_key and node_key in completed_nodes:
            continue
        cards.append(
            GraphRagActionCard(
                id=f"comment:item:{item.node_id}",
                category="comment",
                title=item.title or "Comment to respond",
                description=item.summary,
                persona=payload.persona,
                cta_label=None,  # informational only for now
                operator_key=None,
                flow_path=None,
                operator_payload={
                    "node_id": str(item.node_id),
                    "source_table": item.source_table,
                },
                source_node_id=item.node_id,
                priority=65 - idx,
                meta={"kind": "comment_node", "score": item.score},
            )
        )

    return GraphRagActionList(cards=cards)


@operator(
    key="graph_rag.actions.playbook",
    title="Playbook oriented Graph RAG cards",
    side_effect="read",
)
async def op_graph_rag_playbook_actions(payload: GraphRagActionContext, ctx: TaskContext) -> GraphRagActionList:
    limit = min(PLAYBOOK_CARD_LIMIT, max(1, payload.limit))
    cards: List[GraphRagActionCard] = []
    completed_nodes = payload.completed_node_ids
    completed_playbooks = payload.completed_playbook_ids

    for idx, highlight in enumerate(payload.response.memory_highlights):
        if len(cards) >= limit:
            break
        node_key = normalize_node_key(highlight.node_id)
        if highlight.playbook_id and highlight.playbook_id in completed_playbooks:
            continue
        if node_key and node_key in completed_nodes:
            continue
        persona = highlight.persona or payload.persona
        cards.append(
            GraphRagActionCard(
                id=f"playbook:{highlight.playbook_id or highlight.node_id or idx}",
                category="playbook",
                title=highlight.title or "Reusable playbook",
                description=highlight.summary,
                persona=persona,
                cta_label="Reuse this playbook",
                operator_key="graph_rag.actions.playbook_reapply",
                flow_path=PLAYBOOK_ACTION_PATH,
                operator_payload={
                    "playbook_id": highlight.playbook_id,
                    "node_id": str(highlight.node_id) if highlight.node_id else None,
                    "persona_id": persona.persona_id if persona else payload.persona_id,
                    "campaign_id": persona.campaign_id if persona else payload.campaign_id,
                    "title": highlight.title,
                    "summary": highlight.summary,
                    "reuse_count": highlight.reuse_count,
                },
                source_node_id=highlight.node_id,
                priority=60 - idx,
                confidence=min(1.0, 0.5 + (max(highlight.reuse_count, 1) / 10.0)),
                meta={
                    "kind": "memory",
                    "reuse_count": highlight.reuse_count,
                    "reasons": highlight.reasons,
                },
            )
        )

    return GraphRagActionList(cards=cards)


@operator(
    key="graph_rag.aggregate_cards",
    title="Aggregate Graph RAG cards",
    side_effect="read",
)
async def op_graph_rag_aggregate_cards(payload: GraphRagAggregatePayload, ctx: TaskContext) -> GraphRagSuggestionResponse:
    merged: Dict[str, GraphRagActionCard] = {}
    for bucket in payload.buckets:
        if bucket is None:
            continue
        for card in bucket.cards:
            if card.id not in merged:
                merged[card.id] = card
    ordered = sorted(
        merged.values(),
        key=lambda card: (-card.priority, card.title or "", card.id),
    )
    limit = max(1, payload.limit)
    return GraphRagSuggestionResponse(
        persona=payload.persona,
        cards=ordered[:limit],
        generated_at=datetime.now(timezone.utc),
        roi=payload.roi,
    )


def _aggregate_payload_factory(state, _payload):
    context = state.results.get("context")
    buckets = [
        state.results.get("trend_cards"),
        state.results.get("draft_cards"),
        state.results.get("comment_cards"),
        state.results.get("playbook_cards"),
    ]
    limit = getattr(state.payload, "limit", 12) or 12
    persona = getattr(context, "persona", None) if context else None
    return {
        "persona": persona,
        "limit": limit,
        "buckets": [bucket for bucket in buckets if bucket is not None],
        "roi": getattr(getattr(context, "response", None), "roi", None),
    }


def _build_graph_rag_flow(builder: FlowBuilder, *, context_config: Optional[Dict[str, Any]] = None) -> None:
    context_task = builder.task("context", "graph_rag.collect_context", config=context_config)

    trend_task = builder.task(
        "trend_cards",
        "graph_rag.actions.trend",
        upstream=[context_task],
        config={"payload_from": "task:context"},
    )
    draft_task = builder.task(
        "draft_cards",
        "graph_rag.actions.draft",
        upstream=[context_task],
        config={"payload_from": "task:context"},
    )
    comment_task = builder.task(
        "comment_cards",
        "graph_rag.actions.comment",
        upstream=[context_task],
        config={"payload_from": "task:context"},
    )
    playbook_task = builder.task(
        "playbook_cards",
        "graph_rag.actions.playbook",
        upstream=[context_task],
        config={"payload_from": "task:context"},
    )

    aggregate_task = builder.task(
        "aggregate_cards",
        "graph_rag.aggregate_cards",
        upstream=[trend_task, draft_task, comment_task, playbook_task],
        config={"payload_factory": _aggregate_payload_factory},
    )

    builder.expect_entry(context_task)
    builder.expect_terminal(aggregate_task)


@FLOWS.flow(
    key="graph_rag.suggest",
    title="Graph RAG action suggestions",
    description="Generate proactive Graph RAG action cards",
    input_model=GraphRagSuggestPayload,
    output_model=GraphRagSuggestionResponse,
    method="post",
    path="/graph-rag/suggest",
    tags=("action", "graph_rag", "rag", "actions"),
)
def _flow_graph_rag_suggest(builder: FlowBuilder):
    _build_graph_rag_flow(builder)


@FLOWS.flow(
    key="graph_rag.suggest.quickstart",
    title="Graph RAG quickstart suggestions",
    description="Generate quickstart focused Graph RAG cards",
    input_model=GraphRagSuggestPayload,
    output_model=GraphRagSuggestionResponse,
    method="post",
    path="/graph-rag/suggest/quickstart",
    tags=("action", "graph_rag", "rag", "quickstart"),
)
def _flow_graph_rag_suggest_quickstart(builder: FlowBuilder):
    _build_graph_rag_flow(
        builder,
        context_config=rag_mode_config(
            mode="quickstart",
            include_quickstart=True,
            include_memory=True,
            include_next_actions=True,
            include_roi=True,
            default_query="What trend should we cover this week?",
            min_limit=6,
        ),
    )


@FLOWS.flow(
    key="graph_rag.suggest.memory",
    title="Graph RAG memory suggestions",
    description="Generate memory reuse Graph RAG cards",
    input_model=GraphRagSuggestPayload,
    output_model=GraphRagSuggestionResponse,
    method="post",
    path="/graph-rag/suggest/memory",
    tags=("action", "graph_rag", "rag", "memory"),
)
def _flow_graph_rag_suggest_memory(builder: FlowBuilder):
    _build_graph_rag_flow(
        builder,
        context_config=rag_mode_config(
            mode="memory",
            include_memory=True,
            include_roi=True,
            default_query="Which stored judgement should I reuse right now?",
            min_limit=6,
        ),
    )


@FLOWS.flow(
    key="graph_rag.suggest.next_action",
    title="Graph RAG next action suggestions",
    description="Generate next action Graph RAG cards",
    input_model=GraphRagSuggestPayload,
    output_model=GraphRagSuggestionResponse,
    method="post",
    path="/graph-rag/suggest/next-action",
    tags=("action", "graph_rag", "rag", "next_action"),
)
def _flow_graph_rag_suggest_next_action(builder: FlowBuilder):
    _build_graph_rag_flow(
        builder,
        context_config=rag_mode_config(
            mode="next_action",
            include_next_actions=True,
            include_roi=True,
            default_query="What should we publish next for this campaign?",
            min_limit=3,
        ),
    )


def _looks_like_trend(item: RagSearchItem) -> bool:
    node_type = (item.node_type or "").lower()
    if any(term in node_type for term in ("trend", "insight")):
        return True
    theme = item.meta.get("theme") or item.meta.get("category")
    if isinstance(theme, str) and "trend" in theme.lower():
        return True
    return bool(item.meta.get("is_trend"))


def _looks_like_draft(item: RagSearchItem) -> bool:
    node_type = (item.node_type or "").lower()
    if "draft" in node_type or "post" in node_type:
        return True
    source_table = (item.source_table or "").lower()
    if source_table in {"drafts", "post_publications"}:
        return True
    tags = item.meta.get("tags")
    if isinstance(tags, list):
        for value in tags:
            if isinstance(value, str) and "draft" in value.lower():
                return True
    return False


def _safe_uuid(value: Any) -> Optional[UUID]:
    if not value:
        return None
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        return None


__all__ = [
    "GraphRagSuggestPayload",
]

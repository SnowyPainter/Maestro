from __future__ import annotations

from datetime import datetime
from typing import Any, Callable, Dict, List, Literal, Optional, Sequence, Set, Tuple
from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.accounts.service import get_persona, get_persona_account
from apps.backend.src.modules.campaigns.service import get_campaign
from apps.backend.src.modules.rag.schemas import (
    RagExpandResponse,
    RagMemoryHighlight,
    RagNextActionProposal,
    RagPersonaContext,
    RagQuickstartTemplate,
    RagRelatedEdge,
    RagSearchItem,
    RagSearchResponse,
    RagValueInsight,
)
from apps.backend.src.modules.rag.search import expand_neighbors, search_rag
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator

RagSearchMode = Literal["default", "quickstart", "memory", "next_action"]

MEMORY_EDGE_TYPES: Set[str] = {
    "memory_reapplied",
    "playbook.memory_reapplied",
    "judgement.reused_in",
    "decision.reapplied",
    "memory_link",
}

NEXT_ACTION_EDGE_TYPES: Set[str] = {
    "playbook.next_action",
    "next_action",
    "cta",
    "proposal",
    "recommended_action",
}

TREND_EDGE_TYPES: Set[str] = {
    "trend",
    "trend_of",
    "trend_for",
    "trend_inspired",
    "trend_reference",
}

TREND_NODE_TYPES: Set[str] = {
    "trend",
    "trend_insight",
    "topic",
    "insight.trend",
}

MEMORY_NODE_TYPES: Set[str] = {
    "playbook",
    "playbook_summary",
    "judgement",
    "decision",
}


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

    persona_ctx = await _resolve_persona_context(
        db,
        owner_user_id=user.id,
        persona_id=persona_id,
        campaign_id=payload.campaign_id,
    )

    sections = _resolve_sections(payload)
    query_text = payload.query.strip()
    if not query_text:
        query_text = _fallback_query_for_mode(payload.mode, persona_ctx)

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
        response.quickstart = _build_quickstart_templates(
            query_text,
            persona_ctx,
            items,
            max(payload.limit, 3),
        )

    memory_highlights: List[RagMemoryHighlight] = []
    if "memory" in sections or "roi" in sections:
        memory_highlights = _build_memory_highlights_from_graph(
            items,
            persona_ctx,
            max(payload.limit, 5),
        )
    if "memory" in sections:
        response.memory_highlights = memory_highlights

    next_actions: List[RagNextActionProposal] = []
    if "next_actions" in sections or "roi" in sections:
        next_actions = _build_next_actions_from_graph(
            items,
            persona_ctx,
            limit=5,
        )
    if "next_actions" in sections:
        response.next_actions = next_actions

    if "roi" in sections:
        response.roi = _estimate_roi(
            memory_highlights,
            next_actions,
            persona_ctx,
        )

    return response


def _payload_to_dict(payload: Any) -> Dict[str, Any]:
    if isinstance(payload, BaseModel):
        if hasattr(payload, "model_dump"):
            return payload.model_dump()  # type: ignore[attr-defined]
        return payload.dict()  # type: ignore[attr-defined]
    if isinstance(payload, dict):
        return dict(payload)
    return dict(payload or {})


def _mode_config(
    *,
    mode: RagSearchMode,
    include_quickstart: bool = False,
    include_memory: bool = False,
    include_next_actions: bool = False,
    include_roi: bool = False,
    default_query: Optional[str] = None,
    min_limit: Optional[int] = None,
) -> Dict[str, Any]:
    def _factory(_state, payload):
        data = _payload_to_dict(payload)
        data["mode"] = mode
        data["include_quickstart"] = bool(data.get("include_quickstart") or include_quickstart)
        data["include_memory"] = bool(data.get("include_memory") or include_memory)
        data["include_next_actions"] = bool(
            data.get("include_next_actions") or include_next_actions
        )
        data["include_roi"] = bool(data.get("include_roi") or include_roi)
        if default_query and not (data.get("query") or "").strip():
            data["query"] = default_query
        if min_limit is not None:
            current_limit = int(data.get("limit") or 0)
            data["limit"] = max(current_limit, min_limit)
        return data

    return {"payload_factory": _factory}


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
        config=_mode_config(
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
        config=_mode_config(
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
        config=_mode_config(
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


def _resolve_sections(payload: BffRagSearchPayload) -> Set[str]:
    sections: Set[str] = set()
    if payload.include_quickstart:
        sections.add("quickstart")
    if payload.include_memory:
        sections.add("memory")
    if payload.include_next_actions:
        sections.add("next_actions")
    if payload.include_roi:
        sections.add("roi")

    mode_overrides = {
        "quickstart": {"quickstart", "memory", "next_actions", "roi"},
        "memory": {"memory", "roi"},
        "next_action": {"next_actions", "roi"},
    }
    sections.update(mode_overrides.get(payload.mode, set()))
    return sections


def _fallback_query_for_mode(mode: RagSearchMode, ctx: Optional[RagPersonaContext]) -> str:
    persona_label = _persona_label(ctx)
    if mode == "quickstart":
        return f"Latest cultural or product trends {persona_label} should react to this week"
    if mode == "memory":
        return f"{persona_label} judgements that worked well before"
    if mode == "next_action":
        return f"Next best action for {persona_label}"
    return ""


def _persona_label(ctx: Optional[RagPersonaContext]) -> str:
    if ctx is None:
        return "our brand"
    if ctx.campaign_name and ctx.persona_name:
        return f"{ctx.persona_name} in {ctx.campaign_name}"
    if ctx.persona_name:
        return ctx.persona_name
    if ctx.campaign_name:
        return ctx.campaign_name
    return "our brand"


def _build_quickstart_templates(
    query_text: str,
    persona_ctx: Optional[RagPersonaContext],
    items: Sequence[RagSearchItem],
    limit: int,
) -> List[RagQuickstartTemplate]:
    templates: List[RagQuickstartTemplate] = []
    persona_label = _persona_label(persona_ctx)
    trend_candidates = _gather_trend_candidates(items, persona_ctx)

    for candidate in trend_candidates:
        templates.append(candidate)
        if len(templates) >= limit:
            break

    if len(templates) < limit:
        for idx, item in enumerate(items):
            template = RagQuickstartTemplate(
                title=item.title or f"Memory #{idx + 1}",
                description=item.summary,
                persona=_persona_context_from_meta(item.meta, persona_ctx),
                source_node_id=item.node_id,
                query=f"Reuse '{item.title or 'this judgement'}' for {persona_label}",
            )
            templates.append(template)
            if len(templates) >= limit:
                break

    if not templates:
        templates.append(
            RagQuickstartTemplate(
                title="Start from my best-performing judgement",
                description="Kick off the trend → draft → schedule loop with an existing win.",
                persona=persona_ctx,
                query=query_text or f"What recent win can {persona_label} reshare?",
            )
        )
    return templates


async def _resolve_persona_context(
    db: AsyncSession,
    *,
    owner_user_id: int,
    persona_id: Optional[int],
    campaign_id: Optional[int],
) -> Optional[RagPersonaContext]:
    persona = None
    if persona_id is not None:
        persona = await get_persona(db, persona_id=persona_id, owner_user_id=owner_user_id)
    campaign = None
    if campaign_id is not None:
        campaign = await get_campaign(db, campaign_id=campaign_id, owner_user_id=owner_user_id)
    if persona is None and campaign is None and persona_id is None and campaign_id is None:
        return None
    return RagPersonaContext(
        persona_id=persona.id if persona else persona_id,
        persona_name=persona.name if persona else None,
        campaign_id=campaign.id if campaign else campaign_id,
        campaign_name=campaign.name if campaign else None,
    )


def _build_memory_highlights_from_graph(
    items: Sequence[RagSearchItem],
    default_ctx: Optional[RagPersonaContext],
    limit: int,
) -> List[RagMemoryHighlight]:
    highlights: Dict[str, RagMemoryHighlight] = {}

    def _ensure(highlight: Optional[RagMemoryHighlight]) -> None:
        if highlight is None:
            return
        key = str(
            highlight.playbook_id
            or highlight.node_id
            or f"{highlight.title}-{highlight.summary}"
        )
        existing = highlights.get(key)
        if existing:
            existing.reuse_count = max(existing.reuse_count, highlight.reuse_count)
            if highlight.last_used_at and (
                not existing.last_used_at or highlight.last_used_at > existing.last_used_at
            ):
                existing.last_used_at = highlight.last_used_at
            reasons = {reason for reason in existing.reasons}
            reasons.update(highlight.reasons)
            existing.reasons = sorted(reason for reason in reasons if reason)
            if not existing.summary and highlight.summary:
                existing.summary = highlight.summary
        else:
            highlights[key] = highlight

    for item in items:
        base_ctx = _persona_context_from_meta(item.meta, default_ctx)
        potential = _memory_from_node(item, base_ctx)
        _ensure(potential)
        for edge in item.related:
            if not _is_memory_edge(edge):
                continue
            edge_ctx = _persona_context_from_meta(edge.meta or edge.node_meta, base_ctx)
            highlight = _memory_from_edge(item, edge, edge_ctx)
            _ensure(highlight)

    ordered = sorted(
        highlights.values(),
        key=lambda h: (_sort_key_ts(h.last_used_at), h.reuse_count),
        reverse=True,
    )
    return ordered[:limit]


def _build_next_actions_from_graph(
    items: Sequence[RagSearchItem],
    default_ctx: Optional[RagPersonaContext],
    *,
    limit: int,
) -> List[RagNextActionProposal]:
    proposals: Dict[str, RagNextActionProposal] = {}

    def _ensure(proposal: Optional[RagNextActionProposal]) -> None:
        if proposal is None:
            return
        key = (
            f"{proposal.playbook_id}:{proposal.title}"
            if proposal.playbook_id
            else f"{proposal.title}:{proposal.action}"
        )
        existing = proposals.get(key)
        if existing:
            existing.confidence = max(existing.confidence, proposal.confidence)
            if proposal.suggested_at and (
                not existing.suggested_at or proposal.suggested_at > existing.suggested_at
            ):
                existing.suggested_at = proposal.suggested_at
            existing.meta.update(proposal.meta)
        else:
            proposals[key] = proposal

    for item in items:
        base_ctx = _persona_context_from_meta(item.meta, default_ctx)
        if _is_trend_node(item.node_type, item.meta):
            proposal = _proposal_from_trend_node(item, base_ctx)
            _ensure(proposal)
        for edge in item.related:
            edge_ctx = _persona_context_from_meta(edge.meta or edge.node_meta, base_ctx)
            if _is_next_action_edge(edge):
                _ensure(_proposal_from_edge(item, edge, edge_ctx))
            elif _is_trend_edge(edge):
                _ensure(_proposal_from_trend_edge(edge, edge_ctx, source=item))

    ordered = sorted(
        proposals.values(),
        key=lambda p: (_sort_key_ts(p.suggested_at), p.confidence),
        reverse=True,
    )
    return ordered[:limit]


def _gather_trend_candidates(
    items: Sequence[RagSearchItem],
    default_ctx: Optional[RagPersonaContext],
) -> List[RagQuickstartTemplate]:
    templates: List[RagQuickstartTemplate] = []
    seen: Set[Any] = set()
    for item in items:
        ctx = _persona_context_from_meta(item.meta, default_ctx)
        if _is_trend_node(item.node_type, item.meta):
            key = item.node_id or item.title
            if key in seen:
                continue
            seen.add(key)
            templates.append(
                RagQuickstartTemplate(
                    title=item.title or item.summary or "Trend insight",
                    description=item.summary,
                    persona=ctx,
                    source_node_id=item.node_id,
                    query=_trend_followup_query(item.title or item.summary, ctx),
                )
            )
        for edge in item.related:
            if not _is_trend_edge(edge):
                continue
            combined_meta: Dict[str, Any] = {}
            if edge.node_meta:
                combined_meta.update(edge.node_meta)
            if edge.meta:
                combined_meta.update(edge.meta)
            edge_ctx = _persona_context_from_meta(combined_meta, ctx)
            key = edge.dst_node_id or (edge.title, edge.summary)
            if key in seen:
                continue
            seen.add(key)
            templates.append(
                RagQuickstartTemplate(
                    title=edge.title or combined_meta.get("title") or "Trend insight",
                    description=edge.summary or combined_meta.get("summary") or item.summary,
                    persona=edge_ctx,
                    source_node_id=edge.dst_node_id,
                    query=_trend_followup_query(edge.title or edge.summary, edge_ctx),
                )
            )
    return templates


def _memory_from_node(
    item: RagSearchItem,
    persona_ctx: Optional[RagPersonaContext],
) -> Optional[RagMemoryHighlight]:
    playbook_id = _extract_int(item.meta, ("playbook_id", "playbookId"))
    if playbook_id is None and item.node_type not in MEMORY_NODE_TYPES:
        return None
    return RagMemoryHighlight(
        playbook_id=playbook_id,
        persona=persona_ctx,
        node_id=item.node_id,
        title=item.title or item.summary or "Stored judgement",
        summary=item.summary,
        reuse_count=max(1, _extract_int(item.meta, ("reuse_count", "count"), default=1)),
        last_used_at=_parse_timestamp(
            item.meta.get("last_used_at")
            or item.meta.get("timestamp")
            or item.meta.get("updated_at")
        ),
        reasons=_extract_reasons(item.meta),
    )


def _memory_from_edge(
    item: RagSearchItem,
    edge: RagRelatedEdge,
    persona_ctx: Optional[RagPersonaContext],
) -> Optional[RagMemoryHighlight]:
    if not _is_memory_edge(edge):
        return None
    combined_meta: Dict[str, Any] = {}
    if edge.node_meta:
        combined_meta.update(edge.node_meta)
    if edge.meta:
        combined_meta.update(edge.meta)
    playbook_id = _extract_int(
        combined_meta,
        ("playbook_id", "playbookId"),
        fallback=_extract_int(item.meta, ("playbook_id", "playbookId")),
    )
    return RagMemoryHighlight(
        playbook_id=playbook_id,
        persona=persona_ctx,
        node_id=edge.dst_node_id or item.node_id,
        title=edge.title or item.title or "Reapplied judgement",
        summary=edge.summary or item.summary,
        reuse_count=max(
            1,
            _extract_int(
                combined_meta,
                ("reuse_count", "count"),
                default=_extract_int(item.meta, ("reuse_count", "count"), default=1),
            ),
        ),
        last_used_at=_parse_timestamp(
            combined_meta.get("last_used_at")
            or combined_meta.get("timestamp")
            or item.meta.get("last_used_at")
        ),
        reasons=_extract_reasons(combined_meta),
    )


def _proposal_from_trend_node(
    item: RagSearchItem,
    persona_ctx: Optional[RagPersonaContext],
) -> RagNextActionProposal:
    title = item.title or "Trend insight"
    return RagNextActionProposal(
        playbook_id=_extract_int(item.meta, ("playbook_id", "playbookId")),
        persona=persona_ctx,
        title=title,
        action=_trend_followup_query(title, persona_ctx),
        confidence=0.6,
        suggested_at=_parse_timestamp(
            item.meta.get("timestamp") or item.meta.get("last_used_at")
        ),
        meta=item.meta,
    )


def _proposal_from_edge(
    source: RagSearchItem,
    edge: RagRelatedEdge,
    persona_ctx: Optional[RagPersonaContext],
) -> RagNextActionProposal:
    meta = dict(edge.meta or {})
    title = meta.get("title") or edge.title or source.title or "Next action"
    action_text = (
        meta.get("action")
        or meta.get("cta")
        or meta.get("next_step")
        or _trend_followup_query(edge.title or title, persona_ctx)
    )
    confidence = max(0.0, min(_extract_float(meta, ("confidence", "score"), default=0.55), 1.0))
    return RagNextActionProposal(
        playbook_id=_extract_int(meta, ("playbook_id", "playbookId")),
        persona=persona_ctx,
        title=title,
        action=action_text,
        confidence=confidence,
        suggested_at=_parse_timestamp(meta.get("timestamp") or meta.get("suggested_at")),
        meta={**meta, "source_node_id": str(source.node_id)},
    )


def _proposal_from_trend_edge(
    edge: RagRelatedEdge,
    persona_ctx: Optional[RagPersonaContext],
    *,
    source: RagSearchItem,
) -> RagNextActionProposal:
    edge_meta = edge.meta or {}
    title = edge.title or edge_meta.get("title") or "Trend insight"
    return RagNextActionProposal(
        playbook_id=_extract_int(edge_meta, ("playbook_id", "playbookId")),
        persona=persona_ctx,
        title=title,
        action=_trend_followup_query(title, persona_ctx),
        confidence=0.58,
        suggested_at=_parse_timestamp(edge_meta.get("timestamp")),
        meta={
            **edge_meta,
            "source_node_id": str(source.node_id),
            "trend_node_id": str(edge.dst_node_id) if edge.dst_node_id else None,
        },
    )


def _trend_followup_query(
    title: Optional[str],
    persona_ctx: Optional[RagPersonaContext],
) -> str:
    persona_label = _persona_label(persona_ctx)
    topic = title or "this trend"
    return f"Draft the next post reacting to {topic} for {persona_label}"


def _is_memory_edge(edge: RagRelatedEdge) -> bool:
    event = (edge.meta or {}).get("event")
    return (edge.edge_type in MEMORY_EDGE_TYPES) or (event in MEMORY_EDGE_TYPES)


def _is_next_action_edge(edge: RagRelatedEdge) -> bool:
    event = (edge.meta or {}).get("event")
    return (edge.edge_type in NEXT_ACTION_EDGE_TYPES) or (event in NEXT_ACTION_EDGE_TYPES)


def _is_trend_edge(edge: RagRelatedEdge) -> bool:
    if edge.edge_type in TREND_EDGE_TYPES:
        return True
    if edge.node_type and edge.node_type.lower() in TREND_NODE_TYPES:
        return True
    node_theme = (edge.node_meta or {}).get("theme") if edge.node_meta else None
    return isinstance(node_theme, str) and "trend" in node_theme.lower()


def _is_trend_node(node_type: Optional[str], meta: Optional[Dict[str, Any]]) -> bool:
    if node_type and node_type.lower() in TREND_NODE_TYPES:
        return True
    if not meta:
        return False
    theme = meta.get("theme") or meta.get("category")
    if isinstance(theme, str) and "trend" in theme.lower():
        return True
    return bool(meta.get("is_trend"))


def _persona_context_from_meta(
    meta: Optional[Dict[str, Any]],
    fallback: Optional[RagPersonaContext],
) -> Optional[RagPersonaContext]:
    if not meta:
        return fallback
    persona_id = _extract_int(meta, ("persona_id", "personaId"))
    campaign_id = _extract_int(meta, ("campaign_id", "campaignId"))
    persona_name = meta.get("persona_name") or meta.get("personaName")
    campaign_name = meta.get("campaign_name") or meta.get("campaignName")
    if not any([persona_id, campaign_id, persona_name, campaign_name]):
        return fallback
    return RagPersonaContext(
        persona_id=persona_id or (fallback.persona_id if fallback else None),
        persona_name=persona_name or (fallback.persona_name if fallback else None),
        campaign_id=campaign_id or (fallback.campaign_id if fallback else None),
        campaign_name=campaign_name or (fallback.campaign_name if fallback else None),
    )


def _extract_reasons(meta: Optional[Dict[str, Any]]) -> List[str]:
    reasons: List[str] = []
    if not meta:
        return reasons
    for key in ("reason", "why", "insight"):
        value = meta.get(key)
        if isinstance(value, str):
            reasons.append(value)
    value = meta.get("reasons")
    if isinstance(value, list):
        reasons.extend(str(item) for item in value if item)
    return list(dict.fromkeys(reason for reason in reasons if reason))


def _extract_int(
    meta: Optional[Dict[str, Any]],
    keys: Sequence[str],
    *,
    default: Optional[int] = None,
    fallback: Optional[int] = None,
) -> Optional[int]:
    if meta:
        for key in keys:
            value = meta.get(key)
            if value is None:
                continue
            try:
                return int(value)
            except (TypeError, ValueError):
                continue
    return fallback if fallback is not None else default


def _extract_float(
    meta: Optional[Dict[str, Any]],
    keys: Sequence[str],
    *,
    default: float = 0.0,
) -> float:
    if meta:
        for key in keys:
            value = meta.get(key)
            if value is None:
                continue
            try:
                return float(value)
            except (TypeError, ValueError):
                continue
    return default


def _parse_timestamp(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value)
        except (OverflowError, OSError, ValueError):
            return None
    if isinstance(value, str):
        for candidate in (value, value.replace("Z", "+00:00")):
            try:
                return datetime.fromisoformat(candidate)
            except ValueError:
                continue
    return None


def _sort_key_ts(value: Optional[datetime]) -> float:
    if isinstance(value, datetime):
        try:
            return value.timestamp()
        except (OverflowError, OSError):
            return float("-inf")
    return float("-inf")


def _estimate_roi(
    memory_highlights: Sequence[RagMemoryHighlight],
    next_actions: Sequence[RagNextActionProposal],
    persona_ctx: Optional[RagPersonaContext],
) -> Optional[RagValueInsight]:
    if not memory_highlights and not next_actions:
        return None
    reuse_total = sum(max(0, highlight.reuse_count) for highlight in memory_highlights)
    automation_total = len(next_actions)
    saved_minutes = reuse_total * 5 + automation_total * 10
    total = reuse_total + automation_total
    ai_rate = round((reuse_total / total) if total else 0.0, 2)
    return RagValueInsight(
        persona=persona_ctx,
        memory_reuse_count=reuse_total,
        automated_decisions=automation_total,
        saved_minutes=saved_minutes,
        ai_intervention_rate=ai_rate,
    )
__all__ = ["BffRagSearchPayload", "RagSearchResponse", "BffRagExpandPayload"]

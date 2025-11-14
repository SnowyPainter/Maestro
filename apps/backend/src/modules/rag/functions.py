from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Sequence, Set

from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.accounts.service import get_persona
from apps.backend.src.modules.campaigns.service import get_campaign
from apps.backend.src.modules.rag.schemas import (
    RagMemoryHighlight,
    RagNextActionProposal,
    RagPersonaContext,
    RagQuickstartTemplate,
    RagRelatedEdge,
    RagSearchItem,
    RagValueInsight,
)
from apps.backend.src.modules.rag.utils import (
    extract_float,
    extract_int,
    extract_reasons,
    parse_timestamp,
    payload_to_dict,
    persona_context_from_meta,
    persona_label,
    sort_key_ts,
)

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


async def resolve_persona_context(
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


def resolve_sections(
    *,
    mode: RagSearchMode,
    include_quickstart: bool,
    include_memory: bool,
    include_next_actions: bool,
    include_roi: bool,
) -> Set[str]:
    sections: Set[str] = set()
    if include_quickstart:
        sections.add("quickstart")
    if include_memory:
        sections.add("memory")
    if include_next_actions:
        sections.add("next_actions")
    if include_roi:
        sections.add("roi")

    mode_overrides = {
        "quickstart": {"quickstart", "memory", "next_actions", "roi"},
        "memory": {"memory", "roi"},
        "next_action": {"next_actions", "roi"},
    }
    sections.update(mode_overrides.get(mode, set()))
    return sections


def fallback_query_for_mode(mode: RagSearchMode, ctx: Optional[RagPersonaContext]) -> str:
    persona = persona_label(ctx)
    if mode == "quickstart":
        return f"Latest cultural or product trends {persona} should react to this week"
    if mode == "memory":
        return f"{persona} judgements that worked well before"
    if mode == "next_action":
        return f"Next best action for {persona}"
    return ""


def rag_mode_config(
    *,
    mode: RagSearchMode,
    include_quickstart: bool = False,
    include_memory: bool = False,
    include_next_actions: bool = False,
    include_roi: bool = False,
    default_query: Optional[str] = None,
    min_limit: Optional[int] = None,
) -> Dict[str, Any]:
    def _factory(_state: Any, payload: Any) -> Dict[str, Any]:
        data = payload_to_dict(payload)
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


def build_quickstart_templates(
    query_text: str,
    persona_ctx: Optional[RagPersonaContext],
    items: Sequence[RagSearchItem],
    limit: int,
) -> List[RagQuickstartTemplate]:
    templates: List[RagQuickstartTemplate] = []
    persona = persona_label(persona_ctx)
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
                persona=persona_context_from_meta(item.meta, persona_ctx),
                source_node_id=item.node_id,
                query=f"Reuse '{item.title or 'this judgement'}' for {persona}",
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
                query=query_text or f"What recent win can {persona} reshare?",
            )
        )
    return templates


def build_memory_highlights_from_graph(
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
        base_ctx = persona_context_from_meta(item.meta, default_ctx)
        potential = _memory_from_node(item, base_ctx)
        _ensure(potential)
        for edge in item.related:
            if not _is_memory_edge(edge):
                continue
            edge_ctx = persona_context_from_meta(edge.meta or edge.node_meta, base_ctx)
            highlight = _memory_from_edge(item, edge, edge_ctx)
            _ensure(highlight)

    ordered = sorted(
        highlights.values(),
        key=lambda h: (sort_key_ts(h.last_used_at), h.reuse_count),
        reverse=True,
    )
    return ordered[:limit]


def build_next_actions_from_graph(
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
        base_ctx = persona_context_from_meta(item.meta, default_ctx)
        if _is_trend_node(item.node_type, item.meta):
            proposal = _proposal_from_trend_node(item, base_ctx)
            _ensure(proposal)
        for edge in item.related:
            edge_ctx = persona_context_from_meta(edge.meta or edge.node_meta, base_ctx)
            if _is_next_action_edge(edge):
                _ensure(_proposal_from_edge(item, edge, edge_ctx))
            elif _is_trend_edge(edge):
                _ensure(_proposal_from_trend_edge(edge, edge_ctx, source=item))

    ordered = sorted(
        proposals.values(),
        key=lambda p: (sort_key_ts(p.suggested_at), p.confidence),
        reverse=True,
    )
    return ordered[:limit]


def estimate_roi(
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


def _gather_trend_candidates(
    items: Sequence[RagSearchItem],
    default_ctx: Optional[RagPersonaContext],
) -> List[RagQuickstartTemplate]:
    templates: List[RagQuickstartTemplate] = []
    seen: Set[Any] = set()
    for item in items:
        ctx = persona_context_from_meta(item.meta, default_ctx)
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
            edge_ctx = persona_context_from_meta(combined_meta, ctx)
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
    playbook_id = extract_int(item.meta, ("playbook_id", "playbookId"))
    if playbook_id is None and item.node_type not in MEMORY_NODE_TYPES:
        return None
    return RagMemoryHighlight(
        playbook_id=playbook_id,
        persona=persona_ctx,
        node_id=item.node_id,
        title=item.title or item.summary or "Stored judgement",
        summary=item.summary,
        reuse_count=max(1, extract_int(item.meta, ("reuse_count", "count"), default=1)),
        last_used_at=parse_timestamp(
            item.meta.get("last_used_at")
            or item.meta.get("timestamp")
            or item.meta.get("updated_at")
        ),
        reasons=extract_reasons(item.meta),
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
    playbook_id = extract_int(
        combined_meta,
        ("playbook_id", "playbookId"),
        fallback=extract_int(item.meta, ("playbook_id", "playbookId")),
    )
    return RagMemoryHighlight(
        playbook_id=playbook_id,
        persona=persona_ctx,
        node_id=edge.dst_node_id or item.node_id,
        title=edge.title or item.title or "Reapplied judgement",
        summary=edge.summary or item.summary,
        reuse_count=max(
            1,
            extract_int(
                combined_meta,
                ("reuse_count", "count"),
                default=extract_int(item.meta, ("reuse_count", "count"), default=1),
            ),
        ),
        last_used_at=parse_timestamp(
            combined_meta.get("last_used_at")
            or combined_meta.get("timestamp")
            or item.meta.get("last_used_at")
        ),
        reasons=extract_reasons(combined_meta),
    )


def _proposal_from_trend_node(
    item: RagSearchItem,
    persona_ctx: Optional[RagPersonaContext],
) -> RagNextActionProposal:
    title = item.title or "Trend insight"
    return RagNextActionProposal(
        playbook_id=extract_int(item.meta, ("playbook_id", "playbookId")),
        persona=persona_ctx,
        title=title,
        action=_trend_followup_query(title, persona_ctx),
        confidence=0.62,
        suggested_at=parse_timestamp(item.meta.get("timestamp") or item.meta.get("updated_at")),
        meta={**(item.meta or {}), "source_node_id": str(item.node_id)},
    )


def _proposal_from_edge(
    source: RagSearchItem,
    edge: RagRelatedEdge,
    persona_ctx: Optional[RagPersonaContext],
) -> Optional[RagNextActionProposal]:
    meta = edge.meta or {}
    title = edge.title or meta.get("title") or "Next best action"
    action_text = meta.get("action") or meta.get("proposal") or edge.summary or title
    confidence = max(0.0, min(extract_float(meta, ("confidence", "score"), default=0.55), 1.0))
    return RagNextActionProposal(
        playbook_id=extract_int(meta, ("playbook_id", "playbookId")),
        persona=persona_ctx,
        title=title,
        action=action_text,
        confidence=confidence,
        suggested_at=parse_timestamp(meta.get("timestamp") or meta.get("suggested_at")),
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
        playbook_id=extract_int(edge_meta, ("playbook_id", "playbookId")),
        persona=persona_ctx,
        title=title,
        action=_trend_followup_query(title, persona_ctx),
        confidence=0.58,
        suggested_at=parse_timestamp(edge_meta.get("timestamp")),
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
    persona = persona_label(persona_ctx)
    topic = title or "this trend"
    return f"Draft the next post reacting to {topic} for {persona}"


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


__all__ = [
    "RagSearchMode",
    "resolve_persona_context",
    "resolve_sections",
    "fallback_query_for_mode",
    "rag_mode_config",
    "build_quickstart_templates",
    "build_memory_highlights_from_graph",
    "build_next_actions_from_graph",
    "estimate_roi",
]

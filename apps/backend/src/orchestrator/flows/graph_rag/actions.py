from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.core.context import get_persona_account_id
from apps.backend.src.modules.accounts.service import get_persona_account
from apps.backend.src.modules.drafts.schemas import BlockText, DraftIR, DraftSaveRequest
from apps.backend.src.modules.drafts.service import create_draft
from apps.backend.src.modules.llm.schemas import (
    DraftFromTrendOutput,
    LlmResult,
    PromptKey,
    PromptVars,
)
from apps.backend.src.modules.llm.service import LLMService
from apps.backend.src.modules.playbooks.service import get_playbook, record_playbook_event
from apps.backend.src.modules.rag.events import GraphRagRefreshEvent, publish_graph_rag_refresh
from apps.backend.src.modules.rag.schemas import (
    GraphRagActionResult,
    GraphRagNextActionCommand,
    GraphRagActionAudit,
    GraphRagActionIntent,
    GraphRagPersonaFocusCommand,
    GraphRagPlaybookActionCommand,
    GraphRagTrendActionCommand,
)
from apps.backend.src.modules.trends.schemas import TrendItem
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.adapters.utils import build_persona_brief, _ensure_draft_ir_props
from apps.backend.src.orchestrator.flows.graph_rag.action_result import (
    build_action_result,
    elapsed_ms,
    make_refresh_targets,
)
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator

import logging
from apps.backend.src.core.logging import setup_logging

setup_logging()

logger = logging.getLogger(__name__)


class GraphRagActionAck(GraphRagActionResult):
    pass


def _publish_refresh(persona_id: Optional[int], campaign_id: Optional[int], *, trigger: str) -> None:
    publish_graph_rag_refresh(
        GraphRagRefreshEvent(
            trigger=trigger,
            persona_id=persona_id,
            campaign_id=campaign_id,
        )
    )


async def _resolve_persona_context(
    db: AsyncSession,
    payload_persona_id: Optional[int],
) -> tuple[Optional[int], Optional[int]]:
    persona_id = payload_persona_id
    persona_account_id: Optional[int] = None

    raw_ctx_persona_account = get_persona_account_id()
    if raw_ctx_persona_account:
        try:
            persona_account_id = int(raw_ctx_persona_account)
        except (TypeError, ValueError):
            persona_account_id = None

    if persona_id is None and persona_account_id is not None:
        account = await get_persona_account(db, persona_account_id=persona_account_id)
        if account is not None:
            persona_id = account.persona_id

    return persona_id, persona_account_id


@operator(
    key="graph_rag.actions.trend_to_draft",
    title="Create draft from Graph RAG trend",
    side_effect="write",
)
async def op_graph_rag_trend_to_draft(payload: GraphRagTrendActionCommand, ctx: TaskContext) -> GraphRagActionResult:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    started = time.perf_counter()

    persona_id, persona_account_id = await _resolve_persona_context(db, payload.persona_id)

    persona_brief = await build_persona_brief(
        {
            "persona_id": persona_id,
            "persona_account_id": persona_account_id,
        }
    )

    trend_item = TrendItem.model_validate(
        {
            "rank": 1,
            "retrieved": datetime.now(timezone.utc).isoformat(),
            "title": payload.title,
            "approx_traffic": None,
            "summary": payload.description or payload.query,
            "source_query": payload.query,
            "source_node_id": str(payload.source_node_id) if payload.source_node_id else None,
        }
    )

    prompt_vars = PromptVars(
        trend_data=[trend_item],
        tone=(persona_brief or {}).get("tone"),
        goal="engagement",
        text=payload.description or payload.query,
        persona_brief=persona_brief or {},
    )

    llm_output: Optional[DraftFromTrendOutput] = None
    audit: Optional[GraphRagActionAudit] = None
    try:
        result_dict = await LLMService.instance().ainvoke(
            PromptKey.DRAFT_FROM_TREND,
            prompt_vars,
            session=db,
        )
        if isinstance(result_dict, dict) and result_dict.get("error"):
            logger.warning("LLM draft generation returned error", extra=result_dict)
        else:
            llm_result = LlmResult.model_validate(result_dict)
            llm_output = DraftFromTrendOutput.model_validate(llm_result.data)
            llm_output.draft_ir = _ensure_draft_ir_props(llm_output.draft_ir)
            audit = GraphRagActionAudit(
                llm_model=llm_result.model,
                llm_usage_id=(llm_result.meta or {}).get("usage_id"),
                tokens_prompt=llm_result.tokens_prompt,
                tokens_completion=llm_result.tokens_completion,
                cost_usd=llm_result.cost_usd,
                latency_ms=llm_result.latency_ms,
            )
    except Exception:
        logger.exception("Failed to generate draft via LLM for graph_rag trend")

    if llm_output:
        ir = llm_output.draft_ir
        draft_title = llm_output.title or payload.title
        reason = "LLM draft.from_trend"
    else:
        ir = DraftIR(
            blocks=[
                BlockText(
                    type="text",
                    props={
                        "markdown": "\n\n".join(
                            [
                                f"## {payload.title}",
                                payload.description or "",
                                f"_Trend query_: {payload.query}",
                            ]
                        ).strip(),
                    },
                )
            ],
            options={},
        )
        draft_title = payload.title
        reason = "fallback_markdown"

    logger.info(f"persona_id: {persona_id}, persona_account_id: {persona_account_id}")
    logger.info(f"payload: {payload}")

    draft_request = DraftSaveRequest(
        campaign_id=payload.campaign_id,
        title=draft_title,
        goal="Graph RAG trend follow-up",
        tags=["graph_rag", "trend"],
        ir=ir,
    )
    draft = await create_draft(
        db,
        user_id=user.id,
        created_by=user.id,
        payload=draft_request,
    )

    playbook_log_id = None
    if persona_id and payload.campaign_id:
        log = await record_playbook_event(
            db,
            event="graph_rag.trend_to_draft",
            persona_id=persona_id,
            persona_account_id=persona_account_id,
            campaign_id=payload.campaign_id,
            draft_id=draft.id,
            message=payload.title,
            meta={
                "trend_query": payload.query,
                "trend_description": payload.description,
                "source_node_id": str(payload.source_node_id) if payload.source_node_id else None,
            },
        )
        await db.commit()
        playbook_log_id = getattr(log, "id", None)

    _publish_refresh(persona_id, payload.campaign_id, trigger="trend_to_draft")
    return build_action_result(
        status="draft_created",
        message=f"Draft #{draft.id} created from trend",
        action_key="graph_rag.actions.trend_to_draft",
        intent="trend_followup",
        inputs={
            "persona_id": persona_id,
            "persona_account_id": persona_account_id,
            "campaign_id": payload.campaign_id,
            "query": payload.query,
            "source_node_id": str(payload.source_node_id) if payload.source_node_id else None,
        },
        outputs={
            "draft_id": draft.id,
            "playbook_log_id": playbook_log_id,
        },
        reason=reason,
        timing_ms=elapsed_ms(started),
        refresh=make_refresh_targets(persona_id, payload.campaign_id),
        audit=audit,
        dedupe_signature=f"trend_to_draft:{payload.source_node_id or payload.query}:{draft_title}",
    )


@operator(
    key="graph_rag.actions.next_action",
    title="Apply Graph RAG next action",
    side_effect="write",
)
async def op_graph_rag_next_action(payload: GraphRagNextActionCommand, ctx: TaskContext) -> GraphRagActionResult:
    db: AsyncSession = ctx.require(AsyncSession)
    started = time.perf_counter()

    persona_id, persona_account_id = await _resolve_persona_context(db, payload.persona_id)
    log = await record_playbook_event(
        db,
        event="graph_rag.next_action",
        persona_id=persona_id,
        persona_account_id=persona_account_id,
        campaign_id=payload.campaign_id,
        message=payload.title,
        meta={
            "playbook_id": payload.playbook_id,
            "action": payload.action,
            "source_node_id": str(payload.source_node_id) if payload.source_node_id else None,
            "confidence": payload.confidence,
        },
    )

    _publish_refresh(persona_id, payload.campaign_id, trigger="next_action")
    return build_action_result(
        status="logged",
        message="Next action recorded",
        action_key="graph_rag.actions.next_action",
        intent="next_action",
        inputs={
            "persona_id": persona_id,
            "persona_account_id": persona_account_id,
            "campaign_id": payload.campaign_id,
            "playbook_id": payload.playbook_id,
            "source_node_id": str(payload.source_node_id) if payload.source_node_id else None,
        },
        outputs={"playbook_log_id": getattr(log, "id", None)},
        confidence=payload.confidence,
        timing_ms=elapsed_ms(started),
        refresh=make_refresh_targets(persona_id, payload.campaign_id),
        dedupe_signature=f"next_action:{payload.playbook_id}:{payload.title}",
    )


@operator(
    key="graph_rag.actions.playbook_reapply",
    title="Reapply Graph RAG playbook",
    side_effect="write",
)
async def op_graph_rag_playbook_reapply(payload: GraphRagPlaybookActionCommand, ctx: TaskContext) -> GraphRagActionResult:
    db: AsyncSession = ctx.require(AsyncSession)
    started = time.perf_counter()

    persona_id, persona_account_id = await _resolve_persona_context(db, payload.persona_id)
    campaign_id = payload.campaign_id

    if payload.playbook_id and (campaign_id is None or persona_id is None):
        playbook = await get_playbook(db, payload.playbook_id)
        if playbook is not None:
            if campaign_id is None:
                campaign_id = playbook.campaign_id
            if persona_id is None:
                persona_id = playbook.persona_id

    log = await record_playbook_event(
        db,
        event="graph_rag.playbook_reapply",
        persona_id=persona_id,
        persona_account_id=persona_account_id,
        campaign_id=campaign_id,
        message=payload.title or "Graph RAG memory highlight",
        meta={
            "playbook_id": payload.playbook_id,
            "summary": payload.summary,
            "reuse_count": payload.reuse_count,
            "node_id": str(payload.node_id) if payload.node_id else None,
        },
    )
    await db.commit()
    _publish_refresh(persona_id, campaign_id, trigger="playbook_reapply")
    return build_action_result(
        status="logged",
        message="Playbook reuse logged",
        action_key="graph_rag.actions.playbook_reapply",
        intent="playbook_reuse",
        inputs={
            "persona_id": persona_id,
            "persona_account_id": persona_account_id,
            "campaign_id": campaign_id,
            "playbook_id": payload.playbook_id,
            "node_id": str(payload.node_id) if payload.node_id else None,
        },
        outputs={"playbook_log_id": getattr(log, "id", None)},
        reason="reuse_memory_highlight",
        timing_ms=elapsed_ms(started),
        refresh=make_refresh_targets(persona_id, campaign_id),
        dedupe_signature=f"playbook_reapply:{payload.playbook_id or payload.node_id}",
    )


@operator(
    key="graph_rag.actions.persona_focus",
    title="Record Graph RAG persona focus",
    side_effect="write",
)
async def op_graph_rag_persona_focus(payload: GraphRagPersonaFocusCommand, ctx: TaskContext) -> GraphRagActionResult:
    db: AsyncSession = ctx.require(AsyncSession)
    started = time.perf_counter()

    persona_id, persona_account_id = await _resolve_persona_context(db, payload.persona_id)
    roi = payload.roi
    meta = {
        "focus_query": payload.focus_query,
    }
    if roi:
        meta.update(
            {
                "memory_reuse_count": roi.memory_reuse_count,
                "automated_decisions": roi.automated_decisions,
                "saved_minutes": roi.saved_minutes,
                "ai_intervention_rate": roi.ai_intervention_rate,
            }
        )

    log = await record_playbook_event(
        db,
        event="graph_rag.persona_focus",
        persona_id=persona_id,
        persona_account_id=persona_account_id,
        campaign_id=payload.campaign_id,
        message=f"Focus on {payload.focus_query}",
        meta=meta,
    )
    _publish_refresh(persona_id, payload.campaign_id, trigger="persona_focus")
    return build_action_result(
        status="logged",
        message="Persona focus recorded",
        action_key="graph_rag.actions.persona_focus",
        intent="persona_focus",
        inputs={
            "persona_id": persona_id,
            "persona_account_id": persona_account_id,
            "campaign_id": payload.campaign_id,
            "focus_query": payload.focus_query,
        },
        outputs={"playbook_log_id": getattr(log, "id", None)},
        reason="record_focus_area",
        timing_ms=elapsed_ms(started),
        refresh=make_refresh_targets(persona_id, payload.campaign_id),
        dedupe_signature=f"persona_focus:{payload.focus_query}:{payload.campaign_id}",
    )


def _simple_flow(
    *,
    key: str,
    title: str,
    description: str,
    path: str,
    input_model: type[BaseModel],
):
    @FLOWS.flow(
        key=key,
        title=title,
        description=description,
        input_model=input_model,
        output_model=GraphRagActionAck,
        method="POST",
        path=path,
        tags=("action", "graph_rag", "actions", key),
    )
    def _build(builder: FlowBuilder):
        task = builder.task(key, key)
        builder.expect_terminal(task)


_simple_flow(
    key="graph_rag.actions.trend_to_draft",
    title="Create draft from Graph RAG trend",
    description="Spin up a new draft using a trend suggestion",
    path="/graph-rag/actions/trend-to-draft",
    input_model=GraphRagTrendActionCommand,
)

_simple_flow(
    key="graph_rag.actions.next_action",
    title="Apply Graph RAG next action",
    description="Record or apply the next recommended action",
    path="/graph-rag/actions/next-action",
    input_model=GraphRagNextActionCommand,
)

_simple_flow(
    key="graph_rag.actions.playbook_reapply",
    title="Reapply Graph RAG playbook",
    description="Log the reuse of a highlighted playbook",
    path="/graph-rag/actions/playbook-reapply",
    input_model=GraphRagPlaybookActionCommand,
)

_simple_flow(
    key="graph_rag.actions.persona_focus",
    title="Record Graph RAG focus",
    description="Capture a focus insight for the persona/campaign",
    path="/graph-rag/actions/persona-focus",
    input_model=GraphRagPersonaFocusCommand,
)


__all__ = [
    "op_graph_rag_trend_to_draft",
    "op_graph_rag_next_action",
    "op_graph_rag_playbook_reapply",
    "op_graph_rag_persona_focus",
]

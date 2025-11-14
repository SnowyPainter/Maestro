from __future__ import annotations

from typing import Optional

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.drafts.schemas import BlockText, DraftIR, DraftSaveRequest
from apps.backend.src.modules.drafts.service import create_draft
from apps.backend.src.modules.playbooks.service import record_playbook_event
from apps.backend.src.modules.rag.events import GraphRagRefreshEvent, publish_graph_rag_refresh
from apps.backend.src.modules.rag.schemas import (
    GraphRagActionResult,
    GraphRagNextActionCommand,
    GraphRagPersonaFocusCommand,
    GraphRagPlaybookActionCommand,
    GraphRagTrendActionCommand,
)
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


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


@operator(
    key="graph_rag.actions.trend_to_draft",
    title="Create draft from Graph RAG trend",
    side_effect="write",
)
async def op_graph_rag_trend_to_draft(payload: GraphRagTrendActionCommand, ctx: TaskContext) -> GraphRagActionResult:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

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
    draft_request = DraftSaveRequest(
        campaign_id=payload.campaign_id,
        title=payload.title,
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
    _publish_refresh(payload.persona_id, payload.campaign_id, trigger="trend_to_draft")
    return GraphRagActionResult(
        status="draft_created",
        message=f"Draft #{draft.id} created from trend",
        meta={"draft_id": draft.id},
    )


@operator(
    key="graph_rag.actions.next_action",
    title="Apply Graph RAG next action",
    side_effect="write",
)
async def op_graph_rag_next_action(payload: GraphRagNextActionCommand, ctx: TaskContext) -> GraphRagActionResult:
    db: AsyncSession = ctx.require(AsyncSession)

    log = await record_playbook_event(
        db,
        event="graph_rag.next_action",
        persona_id=payload.persona_id,
        campaign_id=payload.campaign_id,
        playbook_id=payload.playbook_id,
        message=payload.title,
        meta={
            "action": payload.action,
            "source_node_id": str(payload.source_node_id) if payload.source_node_id else None,
            "confidence": payload.confidence,
        },
    )
    _publish_refresh(payload.persona_id, payload.campaign_id, trigger="next_action")
    return GraphRagActionResult(
        status="logged",
        message="Next action recorded",
        meta={"playbook_log_id": getattr(log, "id", None)},
    )


@operator(
    key="graph_rag.actions.playbook_reapply",
    title="Reapply Graph RAG playbook",
    side_effect="write",
)
async def op_graph_rag_playbook_reapply(payload: GraphRagPlaybookActionCommand, ctx: TaskContext) -> GraphRagActionResult:
    db: AsyncSession = ctx.require(AsyncSession)

    log = await record_playbook_event(
        db,
        event="graph_rag.playbook_reapply",
        persona_id=payload.persona_id,
        campaign_id=payload.campaign_id,
        playbook_id=payload.playbook_id,
        message=payload.title or "Graph RAG memory highlight",
        meta={
            "summary": payload.summary,
            "reuse_count": payload.reuse_count,
            "node_id": str(payload.node_id) if payload.node_id else None,
        },
    )
    _publish_refresh(payload.persona_id, payload.campaign_id, trigger="playbook_reapply")
    return GraphRagActionResult(
        status="logged",
        message="Playbook reuse logged",
        meta={"playbook_log_id": getattr(log, "id", None)},
    )


@operator(
    key="graph_rag.actions.persona_focus",
    title="Record Graph RAG persona focus",
    side_effect="write",
)
async def op_graph_rag_persona_focus(payload: GraphRagPersonaFocusCommand, ctx: TaskContext) -> GraphRagActionResult:
    db: AsyncSession = ctx.require(AsyncSession)

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
        persona_id=payload.persona_id,
        campaign_id=payload.campaign_id,
        message=f"Focus on {payload.focus_query}",
        meta=meta,
    )
    _publish_refresh(payload.persona_id, payload.campaign_id, trigger="persona_focus")
    return GraphRagActionResult(
        status="logged",
        message="Persona focus recorded",
        meta={"playbook_log_id": getattr(log, "id", None)},
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

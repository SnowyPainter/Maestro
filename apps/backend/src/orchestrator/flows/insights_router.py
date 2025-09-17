"""Insights orchestration flows."""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.insights.schemas import InsightIn, InsightOut
from apps.backend.src.modules.insights.service import ingest_insight_sample
from apps.backend.src.modules.users.models import User

from apps.backend.src.orchestrator.dispatch import TaskContext, orchestrate_flow, runtime_dependency
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


class InsightInCommand(InsightIn):
    owner_user_id: Optional[int] = None


def _model_dump(model: BaseModel) -> dict:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


@operator(
    key="insights.ingest",
    title="Ingest insight sample",
    side_effect="write",
)
async def op_ingest_insight(payload: InsightInCommand, ctx: TaskContext) -> InsightOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    data = InsightIn(owner_user_id=user.id, **_model_dump(payload))
    sample = await ingest_insight_sample(db, data)
    if not sample:
        raise HTTPException(status_code=500, detail="Failed to ingest insight sample")
    return InsightOut.model_validate(sample)


@FLOWS.flow(
    key="insights.ingest",
    title="Process and Store Insight Data",
    description="Ingest new insight data for analysis and trend detection",
    input_model=InsightInCommand,
    output_model=InsightOut,
    method="post",
    path="/insights",
    tags=("insights", "data", "analytics", "ingestion", "processing"),
)
def _flow_ingest_insight(builder: FlowBuilder):
    task = builder.task("ingest_insight", "insights.ingest")
    builder.expect_terminal(task)


router = FLOWS.build_router(
    orchestrate_flow,
    prefix="",
    tags=["insights"],
    runtime_dependency=runtime_dependency,
    flow_filter=lambda flow: "insights" in flow.tags,
)


__all__ = ["router"]


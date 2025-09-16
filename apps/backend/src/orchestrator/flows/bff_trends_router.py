"""BFF read flows for trends resources."""

from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.trends.schemas import TrendsListResponse, TrendItem
from apps.backend.src.modules.trends.service import query_trends

from apps.backend.src.orchestrator.dispatch import (
    TaskContext,
    orchestrate_flow,
    runtime_dependency,
)
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


class TrendsQueryPayload(BaseModel):
    country: str = "US"
    limit: int = 20
    q: Optional[str] = None
    on_date: Optional[date] = None
    since: Optional[date] = None
    until: Optional[date] = None


@operator(
    key="bff.trends.list_trends",
    title="BFF List Trends",
    side_effect="read",
)
async def op_list_trends(payload: TrendsQueryPayload, ctx: TaskContext) -> TrendsListResponse:
    db: AsyncSession = ctx.require(AsyncSession)
    if payload.on_date is None and payload.since and payload.until and payload.since > payload.until:
        raise HTTPException(status_code=422, detail="since must be <= until")
    result = await query_trends(
        db,
        country=payload.country,
        limit=payload.limit,
        q=payload.q,
        on_date=payload.on_date,
        since=payload.since,
        until=payload.until,
    )
    items = [TrendItem.model_validate(obj) for obj in result["rows"]]
    return TrendsListResponse(
        country=payload.country.upper(),
        query=payload.q,
        items=items,
        source=result["source"],
    )


@FLOWS.flow(
    key="bff.trends.list_trends",
    title="BFF List Trends",
    input_model=TrendsQueryPayload,
    output_model=TrendsListResponse,
    method="get",
    path="/trends",
    tags=("bff", "trends"),
)
def _flow_bff_list_trends(builder: FlowBuilder):
    task = builder.task("list_trends", "bff.trends.list_trends")
    builder.expect_terminal(task)


__all__ = []


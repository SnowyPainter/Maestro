"""BFF flows exposing AB test data for frontend consumption."""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.abtests.schemas import ABTestFilter, ABTestListResponse, ABTestOut
from apps.backend.src.modules.abtests.service import get_abtest, list_abtests
from apps.backend.src.modules.accounts.service import get_persona
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


class ABTestListPayload(BaseModel):
    persona_id: Optional[int] = None
    campaign_id: Optional[int] = None
    active_only: bool = False
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class ABTestReadPayload(BaseModel):
    abtest_id: int


@operator(
    key="bff.abtests.list",
    title="BFF List AB Tests",
    side_effect="read",
)
async def op_list_abtests(
    payload: ABTestListPayload,
    ctx: TaskContext,
) -> ABTestListResponse:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    filters = ABTestFilter(
        persona_id=payload.persona_id,
        campaign_id=payload.campaign_id,
        active_only=payload.active_only,
    )
    rows, total = await list_abtests(
        db,
        filters=filters,
        owner_user_id=user.id,
        limit=payload.limit,
        offset=payload.offset,
    )
    items = [ABTestOut.model_validate(row) for row in rows]
    return ABTestListResponse(items=items, total=total)


@operator(
    key="bff.abtests.read",
    title="BFF Read AB Test",
    side_effect="read",
)
async def op_read_abtest(
    payload: ABTestReadPayload,
    ctx: TaskContext,
) -> ABTestOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    abtest = await get_abtest(db, payload.abtest_id)
    if abtest is None:
        raise HTTPException(status_code=404, detail="AB test not found")

    persona = await get_persona(db, persona_id=abtest.persona_id, owner_user_id=user.id)
    if persona is None:
        raise HTTPException(status_code=403, detail="Not authorized to view AB test")

    return ABTestOut.model_validate(abtest)


@FLOWS.flow(
    key="bff.abtests.list",
    title="List AB Tests",
    description="List AB tests for the authenticated user",
    input_model=ABTestListPayload,
    output_model=ABTestListResponse,
    method="get",
    path="/abtests",
    tags=("bff", "abtests", "list", "read"),
)
def _flow_bff_list_abtests(builder: FlowBuilder) -> None:
    task = builder.task("list_abtests", "bff.abtests.list")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.abtests.read",
    title="Read AB Test",
    description="Get detailed AB test information",
    input_model=ABTestReadPayload,
    output_model=ABTestOut,
    method="get",
    path="/abtests/{abtest_id}",
    tags=("bff", "abtests", "read"),
)
def _flow_bff_read_abtest(builder: FlowBuilder) -> None:
    task = builder.task("read_abtest", "bff.abtests.read")
    builder.expect_terminal(task)


__all__ = [
    "ABTestListPayload",
    "ABTestReadPayload",
    "op_list_abtests",
    "op_read_abtest",
]

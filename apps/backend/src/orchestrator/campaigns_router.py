"""Campaign orchestration flows."""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.campaigns.schemas import (
    CampaignCreate,
    CampaignKPIDefOut,
    CampaignKPIDefUpsert,
    CampaignKPIResultOut,
    CampaignOut,
    CampaignUpdate,
)
from apps.backend.src.modules.campaigns.service import (
    aggregate_campaign_kpis_respecting_defs,
    create_campaign,
    delete_campaign,
    get_campaign,
    record_kpi_result,
    update_campaign,
    upsert_kpi_defs,
)
from apps.backend.src.modules.users.models import User

from .dispatch import TaskContext, orchestrate_flow, runtime_dependency
from .registry import FLOWS, FlowBuilder, operator


class MessageOut(BaseModel):
    message: str


class CampaignUpdateCommand(CampaignUpdate):
    campaign_id: Optional[int] = None


class CampaignDeleteCommand(BaseModel):
    campaign_id: Optional[int] = None


class CampaignKPIDefUpsertCommand(BaseModel):
    campaign_id: Optional[int] = None
    defs: List[CampaignKPIDefUpsert]


class CampaignKPIDefListOut(BaseModel):
    defs: List[CampaignKPIDefOut]


class CampaignKPIRecordCommand(BaseModel):
    campaign_id: Optional[int] = None
    as_of: datetime
    values: dict[str, float]


class CampaignAggregationCommand(BaseModel):
    campaign_id: Optional[int] = None
    as_of: Optional[datetime] = None


def _require_identifier(value: Optional[int], name: str) -> int:
    if value is None:
        raise HTTPException(status_code=422, detail=f"{name} is required")
    return value


async def _load_owned_campaign(
    db: AsyncSession,
    *,
    campaign_id: int,
    owner_user_id: int,
    not_found_detail: str = "Campaign not found",
) -> Any:
    campaign = await get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail=not_found_detail)
    if campaign.owner_user_id != owner_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return campaign


@operator(
    key="campaigns.create",
    title="Create campaign",
    side_effect="write",
)
async def op_create_campaign(payload: CampaignCreate, ctx: TaskContext) -> CampaignOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    created = await create_campaign(db, owner_user_id=user.id, payload=payload)
    return CampaignOut.model_validate(created)


@operator(
    key="campaigns.update",
    title="Update campaign",
    side_effect="write",
)
async def op_update_campaign(payload: CampaignUpdateCommand, ctx: TaskContext) -> CampaignOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    campaign_id = _require_identifier(payload.campaign_id, "campaign_id")
    campaign = await _load_owned_campaign(db, campaign_id=campaign_id, owner_user_id=user.id)
    update_data = payload.model_dump(exclude_unset=True)
    update_data.pop("campaign_id", None)
    update_payload = CampaignUpdate.model_validate(update_data)
    updated = await update_campaign(db, campaign_id=campaign.id, payload=update_payload)
    return CampaignOut.model_validate(updated)


@operator(
    key="campaigns.delete",
    title="Delete campaign",
    side_effect="write",
)
async def op_delete_campaign(payload: CampaignDeleteCommand, ctx: TaskContext) -> MessageOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    campaign_id = _require_identifier(payload.campaign_id, "campaign_id")
    await _load_owned_campaign(db, campaign_id=campaign_id, owner_user_id=user.id)
    await delete_campaign(db, campaign_id=campaign_id)
    return MessageOut(message="Campaign deleted successfully")


@operator(
    key="campaigns.upsert_kpi_defs",
    title="Upsert KPI definitions",
    side_effect="write",
)
async def op_upsert_kpi_defs(
    payload: CampaignKPIDefUpsertCommand,
    ctx: TaskContext,
) -> CampaignKPIDefListOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    campaign_id = _require_identifier(payload.campaign_id, "campaign_id")
    await _load_owned_campaign(db, campaign_id=campaign_id, owner_user_id=user.id)
    defs = await upsert_kpi_defs(db, campaign_id=campaign_id, defs=payload.defs)
    return CampaignKPIDefListOut(defs=defs)


@operator(
    key="campaigns.record_kpi",
    title="Record KPI result",
    side_effect="write",
)
async def op_record_campaign_kpi(
    payload: CampaignKPIRecordCommand,
    ctx: TaskContext,
) -> CampaignKPIResultOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    campaign_id = _require_identifier(payload.campaign_id, "campaign_id")
    await _load_owned_campaign(db, campaign_id=campaign_id, owner_user_id=user.id)
    result = await record_kpi_result(
        db,
        campaign_id=campaign_id,
        as_of=payload.as_of,
        values=payload.values,
    )
    return CampaignKPIResultOut.model_validate(result)


@operator(
    key="campaigns.aggregate_kpis",
    title="Aggregate KPIs",
    side_effect="read",
)
async def op_aggregate_campaign_kpis(
    payload: CampaignAggregationCommand,
    ctx: TaskContext,
) -> CampaignKPIResultOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    campaign_id = _require_identifier(payload.campaign_id, "campaign_id")
    await _load_owned_campaign(db, campaign_id=campaign_id, owner_user_id=user.id)
    result = await aggregate_campaign_kpis_respecting_defs(
        db,
        campaign_id=campaign_id,
        as_of=payload.as_of,
    )
    return CampaignKPIResultOut.model_validate(result)


@FLOWS.flow(
    key="campaigns.create_campaign",
    title="Create Campaign",
    input_model=CampaignCreate,
    output_model=CampaignOut,
    method="post",
    path="/campaigns",
    tags=("campaigns",),
)
def _flow_create_campaign(builder: FlowBuilder):
    task = builder.task("create", "campaigns.create")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="campaigns.update_campaign",
    title="Update Campaign",
    input_model=CampaignUpdateCommand,
    output_model=CampaignOut,
    method="put",
    path="/campaigns/{campaign_id}",
    tags=("campaigns",),
)
def _flow_update_campaign(builder: FlowBuilder):
    task = builder.task("update", "campaigns.update")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="campaigns.delete_campaign",
    title="Delete Campaign",
    input_model=CampaignDeleteCommand,
    output_model=MessageOut,
    method="delete",
    path="/campaigns/{campaign_id}",
    tags=("campaigns",),
)
def _flow_delete_campaign(builder: FlowBuilder):
    task = builder.task("delete", "campaigns.delete")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="campaigns.upsert_kpi_defs",
    title="Upsert KPI Definitions",
    input_model=CampaignKPIDefUpsertCommand,
    output_model=CampaignKPIDefListOut,
    method="put",
    path="/campaigns/{campaign_id}/kpi-defs",
    tags=("campaigns",),
)
def _flow_upsert_kpi_defs(builder: FlowBuilder):
    task = builder.task("upsert_kpi_defs", "campaigns.upsert_kpi_defs")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="campaigns.record_kpi_result",
    title="Record KPI Result",
    input_model=CampaignKPIRecordCommand,
    output_model=CampaignKPIResultOut,
    method="post",
    path="/campaigns/{campaign_id}/kpi-results",
    tags=("campaigns",),
)
def _flow_record_kpi(builder: FlowBuilder):
    task = builder.task("record_kpi", "campaigns.record_kpi")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="campaigns.aggregate_kpis",
    title="Aggregate KPI",
    input_model=CampaignAggregationCommand,
    output_model=CampaignKPIResultOut,
    method="post",
    path="/campaigns/{campaign_id}/aggregate-kpis",
    tags=("campaigns",),
)
def _flow_aggregate_kpis(builder: FlowBuilder):
    task = builder.task("aggregate_kpis", "campaigns.aggregate_kpis")
    builder.expect_terminal(task)


router = FLOWS.build_router(
    orchestrate_flow,
    prefix="",
    tags=["campaigns"],
    runtime_dependency=runtime_dependency,
    flow_filter=lambda flow: "campaigns" in flow.tags,
)


__all__ = ["router"]

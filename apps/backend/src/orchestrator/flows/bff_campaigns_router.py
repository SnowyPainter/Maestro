"""BFF read flows for campaigns resources."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from pydantic import BaseModel, RootModel
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.campaigns.schemas import (
    CampaignKPIDefOut,
    CampaignKPIResultOut,
    CampaignOut,
)
from apps.backend.src.modules.campaigns.service import (
    get_campaign,
    list_campaigns,
    list_kpi_defs,
    list_kpi_results,
)
from apps.backend.src.modules.users.models import User

from apps.backend.src.orchestrator.dispatch import (
    TaskContext,
    orchestrate_flow,
    runtime_dependency,
)
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


class CampaignReadPayload(BaseModel):
    campaign_id: int


class CampaignListPayload(BaseModel):
    q: Optional[str] = None
    limit: int = 20
    offset: int = 0


class CampaignKpiDefsPayload(BaseModel):
    campaign_id: int


class CampaignKpiResultsPayload(BaseModel):
    campaign_id: int
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    limit: int = 200


class CampaignList(RootModel[list[CampaignOut]]):
    pass


class CampaignKpiDefList(RootModel[list[CampaignKPIDefOut]]):
    pass


class CampaignKpiResultList(RootModel[list[CampaignKPIResultOut]]):
    pass


@operator(
    key="bff.campaigns.read_campaign",
    title="BFF Read Campaign",
    side_effect="read",
)
async def op_read_campaign(payload: CampaignReadPayload, ctx: TaskContext) -> CampaignOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    campaign = await get_campaign(db, payload.campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return CampaignOut.model_validate(campaign)


@operator(
    key="bff.campaigns.list_campaigns",
    title="BFF List Campaigns",
    side_effect="read",
)
async def op_list_campaigns(payload: CampaignListPayload, ctx: TaskContext) -> CampaignList:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    campaigns, _ = await list_campaigns(
        db,
        owner_user_id=user.id,
        q=payload.q,
        limit=payload.limit,
        offset=payload.offset,
    )
    items = [CampaignOut.model_validate(camp) for camp in campaigns]
    return CampaignList(root=items)


@operator(
    key="bff.campaigns.list_kpi_defs",
    title="BFF List Campaign KPI Definitions",
    side_effect="read",
)
async def op_list_kpi_defs(payload: CampaignKpiDefsPayload, ctx: TaskContext) -> CampaignKpiDefList:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    campaign = await get_campaign(db, payload.campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    defs = await list_kpi_defs(db, payload.campaign_id)
    items = [CampaignKPIDefOut.model_validate(defn) for defn in defs]
    return CampaignKpiDefList(root=items)


@operator(
    key="bff.campaigns.list_kpi_results",
    title="BFF List Campaign KPI Results",
    side_effect="read",
)
async def op_list_kpi_results(
    payload: CampaignKpiResultsPayload,
    ctx: TaskContext,
) -> CampaignKpiResultList:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    campaign = await get_campaign(db, payload.campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    results = await list_kpi_results(
        db,
        campaign_id=payload.campaign_id,
        start=payload.start,
        end=payload.end,
        limit=payload.limit,
    )
    items = [CampaignKPIResultOut.model_validate(res) for res in results]
    return CampaignKpiResultList(root=items)


@FLOWS.flow(
    key="bff.campaigns.read_campaign",
    title="Get Campaign Details",
    description="Retrieve complete campaign information for campaign management dashboard",
    input_model=CampaignReadPayload,
    output_model=CampaignOut,
    method="get",
    path="/campaigns/{campaign_id}",
    tags=("bff", "campaigns", "read", "ui", "frontend", "dashboard"),
)
def _flow_bff_read_campaign(builder: FlowBuilder):
    task = builder.task("read_campaign", "bff.campaigns.read_campaign")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.campaigns.list_campaigns",
    title="List All Campaigns",
    description="Get paginated list of all campaigns for campaign overview and management",
    input_model=CampaignListPayload,
    output_model=CampaignList,
    method="get",
    path="/campaigns",
    tags=("bff", "campaigns", "list", "ui", "frontend", "dashboard", "pagination"),
)
def _flow_bff_list_campaigns(builder: FlowBuilder):
    task = builder.task("list_campaigns", "bff.campaigns.list_campaigns")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.campaigns.list_kpi_defs",
    title="Get Campaign KPI Definitions",
    description="Retrieve all KPI definitions for a campaign to display metrics configuration",
    input_model=CampaignKpiDefsPayload,
    output_model=CampaignKpiDefList,
    method="get",
    path="/campaigns/{campaign_id}/kpi-defs",
    tags=("bff", "campaigns", "kpi", "metrics", "read", "ui", "frontend", "configuration"),
)
def _flow_bff_list_kpi_defs(builder: FlowBuilder):
    task = builder.task("list_kpi_defs", "bff.campaigns.list_kpi_defs")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.campaigns.list_kpi_results",
    title="Get Campaign KPI Results",
    description="Retrieve KPI measurement results for campaign performance analytics and reporting",
    input_model=CampaignKpiResultsPayload,
    output_model=CampaignKpiResultList,
    method="get",
    path="/campaigns/{campaign_id}/kpi-results",
    tags=("bff", "campaigns", "kpi", "metrics", "analytics", "read", "ui", "frontend", "reporting"),
)
def _flow_bff_list_kpi_results(builder: FlowBuilder):
    task = builder.task("list_kpi_results", "bff.campaigns.list_kpi_results")
    builder.expect_terminal(task)


__all__ = []


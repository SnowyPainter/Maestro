"""BFF flows for playbook resources."""

from __future__ import annotations

from typing import List, Optional, Dict, Any

from fastapi import HTTPException

from apps.backend.src.modules.playbooks.schemas import (
    DashboardOverviewResponse,
    DashboardEventChainResponse,
    DashboardPerformanceResponse,
    DashboardInsightsResponse,
    DashboardRecommendationsResponse,
    DashboardTrendCorrelationResponse,
)
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from datetime import datetime, timezone

from apps.backend.src.modules.accounts.service import get_persona
from apps.backend.src.modules.campaigns.service import get_campaign
from apps.backend.src.modules.playbooks.schemas import PlaybookOut, PlaybookEnrichedOut, PlaybookLogOut
from apps.backend.src.modules.playbooks.service import list_playbooks, search_playbooks, list_logs_for_persona, get_playbook_log
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


class PlaybookListPayload(BaseModel):
    persona_id: Optional[int] = Field(default=None, description="Filter by persona id")
    campaign_id: Optional[int] = Field(default=None, description="Filter by campaign id")
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)

class PlaybookSearchPayload(BaseModel):
    playbook_id: Optional[int] = Field(default=None, description="Filter by playbook id")
    campaign_id: Optional[int] = Field(default=None, description="Filter by campaign id")
    persona_id: Optional[int] = Field(default=None, description="Filter by persona id")
    last_event: Optional[str] = Field(default=None, description="Filter by last event")
    include_logs: bool = Field(default=False, description="Include playbook logs in response")

class PlaybookSearchResponse(BaseModel):
    items: List[PlaybookEnrichedOut]
    total: int

class PlaybookDetailResponse(BaseModel):
    playbook: PlaybookEnrichedOut
    logs: List[PlaybookLogOut] = Field(default_factory=list)

class PlaybookListResponse(BaseModel):
    items: List[PlaybookEnrichedOut]
    total: int
    limit: int
    offset: int

class PlaybookLogDetailPayload(BaseModel):
    playbook_log_id: int

class PlaybookLogDetailResponse(BaseModel):
    log: PlaybookLogOut

@operator(
    key="bff.playbook.list_playbooks",
    title="List Playbooks",
    side_effect="read",
)
async def op_list_playbooks(
    payload: PlaybookListPayload,
    ctx: TaskContext,
) -> PlaybookListResponse:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    if payload.persona_id is not None:
        persona = await get_persona(db, persona_id=payload.persona_id, owner_user_id=user.id)
        if persona is None:
            raise HTTPException(status_code=404, detail="Persona not found")

    rows, total = await list_playbooks(
        db,
        owner_user_id=user.id,
        persona_id=payload.persona_id,
        campaign_id=payload.campaign_id,
        limit=payload.limit,
        offset=payload.offset,
    )

    # Enrich playbooks with campaign and persona names
    enriched_items = []
    for row in rows:
        campaign = await get_campaign(db, campaign_id=row.campaign_id, owner_user_id=user.id)
        persona = await get_persona(db, persona_id=row.persona_id, owner_user_id=user.id)

        if campaign is None or persona is None:
            continue  # Skip if campaign or persona not found

        enriched = PlaybookEnrichedOut(
            **row.__dict__,
            campaign_name=campaign.name,
            campaign_description=campaign.description,
            persona_name=persona.name,
            persona_bio=persona.bio,
        )
        enriched_items.append(enriched)

    return PlaybookListResponse(
        items=enriched_items,
        total=total,
        limit=payload.limit,
        offset=payload.offset,
    )

@operator(
    key="bff.playbook.search_playbooks",
    title="Search Playbooks",
    side_effect="read",
)
async def op_search_playbooks(
    payload: PlaybookSearchPayload,
    ctx: TaskContext,
) -> PlaybookSearchResponse:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    # Remove include_logs from payload before passing to search_playbooks
    search_payload = payload.model_dump()
    include_logs = search_payload.pop("include_logs", False)

    rows, total = await search_playbooks(db, owner_user_id=user.id, **search_payload)

    # Enrich playbooks with campaign and persona names
    enriched_items = []
    for row in rows:
        campaign = await get_campaign(db, campaign_id=row.campaign_id, owner_user_id=user.id)
        persona = await get_persona(db, persona_id=row.persona_id, owner_user_id=user.id)

        if campaign is None or persona is None:
            continue  # Skip if campaign or persona not found

        enriched = PlaybookEnrichedOut(
            **row.__dict__,
            campaign_name=campaign.name,
            campaign_description=campaign.description,
            persona_name=persona.name,
            persona_bio=persona.bio,
        )
        enriched_items.append(enriched)

    return PlaybookSearchResponse(items=enriched_items, total=total)


@operator(
    key="bff.playbook.get_playbook_detail",
    title="Get Playbook Detail with Logs",
    side_effect="read",
)
async def op_get_playbook_detail(
    payload: PlaybookSearchPayload,
    ctx: TaskContext,
) -> PlaybookDetailResponse:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    if not payload.playbook_id:
        raise HTTPException(status_code=400, detail="playbook_id is required")

    # Get playbook
    search_payload = payload.model_dump()
    search_payload.pop("include_logs", False)
    rows, _ = await search_playbooks(db, owner_user_id=user.id, **search_payload)

    if not rows:
        raise HTTPException(status_code=404, detail="Playbook not found")

    row = rows[0]
    campaign = await get_campaign(db, campaign_id=row.campaign_id, owner_user_id=user.id)
    persona = await get_persona(db, persona_id=row.persona_id, owner_user_id=user.id)

    if campaign is None or persona is None:
        raise HTTPException(status_code=404, detail="Campaign or persona not found")

    enriched_playbook = PlaybookEnrichedOut(
        **row.__dict__,
        campaign_name=campaign.name,
        campaign_description=campaign.description,
        persona_name=persona.name,
        persona_bio=persona.bio,
    )

    # Get logs if requested
    logs = []
    if payload.include_logs:
        logs_result = await list_logs_for_persona(
            db,
            persona_id=row.persona_id,
            until=datetime.now(timezone.utc),
            limit=200  # 최근 200개 로그
        )
        # logs_result is a tuple (logs_list, total_count), so access [0] for logs
        logs_list = logs_result[0] if logs_result else []
        # Filter logs for this specific playbook
        logs = [log for log in logs_list if log.playbook_id == row.id]

    return PlaybookDetailResponse(playbook=enriched_playbook, logs=logs)

@operator(
    key="bff.playbook.get_playbook_log_detail",
    title="Get Playbook Log Detail",
    side_effect="read",
)
async def op_get_playbook_log_detail(
    payload: PlaybookLogDetailPayload,
    ctx: TaskContext,
) -> PlaybookLogDetailResponse:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    if not payload.playbook_log_id:
        raise HTTPException(status_code=400, detail="playbook_log_id is required")

    log = await get_playbook_log(db, playbook_log_id=payload.playbook_log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Playbook log not found")

    return PlaybookLogDetailResponse(log=log)
    
# Dashboard Analytics Operators

@operator(
    key="bff.playbook.get_dashboard_overview",
    title="Get Dashboard Overview Data",
    side_effect="read",
)
async def op_get_dashboard_overview(
    payload: PlaybookSearchPayload,
    ctx: TaskContext,
) -> DashboardOverviewResponse:
    """Dashboard Overview page data"""
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    if not payload.playbook_id:
        raise HTTPException(status_code=400, detail="playbook_id is required")

    # Check user permissions
    rows, _ = await search_playbooks(db, playbook_id=payload.playbook_id, owner_user_id=user.id)
    if not rows:
        raise HTTPException(status_code=404, detail="Playbook not found")

    from apps.backend.src.modules.playbooks.service import get_dashboard_overview_data
    return await get_dashboard_overview_data(db, playbook_id=payload.playbook_id)


@operator(
    key="bff.playbook.get_dashboard_event_chain",
    title="Get Playbook Dashboard Event Chain Data",
    side_effect="read",
)
async def op_get_dashboard_event_chain(
    payload: PlaybookSearchPayload,
    ctx: TaskContext,
) -> DashboardEventChainResponse:
    """Dashboard Event Chain page data"""
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    if not payload.playbook_id:
        raise HTTPException(status_code=400, detail="playbook_id is required")

    # Check user permissions
    rows, _ = await search_playbooks(db, playbook_id=payload.playbook_id, owner_user_id=user.id)
    if not rows:
        raise HTTPException(status_code=404, detail="Playbook not found")

    from apps.backend.src.modules.playbooks.service import get_dashboard_event_chain_data
    return await get_dashboard_event_chain_data(db, playbook_id=payload.playbook_id)


@operator(
    key="bff.playbook.get_dashboard_performance",
    title="Get Playbook Dashboard Performance Data",
    side_effect="read",
)
async def op_get_dashboard_performance(
    payload: PlaybookSearchPayload,
    ctx: TaskContext,
) -> DashboardPerformanceResponse:
    """Dashboard Performance page data"""
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    if not payload.playbook_id:
        raise HTTPException(status_code=400, detail="playbook_id is required")

    # Check user permissions
    rows, _ = await search_playbooks(db, playbook_id=payload.playbook_id, owner_user_id=user.id)
    if not rows:
        raise HTTPException(status_code=404, detail="Playbook not found")

    from apps.backend.src.modules.playbooks.service import get_dashboard_performance_data
    return await get_dashboard_performance_data(db, playbook_id=payload.playbook_id)


@operator(
    key="bff.playbook.get_dashboard_insights",
    title="Get Playbook Dashboard Insights Data",
    side_effect="read",
)
async def op_get_dashboard_insights(
    payload: PlaybookSearchPayload,
    ctx: TaskContext,
) -> DashboardInsightsResponse:
    """Dashboard Insights page data"""
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    if not payload.playbook_id:
        raise HTTPException(status_code=400, detail="playbook_id is required")

    # Check user permissions
    rows, _ = await search_playbooks(db, playbook_id=payload.playbook_id, owner_user_id=user.id)
    if not rows:
        raise HTTPException(status_code=404, detail="Playbook not found")

    from apps.backend.src.modules.playbooks.service import get_dashboard_insights_data
    return await get_dashboard_insights_data(db, playbook_id=payload.playbook_id)


@operator(
    key="bff.playbook.get_dashboard_recommendations",
    title="Get Playbook Dashboard Recommendations Data",
    side_effect="read",
)
async def op_get_dashboard_recommendations(
    payload: PlaybookSearchPayload,
    ctx: TaskContext,
) -> DashboardRecommendationsResponse:
    """Dashboard Recommendations page data"""
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    if not payload.playbook_id:
        raise HTTPException(status_code=400, detail="playbook_id is required")

    # Check user permissions
    rows, _ = await search_playbooks(db, playbook_id=payload.playbook_id, owner_user_id=user.id)
    if not rows:
        raise HTTPException(status_code=404, detail="Playbook not found")

    from apps.backend.src.modules.playbooks.service import get_dashboard_recommendations_data
    return await get_dashboard_recommendations_data(db, playbook_id=payload.playbook_id)


@operator(
    key="bff.playbook.get_dashboard_trend_correlation",
    title="Get Playbook Trend KPI Correlation Data",
    side_effect="read",
)
async def op_get_dashboard_trend_correlation(
    payload: PlaybookSearchPayload,
    ctx: TaskContext,
) -> DashboardTrendCorrelationResponse:
    """Dashboard Trend vs KPI correlation data"""
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    if not payload.playbook_id:
        raise HTTPException(status_code=400, detail="playbook_id is required")

    rows, _ = await search_playbooks(db, playbook_id=payload.playbook_id, owner_user_id=user.id)
    if not rows:
        raise HTTPException(status_code=404, detail="Playbook not found")

    from apps.backend.src.modules.playbooks.service import get_dashboard_trend_correlation_data
    return await get_dashboard_trend_correlation_data(db, playbook_id=payload.playbook_id)


# Dashboard Analytics Flows

@FLOWS.flow(
    key="bff.playbook.dashboard_overview",
    title="Get Playbook Dashboard Overview Data",
    description="Get overview metrics for playbook dashboard",
    input_model=PlaybookSearchPayload,
    output_model=DashboardOverviewResponse,
    method="get",
    path="/playbooks/dashboard/overview",
    tags=("bff", "playbooks", "dashboard", "analytics", "ui", "frontend"),
)
def _flow_bff_dashboard_overview(builder: FlowBuilder) -> None:
    task = builder.task("dashboard_overview", "bff.playbook.get_dashboard_overview")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.playbook.dashboard_event_chain",
    title="Get Playbook Dashboard Event Chain Data",
    description="Get event chain analysis for playbook dashboard",
    input_model=PlaybookSearchPayload,
    output_model=DashboardEventChainResponse,
    method="get",
    path="/playbooks/dashboard/event-chain",
    tags=("bff", "playbooks", "dashboard", "analytics", "ui", "frontend"),
)
def _flow_bff_dashboard_event_chain(builder: FlowBuilder) -> None:
    task = builder.task("dashboard_event_chain", "bff.playbook.get_dashboard_event_chain")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.playbook.dashboard_performance",
    title="Get Playbook Dashboard Performance Data",
    description="Get performance metrics for playbook dashboard",
    input_model=PlaybookSearchPayload,
    output_model=DashboardPerformanceResponse,
    method="get",
    path="/playbooks/dashboard/performance",
    tags=("bff", "playbooks", "dashboard", "analytics", "ui", "frontend"),
)
def _flow_bff_dashboard_performance(builder: FlowBuilder) -> None:
    task = builder.task("dashboard_performance", "bff.playbook.get_dashboard_performance")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.playbook.dashboard_insights",
    title="Get Playbook Dashboard Insights Data",
    description="Get insights data for playbook dashboard",
    input_model=PlaybookSearchPayload,
    output_model=DashboardInsightsResponse,
    method="get",
    path="/playbooks/dashboard/insights",
    tags=("bff", "playbooks", "dashboard", "analytics", "ui", "frontend"),
)
def _flow_bff_dashboard_insights(builder: FlowBuilder) -> None:
    task = builder.task("dashboard_insights", "bff.playbook.get_dashboard_insights")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.playbook.dashboard_recommendations",
    title="Get Playbook Dashboard Recommendations Data",
    description="Get recommendations for playbook dashboard",
    input_model=PlaybookSearchPayload,
    output_model=DashboardRecommendationsResponse,
    method="get",
    path="/playbooks/dashboard/recommendations",
    tags=("bff", "playbooks", "dashboard", "analytics", "ui", "frontend"),
)
def _flow_bff_dashboard_recommendations(builder: FlowBuilder) -> None:
    task = builder.task("dashboard_recommendations", "bff.playbook.get_dashboard_recommendations")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.playbook.dashboard_trend_correlation",
    title="Get Playbook Dashboard Trend Correlation Data",
    description="Get KPI and trend correlation insights for playbook dashboard",
    input_model=PlaybookSearchPayload,
    output_model=DashboardTrendCorrelationResponse,
    method="get",
    path="/playbooks/dashboard/trend-correlation",
    tags=("bff", "playbooks", "dashboard", "analytics", "ui", "frontend"),
)
def _flow_bff_dashboard_trend_correlation(builder: FlowBuilder) -> None:
    task = builder.task("dashboard_trend_correlation", "bff.playbook.get_dashboard_trend_correlation")
    builder.expect_terminal(task)

@FLOWS.flow(
    key="bff.playbook.list_playbooks",
    title="List Playbooks",
    description="List my playbooks with optional filtering.",
    input_model=PlaybookListPayload,
    output_model=PlaybookListResponse,
    method="get",
    path="/playbooks",
    tags=("bff", "playbooks", "read", "ui"),
)
def _flow_bff_list_playbooks(builder: FlowBuilder) -> None:
    task = builder.task("list_playbooks", "bff.playbook.list_playbooks")
    builder.expect_terminal(task)

@FLOWS.flow(
    key="bff.playbook.search_playbooks",
    title="Search Playbooks",
    description="Search playbooks with optional filtering.",
    input_model=PlaybookSearchPayload,
    output_model=PlaybookSearchResponse,
    method="get",
    path="/playbooks/search",
    tags=("bff", "playbooks", "search", "pagination", "ui", "frontend", "dashboard"),
)
def _flow_bff_search_playbooks(builder: FlowBuilder) -> None:
    task = builder.task("search_playbooks", "bff.playbook.search_playbooks")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.playbook.get_playbook_detail",
    title="Get Playbook Detail with Logs",
    description="Get detailed playbook information including logs.",
    input_model=PlaybookSearchPayload,
    output_model=PlaybookDetailResponse,
    method="get",
    path="/playbooks/detail",
    tags=("bff", "playbooks", "detail", "logs", "ui", "frontend"),
)
def _flow_bff_get_playbook_detail(builder: FlowBuilder) -> None:
    task = builder.task("get_playbook_detail", "bff.playbook.get_playbook_detail")
    builder.expect_terminal(task)

@FLOWS.flow(
    key="bff.playbook.get_playbook_log_detail",
    title="Get Playbook Log Detail",
    description="Get detailed playbook log information by log id.",
    input_model=PlaybookLogDetailPayload,
    output_model=PlaybookLogDetailResponse,
    method="get",
    path="/playbooks/log/{playbook_log_id}",
    tags=("bff", "playbooks", "log", "detail", "ui", "frontend"),
)
def _flow_bff_get_playbook_log_detail(builder: FlowBuilder) -> None:
    task = builder.task("get_playbook_log_detail", "bff.playbook.get_playbook_log_detail")
    builder.expect_terminal(task)

__all__ = [
    "PlaybookListPayload",
    "PlaybookListResponse",
    "PlaybookSearchPayload",
    "PlaybookSearchResponse",
    "PlaybookDetailResponse",
    "PlaybookLogDetailPayload",
    "PlaybookLogDetailResponse",
    "op_list_playbooks",
    "op_search_playbooks",
    "op_get_playbook_detail",
    "op_get_playbook_log_detail",
    "op_get_dashboard_overview",
    "op_get_dashboard_event_chain",
    "op_get_dashboard_performance",
    "op_get_dashboard_insights",
    "op_get_dashboard_recommendations",
    "op_get_dashboard_trend_correlation",
]

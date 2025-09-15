from datetime import datetime
from typing import Optional
from apps.backend.src.modules.users.models import User
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.core.deps import get_db, get_current_user
from apps.backend.src.modules.campaigns.service import (
    get_campaign,
    list_campaigns,
    list_kpi_defs,
    list_kpi_results,
)
from apps.backend.src.modules.campaigns.models import Campaign, CampaignKPIDef, CampaignKPIResult
from apps.backend.src.modules.campaigns.schemas import CampaignOut, CampaignKPIDefOut, CampaignKPIResultOut

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

@router.get("/{campaign_id}/kpi-defs", response_model=list[CampaignKPIDefOut])
async def read_campaign_kpi_defs(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """캠페인의 KPI 정의 목록 조회"""
    # 캠페인 소유권 검증
    campaign = await get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    defs = await list_kpi_defs(db, campaign_id)
    return defs


@router.get("/{campaign_id}/kpi-results", response_model=list[CampaignKPIResultOut])
async def read_campaign_kpi_results(
    campaign_id: int,
    start: Optional[datetime] = Query(None, description="시작 날짜"),
    end: Optional[datetime] = Query(None, description="종료 날짜"),
    limit: int = Query(200, description="최대 항목 수"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """캠페인의 KPI 결과 목록 조회"""
    # 캠페인 소유권 검증
    campaign = await get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    results = await list_kpi_results(
        db, campaign_id=campaign_id, start=start, end=end, limit=limit
    )
    return results

@router.get("/{campaign_id}", response_model=CampaignOut)
async def read_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """특정 캠페인 조회"""
    campaign = await get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return campaign


@router.get("", response_model=list[CampaignOut])
async def read_campaigns(
    q: Optional[str] = Query(None, description="검색 쿼리"),
    limit: int = Query(20, description="페이지당 항목 수"),
    offset: int = Query(0, description="오프셋"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """캠페인 목록 조회"""
    campaigns, _ = await list_campaigns(
        db, owner_user_id=user.id, q=q, limit=limit, offset=offset
    )
    return campaigns
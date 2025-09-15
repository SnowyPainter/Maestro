from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.core.deps import get_db, get_current_user
from apps.backend.src.modules.campaigns.service import (
    create_campaign,
    update_campaign,
    delete_campaign,
    upsert_kpi_defs,
    record_kpi_result,
    aggregate_campaign_kpis_respecting_defs,
    get_campaign,
)
from apps.backend.src.modules.campaigns.schemas import (
    CampaignCreate,
    CampaignUpdate,
    CampaignKPIDefUpsert,
    CampaignKPIResultOut,
)
from apps.backend.src.modules.campaigns.schemas import CampaignOut, CampaignKPIDefOut, CampaignKPIResultOut
from apps.backend.src.modules.users.models import User

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.delete("/{campaign_id}")
async def delete_existing_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """캠페인 삭제"""
    campaign = await get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    await delete_campaign(db, campaign_id)
    return {"message": "Campaign deleted successfully"}


@router.put("/{campaign_id}/kpi-defs", response_model=List[CampaignKPIDefOut])
async def upsert_campaign_kpi_defs(
    campaign_id: int,
    defs: List[CampaignKPIDefUpsert],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """캠페인의 KPI 정의 전체 교체"""
    # 캠페인 소유권 검증
    campaign = await get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    result_defs = await upsert_kpi_defs(db, campaign_id=campaign_id, defs=defs)
    return result_defs


@router.put("/{campaign_id}", response_model=CampaignOut)
async def update_existing_campaign(
    campaign_id: int,
    payload: CampaignUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """캠페인 업데이트"""
    campaign = await get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    updated = await update_campaign(db, campaign_id=campaign_id, payload=payload)
    return updated

@router.post("/{campaign_id}/kpi-results", response_model=CampaignKPIResultOut)
async def record_campaign_kpi_result(
    campaign_id: int,
    as_of: datetime,
    values: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """캠페인 KPI 결과 기록"""
    # 캠페인 소유권 검증
    campaign = await get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await record_kpi_result(
        db, campaign_id=campaign_id, as_of=as_of, values=values
    )
    return result


@router.post("/{campaign_id}/aggregate-kpis", response_model=CampaignKPIResultOut)
async def aggregate_campaign_kpis(
    campaign_id: int,
    as_of: datetime = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """캠페인 KPI 집계 실행"""
    # 캠페인 소유권 검증
    campaign = await get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await aggregate_campaign_kpis_respecting_defs(
        db, campaign_id=campaign_id, as_of=as_of
    )
    return result

@router.post("", response_model=CampaignOut)
async def create_new_campaign(
    payload: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """새 캠페인 생성"""
    campaign = await create_campaign(db, owner_user_id=user.id, payload=payload)
    return campaign
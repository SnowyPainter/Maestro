from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from apps.backend.src.core.deps import get_db, get_current_user
from apps.backend.src.modules.drafts.models import Draft, DraftVariant
from apps.backend.src.modules.drafts.schemas import DraftOut, DraftVariantOut
from apps.backend.src.modules.users.models import User

router = APIRouter(prefix="/drafts", tags=["drafts"])


@router.get("/{draft_id}/variants", response_model=list[DraftVariantOut])
async def read_draft_variants(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """드래프트의 플랫폼별 변형 목록 조회"""
    # 드래프트 소유권 검증
    draft = await db.get(Draft, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    stmt = select(DraftVariant).where(DraftVariant.draft_id == draft_id)
    variants = (await db.execute(stmt)).scalars().all()
    return variants

@router.get("/{draft_id}", response_model=DraftOut)
async def read_draft(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """특정 드래프트 조회"""
    draft = await db.get(Draft, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return draft


@router.get("", response_model=list[DraftOut])
async def read_drafts(
    campaign_id: Optional[int] = Query(None, description="캠페인 ID 필터"),
    limit: int = Query(20, description="페이지당 항목 수"),
    offset: int = Query(0, description="오프셋"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """드래프트 목록 조회"""
    stmt = select(Draft).where(Draft.user_id == user.id)
    if campaign_id:
        stmt = stmt.where(Draft.campaign_id == campaign_id)

    stmt = stmt.order_by(Draft.updated_at.desc()).limit(limit).offset(offset)
    drafts = (await db.execute(stmt)).scalars().all()
    return drafts
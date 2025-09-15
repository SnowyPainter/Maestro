from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.core.deps import get_db, get_current_user
from apps.backend.src.modules.drafts.service import create_draft, update_draft_ir
from apps.backend.src.modules.drafts.schemas import DraftSaveRequest, DraftIR
from apps.backend.src.modules.drafts.models import Draft
from apps.backend.src.modules.drafts.schemas import DraftOut
from apps.backend.src.modules.users.models import User

router = APIRouter(prefix="/drafts", tags=["drafts"])


@router.post("", response_model=DraftOut)
async def create_new_draft(
    payload: DraftSaveRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """새 드래프트 생성"""
    draft = await create_draft(
        db,
        user_id=user.id,
        created_by=user.id,
        payload=payload,
    )
    return draft


@router.put("/{draft_id}/ir", response_model=DraftOut)
async def update_draft_content(
    draft_id: int,
    ir: DraftIR,
    title: Optional[str] = None,
    tags: Optional[List[str]] = None,
    goal: Optional[str] = None,
    campaign_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """드래프트 IR 및 메타데이터 업데이트"""
    # 드래프트 소유권 검증
    draft = await db.get(Draft, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    updated_draft = await update_draft_ir(
        db,
        draft_id=draft_id,
        ir=ir,
        title=title,
        tags=tags,
        goal=goal,
        campaign_id=campaign_id,
    )
    return updated_draft

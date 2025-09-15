from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.core.deps import get_db, get_current_user
from apps.backend.src.modules.accounts.service import (
    create_platform_account,
    update_platform_account,
    delete_platform_account,
    create_persona,
    update_persona,
    delete_persona,
    link_persona_account,
    unlink_persona_account,
    get_platform_account,
    get_persona,
)
from apps.backend.src.modules.accounts.schemas import (
    PlatformAccountCreate,
    PlatformAccountUpdate,
    PersonaCreate,
    PersonaUpdate,
    PersonaAccountLinkCreate,
)
from apps.backend.src.modules.accounts.schemas import PlatformAccountOut, PersonaOut, PersonaAccountOut
from apps.backend.src.modules.users.models import User

router = APIRouter(prefix="/accounts", tags=["accounts"])


# PlatformAccount endpoints
@router.post("/platform", response_model=PlatformAccountOut)
async def create_new_platform_account(
    data: PlatformAccountCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """새 플랫폼 계정 생성"""
    data.owner_user_id = user.id  # 강제 설정
    account = await create_platform_account(db, data)
    return account


@router.put("/platform/{account_id}", response_model=PlatformAccountOut)
async def update_existing_platform_account(
    account_id: int,
    data: PlatformAccountUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """플랫폼 계정 업데이트"""
    # 계정 소유권 검증
    account = await get_platform_account(db, account_id=account_id, owner_user_id=user.id)
    if not account:
        raise HTTPException(status_code=404, detail="Platform account not found")

    updated_account = await update_platform_account(db, account=account, data=data)
    return updated_account

@router.delete("/platform/{account_id}")
async def delete_existing_platform_account(
    account_id: int,
    soft: bool = True,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """플랫폼 계정 삭제"""
    # 계정 소유권 검증
    account = await get_platform_account(db, account_id=account_id, owner_user_id=user.id)
    if not account:
        raise HTTPException(status_code=404, detail="Platform account not found")

    await delete_platform_account(db, account=account, soft=soft)
    return {"message": "Platform account deleted successfully"}


# Persona endpoints
@router.post("/personas", response_model=PersonaOut)
async def create_new_persona(
    data: PersonaCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """새 페르소나 생성"""
    data.owner_user_id = user.id  # 강제 설정
    persona = await create_persona(db, data)
    return persona


@router.put("/personas/{persona_id}", response_model=PersonaOut)
async def update_existing_persona(
    persona_id: int,
    data: PersonaUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """페르소나 업데이트"""
    # 페르소나 소유권 검증
    persona = await get_persona(db, persona_id=persona_id, owner_user_id=user.id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    updated_persona = await update_persona(db, persona=persona, data=data)
    return updated_persona


@router.delete("/personas/{persona_id}")
async def delete_existing_persona(
    persona_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """페르소나 삭제"""
    # 페르소나 소유권 검증
    persona = await get_persona(db, persona_id=persona_id, owner_user_id=user.id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    await delete_persona(db, persona=persona)
    return {"message": "Persona deleted successfully"}


# PersonaAccount link endpoints
@router.post("/persona-account-links", response_model=PersonaAccountOut)
async def create_persona_account_link(
    data: PersonaAccountLinkCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """페르소나와 계정 연결 생성"""
    link = await link_persona_account(db, data, owner_user_id=user.id)
    return link


@router.delete("/persona-account-links/{persona_id}/{account_id}")
async def remove_persona_account_link(
    persona_id: int,
    account_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """페르소나와 계정 연결 제거"""
    await unlink_persona_account(
        db, persona_id=persona_id, account_id=account_id, owner_user_id=user.id
    )
    return {"message": "Persona-account link removed successfully"}

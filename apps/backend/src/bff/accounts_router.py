from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.core.deps import get_db, get_current_user
from apps.backend.src.modules.accounts.service import (
    get_platform_account,
    list_platform_accounts,
    get_persona,
    list_personas,
    list_accounts_for_persona,
    list_personas_for_account,
)
from apps.backend.src.modules.accounts.schemas import PlatformAccountOut, PersonaOut, PersonaAccountOut
from apps.backend.src.modules.users.models import User
from apps.backend.src.modules.common.enums import PlatformKind

router = APIRouter(prefix="/accounts", tags=["accounts"])


# PlatformAccount endpoints
@router.get("/platform/{account_id}", response_model=PlatformAccountOut)
async def read_platform_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """특정 플랫폼 계정 조회"""
    account = await get_platform_account(db, account_id=account_id, owner_user_id=user.id)
    if not account:
        raise HTTPException(status_code=404, detail="Platform account not found")
    return account


@router.get("/platform", response_model=list[PlatformAccountOut])
async def read_platform_accounts(
    platform: Optional[PlatformKind] = Query(None, description="플랫폼 필터"),
    handle: Optional[str] = Query(None, description="핸들 검색"),
    limit: int = Query(50, description="페이지당 항목 수"),
    offset: int = Query(0, description="오프셋"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """플랫폼 계정 목록 조회"""
    accounts = await list_platform_accounts(
        db,
        owner_user_id=user.id,
        platform=platform,
        q_handle=handle,
        limit=limit,
        offset=offset,
    )
    return accounts


# Persona endpoints
@router.get("/personas/{persona_id}", response_model=PersonaOut)
async def read_persona(
    persona_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """특정 페르소나 조회"""
    persona = await get_persona(db, persona_id=persona_id, owner_user_id=user.id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    return persona


@router.get("/personas", response_model=list[PersonaOut])
async def read_personas(
    name: Optional[str] = Query(None, description="이름 검색"),
    limit: int = Query(50, description="페이지당 항목 수"),
    offset: int = Query(0, description="오프셋"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """페르소나 목록 조회"""
    personas = await list_personas(
        db,
        owner_user_id=user.id,
        q_name=name,
        limit=limit,
        offset=offset,
    )
    return personas


# PersonaAccount link endpoints
@router.get("/personas/{persona_id}/accounts", response_model=list[PersonaAccountOut])
async def read_accounts_for_persona(
    persona_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """페르소나에 연결된 계정 목록 조회"""
    # 페르소나 소유권 검증
    persona = await get_persona(db, persona_id=persona_id, owner_user_id=user.id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    links = await list_accounts_for_persona(db, persona_id=persona_id)
    return links


@router.get("/platform/{account_id}/personas", response_model=list[PersonaAccountOut])
async def read_personas_for_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """계정에 연결된 페르소나 목록 조회"""
    # 계정 소유권 검증
    account = await get_platform_account(db, account_id=account_id, owner_user_id=user.id)
    if not account:
        raise HTTPException(status_code=404, detail="Platform account not found")

    links = await list_personas_for_account(db, account_id=account_id)
    return links

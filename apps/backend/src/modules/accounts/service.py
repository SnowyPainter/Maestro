# apps/backend/src/modules/accounts/services.py
from __future__ import annotations
from typing import Iterable, Optional, Sequence
from datetime import datetime, timezone

from sqlalchemy import select, and_, or_, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.backend.src.modules.accounts.models import (
    PlatformAccount, Persona, PersonaAccount
)
from apps.backend.src.modules.accounts.schemas import (
    PlatformAccountCreate, PlatformAccountUpdate,
    PersonaCreate, PersonaUpdate,
    PersonaAccountLinkCreate, RichPersonaAccountOut
)
from apps.backend.src.modules.common.enums import PlatformKind, Permission


# ------------------------
# Utility
# ------------------------
def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ------------------------
# PlatformAccount services
# ------------------------
async def create_platform_account(
    db: AsyncSession, data: PlatformAccountCreate
) -> PlatformAccount:
    acc = PlatformAccount(
        owner_user_id=data.owner_user_id,
        platform=data.platform,
        handle=data.handle,
        external_id=data.external_id,
        avatar_url=data.avatar_url,
        bio=data.bio,
        access_token=data.access_token,
        refresh_token=data.refresh_token,
        token_expires_at=data.token_expires_at,
        scopes=data.scopes,
        is_active=data.is_active if data.is_active is not None else True,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(acc)
    await db.flush()
    await db.refresh(acc)
    await db.commit()
    return acc

async def get_platform_account(
    db: AsyncSession, *, account_id: int, owner_user_id: Optional[int] = None
) -> Optional[PlatformAccount]:
    q = select(PlatformAccount).where(PlatformAccount.id == account_id)
    if owner_user_id is not None:
        q = q.where(PlatformAccount.owner_user_id == owner_user_id)
    res = await db.execute(q)
    return res.scalar_one_or_none()


async def get_platform_account_by_external_id(
    db: AsyncSession,
    *,
    platform: PlatformKind,
    external_id: str,
    owner_user_id: Optional[int] = None,
    is_active: Optional[bool] = None,
) -> Optional[PlatformAccount]:
    stmt = select(PlatformAccount).where(
        PlatformAccount.platform == platform,
        PlatformAccount.external_id == external_id,
    )
    if owner_user_id is not None:
        stmt = stmt.where(PlatformAccount.owner_user_id == owner_user_id)
    if is_active is not None:
        stmt = stmt.where(PlatformAccount.is_active == is_active)
    res = await db.execute(stmt)
    return res.scalar_one_or_none()

async def is_valid_platform_account(
    db: AsyncSession, *, account_id: int, owner_user_id: int
) -> bool:
    account = await get_platform_account(db, account_id=account_id, owner_user_id=owner_user_id)

    if not account or not account.is_active:
        return False
    
    # 필수 식별자 누락 시 바로 비활성 처리
    external_id = (account.external_id or "").strip()
    if not external_id:
        return False

    access_token = (account.access_token or "").strip()

    if not access_token:
        return False

    # 토큰 문자열만 있고 만료 정보는 없으면 true (수동 토큰)
    if account.token_expires_at is None:
        return True

    # expires가 있으면 만료 시간 체크
    if account.token_expires_at is not None and account.token_expires_at < _utcnow():
        return False
    
    return True

async def list_platform_accounts(
    db: AsyncSession,
    *,
    owner_user_id: Optional[int] = None,
    platform: Optional[PlatformKind] = None,
    q_handle: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Sequence[PlatformAccount]:
    q = select(PlatformAccount).order_by(PlatformAccount.id.desc())
    if owner_user_id is not None:
        q = q.where(PlatformAccount.owner_user_id == owner_user_id)
    if platform is not None:
        q = q.where(PlatformAccount.platform == platform)
    if q_handle:
        q = q.where(PlatformAccount.handle.ilike(f"%{q_handle}%"))
    q = q.limit(limit).offset(offset)
    res = await db.execute(q)
    return res.scalars().all()

async def update_platform_account(
    db: AsyncSession, *, account: PlatformAccount, data: PlatformAccountUpdate
) -> PlatformAccount:
    payload = data.model_dump(exclude_unset=True)

    new_external = payload.get("external_id")
    if isinstance(new_external, str):
        new_external = new_external.strip()
        payload["external_id"] = new_external or None

    target = account

    if isinstance(new_external, str) and new_external:
        current = (account.external_id or "").strip()
        if new_external != current:
            duplicate = await get_platform_account_by_external_id(
                db,
                platform=account.platform,
                external_id=new_external,
                owner_user_id=account.owner_user_id,
                is_active=True,
            )
            if duplicate and duplicate.id != account.id:
                await merge_platform_accounts(db, primary=duplicate, secondary=account)
                target = duplicate

    for key, value in payload.items():
        setattr(target, key, value)
    target.updated_at = _utcnow()
    db.add(target)
    await db.flush()
    await db.refresh(target)
    await db.commit()
    return target


async def merge_platform_accounts(
    db: AsyncSession,
    *,
    primary: PlatformAccount,
    secondary: PlatformAccount,
) -> None:
    if primary.id == secondary.id:
        return

    await db.execute(
        update(PersonaAccount)
        .where(PersonaAccount.account_id == secondary.id)
        .values(account_id=primary.id)
    )

    secondary.is_active = False
    secondary.external_id = None
    secondary.access_token = None
    secondary.refresh_token = None
    secondary.token_expires_at = None
    secondary.updated_at = _utcnow()
    db.add(secondary)
    await db.flush()


async def restore_platform_account(
    db: AsyncSession,
    *,
    account: PlatformAccount,
) -> PlatformAccount:
    if account.is_active:
        return account

    external_id = (account.external_id or "").strip()
    if external_id:
        duplicate = await get_platform_account_by_external_id(
            db,
            platform=account.platform,
            external_id=external_id,
            owner_user_id=account.owner_user_id,
            is_active=True,
        )
        if duplicate and duplicate.id != account.id:
            raise ValueError("an active account with this external id already exists")

    account.is_active = True
    account.updated_at = _utcnow()
    db.add(account)
    await db.flush()
    await db.refresh(account)
    await db.commit()
    return account

async def delete_platform_account(
    db: AsyncSession, *, account: PlatformAccount, soft: bool = True
) -> None:
    if soft:
        account.is_active = False
        account.updated_at = _utcnow()
        db.add(account)
        await db.flush()
        await db.commit()
    else:
        await db.delete(account)
        await db.flush()
        await db.commit()


# ------------------------
# Persona services
# ------------------------
async def create_persona(db: AsyncSession, data: PersonaCreate) -> Persona:
    p = Persona(
        owner_user_id=data.owner_user_id,
        name=data.name,
        avatar_url=data.avatar_url,
        bio=data.bio,
        language=data.language,
        tone=data.tone,
        style_guide=data.style_guide,
        pillars=data.pillars,
        banned_words=data.banned_words,
        default_hashtags=data.default_hashtags,
        hashtag_rules=data.hashtag_rules,
        link_policy=data.link_policy,
        media_prefs=data.media_prefs,
        posting_windows=data.posting_windows,
        extras=data.extras,
        schema_version=data.schema_version,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(p)
    await db.flush()
    await db.refresh(p)
    await db.commit()
    return p

async def get_persona(
    db: AsyncSession, *, persona_id: int, owner_user_id: Optional[int] = None
) -> Optional[Persona]:
    q = select(Persona).where(Persona.id == persona_id)
    if owner_user_id is not None:
        q = q.where(Persona.owner_user_id == owner_user_id)
    res = await db.execute(q)
    return res.scalar_one_or_none()

async def list_personas(
    db: AsyncSession,
    *,
    owner_user_id: Optional[int] = None,
    q_name: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Sequence[Persona]:
    q = select(Persona).order_by(Persona.id.desc())
    if owner_user_id is not None:
        q = q.where(Persona.owner_user_id == owner_user_id)
    if q_name:
        q = q.where(Persona.name.ilike(f"%{q_name}%"))
    q = q.limit(limit).offset(offset)
    res = await db.execute(q)
    return res.scalars().all()

async def update_persona(
    db: AsyncSession, *, persona: Persona, data: PersonaUpdate
) -> Persona:
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(persona, k, v)
    persona.updated_at = _utcnow()
    db.add(persona)
    await db.flush()
    await db.refresh(persona)
    await db.commit()
    return persona

async def delete_persona(
    db: AsyncSession, *, persona: Persona
) -> None:
    # Soft delete
    if not persona.is_active:
        return
    persona.is_active = False
    persona.updated_at = _utcnow()
    db.add(persona)
    await db.flush()
    await db.commit()

async def restore_persona(
    db: AsyncSession, *, persona: Persona
) -> Persona:
    if persona.is_active:
        return persona
    persona.is_active = True
    persona.updated_at = _utcnow()
    db.add(persona)
    await db.flush()
    await db.refresh(persona)
    await db.commit()
    return persona


# ------------------------
# PersonaAccount link services
# ------------------------
async def link_persona_account(
    db: AsyncSession, data: PersonaAccountLinkCreate, *, owner_user_id: Optional[int] = None
) -> PersonaAccount:
    # 소유자 일치 검증(안전장치)
    persona = await get_persona(db, persona_id=data.persona_id)
    account = await get_platform_account(db, account_id=data.account_id)
    if not persona or not account:
        raise ValueError("persona or account not found")
    if owner_user_id is not None:
        if persona.owner_user_id != owner_user_id or account.owner_user_id != owner_user_id:
            raise PermissionError("owner_user_id mismatch")

    #check if the link already exists
    link = await get_persona_account_by_persona_and_account(db, persona_id=data.persona_id, account_id=data.account_id)
    if link:
        raise ValueError("link already exists")
    
    # 두 엔터티 모두 활성 상태여야 링크 가능
    if not persona.is_active:
        raise ValueError("persona is inactive")
    if not account.is_active:
        raise ValueError("platform account is inactive")

    # UniqueConstraint('persona_id','account_id') 보호
    link = PersonaAccount(
        persona_id=data.persona_id,
        account_id=data.account_id,
        can_permissions=[Permission(p) if not isinstance(p, Permission) else p for p in (data.can_permissions or [])],
        is_verified_link=data.is_verified_link,
        default_templates=data.default_templates,
        created_at=_utcnow(),
    )
    db.add(link)
    await db.flush()
    await db.refresh(link)
    await db.commit()
    return link

async def unlink_persona_account(
    db: AsyncSession, *, persona_id: int, account_id: int, owner_user_id: Optional[int] = None
) -> None:
    q = select(PersonaAccount).where(
        and_(PersonaAccount.persona_id == persona_id, PersonaAccount.account_id == account_id)
    )
    res = await db.execute(q)
    link = res.scalar_one_or_none()
    if not link:
        return

    # (선택) owner 확인
    if owner_user_id is not None:
        persona = await get_persona(db, persona_id=persona_id)
        account = await get_platform_account(db, account_id=account_id)
        if not persona or not account or persona.owner_user_id != owner_user_id or account.owner_user_id != owner_user_id:
            raise PermissionError("owner_user_id mismatch")

    await db.delete(link)
    await db.flush()
    await db.commit()

async def list_accounts_for_persona(
    db: AsyncSession, *, persona_id: int
) -> Sequence[PersonaAccount]:
    q = (
        select(PersonaAccount)
        .join(Persona, PersonaAccount.persona_id == Persona.id)
        .join(PlatformAccount, PersonaAccount.account_id == PlatformAccount.id)
        .where(PersonaAccount.persona_id == persona_id)
        .where(Persona.is_active == True)
        .where(PlatformAccount.is_active == True)
        .order_by(PersonaAccount.id.desc())
    )
    res = await db.execute(q)
    return res.scalars().all()

async def list_personas_for_account(
    db: AsyncSession, *, account_id: int
) -> Sequence[PersonaAccount]:
    q = (
        select(PersonaAccount)
        .join(Persona, PersonaAccount.persona_id == Persona.id)
        .join(PlatformAccount, PersonaAccount.account_id == PlatformAccount.id)
        .where(PersonaAccount.account_id == account_id)
        .where(Persona.is_active == True)
        .where(PlatformAccount.is_active == True)
        .order_by(PersonaAccount.id.desc())
    )
    res = await db.execute(q)
    return res.scalars().all()

async def get_persona_account(
    db: AsyncSession, *, persona_account_id: int
) -> Optional[PersonaAccount]:
    q = select(PersonaAccount).where(PersonaAccount.id == persona_account_id)
    res = await db.execute(q)
    return res.scalar_one_or_none()

async def get_persona_account_by_persona_and_account(
    db: AsyncSession, *, persona_id: int, account_id: int
) -> Optional[PersonaAccount]:
    q = select(PersonaAccount).where(PersonaAccount.persona_id == persona_id, PersonaAccount.account_id == account_id)
    res = await db.execute(q)
    return res.scalar_one_or_none()

async def list_persona_accounts_for_user(
    db: AsyncSession, *, owner_user_id: int
) -> Sequence[RichPersonaAccountOut]:
    """Get all persona accounts for a user with rich details for UI display"""
    q = (
        select(
            PersonaAccount.id,
            PersonaAccount.persona_id,
            Persona.name.label("persona_name"),
            Persona.avatar_url.label("persona_avatar_url"),
            Persona.bio.label("persona_description"),
            PersonaAccount.account_id,
            PlatformAccount.handle.label("account_handle"),
            PlatformAccount.platform.label("account_platform"),
            PlatformAccount.avatar_url.label("account_avatar_url"),
            PlatformAccount.bio.label("account_bio"),
            (Persona.is_active & PlatformAccount.is_active).label("is_active"),
            PersonaAccount.can_permissions,
            PersonaAccount.is_verified_link,
            PersonaAccount.created_at,
            PlatformAccount.updated_at.label("last_updated_at"),
        )
        .join(Persona, PersonaAccount.persona_id == Persona.id)
        .join(PlatformAccount, PersonaAccount.account_id == PlatformAccount.id)
        .where(Persona.owner_user_id == owner_user_id)
        .where(PlatformAccount.owner_user_id == owner_user_id)
        .where(Persona.is_active == True)
        .where(PlatformAccount.is_active == True)
        .order_by(PersonaAccount.id.desc())
    )

    res = await db.execute(q)
    rows = res.all()

    # Convert to RichPersonaAccountOut
    result = []
    for row in rows:
        result.append(RichPersonaAccountOut(
            id=row.id,
            persona_id=row.persona_id,
            persona_name=row.persona_name,
            persona_avatar_url=row.persona_avatar_url,
            persona_description=row.persona_description,
            account_id=row.account_id,
            account_handle=row.account_handle,
            account_platform=row.account_platform,
            account_avatar_url=row.account_avatar_url,
            account_bio=row.account_bio,
            is_active=row.is_active,
            can_permissions=row.can_permissions,
            is_verified_link=row.is_verified_link,
            created_at=row.created_at,
            last_updated_at=row.last_updated_at,
        ))

    return result


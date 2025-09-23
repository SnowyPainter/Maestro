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

async def is_valid_platform_account(
    db: AsyncSession, *, account_id: int, owner_user_id: int
) -> bool:
    account = await get_platform_account(db, account_id=account_id, owner_user_id=owner_user_id)

    if not account or not account.is_active:
        return False
    
    # access_token도 없고 expires도 없으면 False
    if account.access_token is None and account.token_expires_at is None:
        return False

    # expires는 없는데 access_token 있으면 True
    if account.token_expires_at is None and account.access_token is not None:
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
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(account, k, v)
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
    # CASCADE로 PersonaAccount도 함께 제거됨 (FK ondelete="CASCADE")
    await db.delete(persona)
    await db.flush()
    await db.commit()


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
        .where(PersonaAccount.persona_id == persona_id)
        .options()
        .order_by(PersonaAccount.id.desc())
    )
    res = await db.execute(q)
    return res.scalars().all()

async def list_personas_for_account(
    db: AsyncSession, *, account_id: int
) -> Sequence[PersonaAccount]:
    q = (
        select(PersonaAccount)
        .where(PersonaAccount.account_id == account_id)
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
            PlatformAccount.is_active.label("is_active"),
            PersonaAccount.can_permissions,
            PersonaAccount.is_verified_link,
            PersonaAccount.created_at,
            PlatformAccount.updated_at.label("last_updated_at"),
        )
        .join(Persona, PersonaAccount.persona_id == Persona.id)
        .join(PlatformAccount, PersonaAccount.account_id == PlatformAccount.id)
        .where(Persona.owner_user_id == owner_user_id)
        .where(PlatformAccount.owner_user_id == owner_user_id)
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

from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, List, Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.backend.src.modules.adapters.core.types import CompileResult
from apps.backend.src.modules.adapters.registry import ADAPTER_REGISTRY
from apps.backend.src.modules.common.enums import (
    ALREADY_PUBLISHED_STATUS,
    DO_NOT_RECOMPILE_STATUS,
    DraftState,
    PlatformKind,
    PostStatus,
    VariantStatus,
)
from apps.backend.src.modules.accounts.models import PersonaAccount
from apps.backend.src.modules.drafts.models import Draft, DraftVariant, PostPublication
from apps.backend.src.modules.drafts.schemas import DraftIR, DraftSaveRequest
from apps.backend.src.workers.Adapter.tasks import enqueue_variant_compile


def _all_platforms() -> tuple[PlatformKind, ...]:
    return tuple(PlatformKind)


def _supported_compile_platforms() -> set[PlatformKind]:
    return set(ADAPTER_REGISTRY.get_all().keys())


def _now() -> datetime:
    return datetime.utcnow()


def _normalize_schedule(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.replace(second=0, microsecond=0)

async def create_draft(
    db: AsyncSession,
    *,
    user_id: int,
    created_by: int,
    payload: DraftSaveRequest,
) -> Draft:
    draft = Draft(
        user_id=user_id,
        campaign_id=payload.campaign_id,
        title=payload.title,
        tags=payload.tags,
        goal=payload.goal,
        ir=payload.ir.model_dump(),
        created_by=created_by,
    )
    db.add(draft)
    await db.flush()

    await _ensure_variants_for_platforms(db, draft, _all_platforms())
    await _compile_supported_variants(db, draft)

    await db.commit()
    return draft


async def update_draft_ir(
    db: AsyncSession,
    *,
    draft_id: int,
    ir: DraftIR,
    title: str | None = None,
    tags: list[str] | None = None,
    goal: str | None = None,
    campaign_id: int | None = None,
) -> Draft:
    draft = await db.get(Draft, draft_id)
    if not draft:
        raise ValueError("draft not found")

    if title is not None:
        draft.title = title
    if tags is not None:
        draft.tags = tags
    if goal is not None:
        draft.goal = goal
    draft.campaign_id = campaign_id

    draft.ir = ir.model_dump()
    draft.ir_revision += 1
    draft.updated_at = _now()

    # 기존 Variant들을 "stale" 처리: 상태를 PENDING으로 돌리고 컴파일 대기
    await _mark_variants_stale(db, draft_id=draft.id, current_ir_revision=draft.ir_revision)

    # 누락된 플랫폼 Variant가 있으면 생성
    await _ensure_variants_for_platforms(db, draft, _all_platforms())

    # 지원되는 플랫폼만 즉시 재컴파일
    await _compile_supported_variants(db, draft)

    await db.commit()
    return draft


def apply_compile_result_to_variant(variant: DraftVariant, result: CompileResult) -> None:
    locked_statuses = DO_NOT_RECOMPILE_STATUS
    if any((pub.status in locked_statuses) for pub in variant.publications or []):
        return
    variant.rendered_caption = result.rendered_caption
    variant.rendered_blocks = result.rendered_blocks
    variant.metrics = result.metrics
    variant.errors = result.errors or None
    variant.warnings = result.warnings or None
    variant.status = result.status
    variant.compiled_at = result.compiled_at
    variant.ir_revision_compiled = result.ir_revision_compiled


async def delete_draft(db: AsyncSession, *, draft_id: int) -> None:
    draft = await db.get(Draft, draft_id)
    if not draft:
        raise ValueError("draft not found")

    draft.state = DraftState.DELETED
    draft.updated_at = _now()
    await db.flush()
    await db.commit()

    await _mark_variants_stale(db, draft_id=draft_id, current_ir_revision=draft.ir_revision)


async def _ensure_variants_for_platforms(
    db: AsyncSession,
    draft: Draft,
    platforms: Iterable[PlatformKind],
) -> None:
    existing = await db.execute(
        select(DraftVariant.platform).where(DraftVariant.draft_id == draft.id)
    )
    existing_set = {row[0] for row in existing}
    to_create = [p for p in platforms if p not in existing_set]

    for platform in to_create:
        dv = DraftVariant(
            draft_id=draft.id,
            platform=platform,
            status=VariantStatus.PENDING,
            ir_revision_compiled=None,
        )
        db.add(dv)
    if to_create:
        await db.flush()


async def _mark_variants_stale(db: AsyncSession, *, draft_id: int, current_ir_revision: int) -> None:
    rows: List[DraftVariant] = (
        await db.execute(
            select(DraftVariant)
            .where(DraftVariant.draft_id == draft_id)
            .options(selectinload(DraftVariant.publications))
        )
    ).scalars().all()
    # deleted, cancelled 를 따로 해제할 수 없으므로 lock하지 않음
    locked_statuses = DO_NOT_RECOMPILE_STATUS
    for dv in rows:
        if any((pub.status in locked_statuses) for pub in dv.publications or []):
            continue
        # IR revision이 현재 revision보다 작거나 None인 경우에만 stale로 처리
        if dv.ir_revision_compiled is None or dv.ir_revision_compiled < current_ir_revision:
            dv.status = VariantStatus.PENDING
            dv.errors = None
            dv.warnings = None
            dv.rendered_caption = None
            dv.rendered_blocks = None
            dv.metrics = None
            dv.compiled_at = None
            dv.ir_revision_compiled = None
            dv.updated_at = _now()
            db.add(dv)
    if rows:
        await db.flush()


async def _compile_supported_variants(db: AsyncSession, draft: Draft) -> None:
    """Enqueue compilation tasks for supported platforms."""
    supported = _supported_compile_platforms()
    if not supported:
        return

    rows: List[DraftVariant] = (
        await db.execute(
            select(DraftVariant)
            .where(
                DraftVariant.draft_id == draft.id,
                DraftVariant.platform.in_(list(supported)),
            )
            .options(selectinload(DraftVariant.publications))
        )
    ).scalars().all()

    locked_statuses = DO_NOT_RECOMPILE_STATUS

    for dv in rows:
        if any((pub.status in locked_statuses) for pub in dv.publications or []):
            continue
        enqueue_variant_compile(draft_id=draft.id, variant_id=dv.id)

    if rows:
        await db.flush()


async def get_draft_for_user(
    db: AsyncSession,
    *,
    draft_id: int,
    user_id: int,
) -> Draft | None:
    draft = await db.get(Draft, draft_id)
    if not draft:
        return None
    if draft.user_id != user_id:
        raise PermissionError("draft does not belong to user")
    return draft


async def list_draft_variants(
    db: AsyncSession,
    *,
    draft_id: int,
    user_id: int,
    draft: Draft | None = None,
) -> list[DraftVariant]:
    owning_draft = draft or await get_draft_for_user(
        db,
        draft_id=draft_id,
        user_id=user_id,
    )
    if not owning_draft:
        return []

    stmt = (
        select(DraftVariant)
        .where(DraftVariant.draft_id == owning_draft.id)
        .options(selectinload(DraftVariant.publications))
        .order_by(DraftVariant.platform.asc())
    )
    return (await db.execute(stmt)).scalars().all()

async def list_draft_variants_by_platform(
    db: AsyncSession,
    *,
    user_id: int,
    platform: PlatformKind,
) -> list[DraftVariant]:
    stmt = (
        select(DraftVariant)
        .join(Draft, DraftVariant.draft_id == Draft.id)
        .where(DraftVariant.platform == platform, Draft.user_id == user_id)
        .options(selectinload(DraftVariant.publications))
    )
    return (await db.execute(stmt)).scalars().all()

async def get_draft_variant(
    db: AsyncSession,
    *,
    draft_id: int,
    user_id: int,
    platform: PlatformKind,
    draft: Draft | None = None,
) -> DraftVariant | None:
    owning_draft = draft or await get_draft_for_user(
        db,
        draft_id=draft_id,
        user_id=user_id,
    )
    if not owning_draft:
        return None

    stmt = select(DraftVariant).where(
        DraftVariant.draft_id == owning_draft.id,
        DraftVariant.platform == platform,
    ).options(selectinload(DraftVariant.publications))
    return (await db.execute(stmt)).scalars().first()


async def _load_persona_account_for_user(
    db: AsyncSession,
    *,
    persona_account_id: int,
    owner_user_id: int,
) -> PersonaAccount:
    stmt = (
        select(PersonaAccount)
        .where(PersonaAccount.id == persona_account_id)
        .options(selectinload(PersonaAccount.persona))
    )
    persona_account = (await db.execute(stmt)).scalar_one_or_none()
    if (
        not persona_account
        or not persona_account.persona
        or persona_account.persona.owner_user_id != owner_user_id
    ):
        raise PermissionError("persona account mismatch")
    return persona_account


async def upsert_post_publication_schedule(
    db: AsyncSession,
    *,
    variant: DraftVariant,
    persona_account_id: int,
    scheduled_at: datetime,
    owner_user_id: int,
) -> PostPublication:
    await _load_persona_account_for_user(
        db,
        persona_account_id=persona_account_id,
        owner_user_id=owner_user_id,
    )

    stmt = select(PostPublication).where(
        PostPublication.variant_id == variant.id,
        PostPublication.account_persona_id == persona_account_id,
    )
    publication = (await db.execute(stmt)).scalar_one_or_none()
    if publication is None:
        publication = PostPublication(
            variant_id=variant.id,
            account_persona_id=persona_account_id,
            platform=variant.platform,
        )
        db.add(publication)
        await db.flush()

    if publication.status in ALREADY_PUBLISHED_STATUS:
        raise ValueError("cannot reschedule a published post")

    publication.status = PostStatus.SCHEDULED
    publication.scheduled_at = _normalize_schedule(scheduled_at)
    publication.updated_at = _now()
    db.add(publication)
    await db.flush()
    return publication


async def cancel_post_publication(
    db: AsyncSession,
    *,
    variant: DraftVariant,
    persona_account_id: int,
    owner_user_id: int,
) -> PostPublication:
    await _load_persona_account_for_user(
        db,
        persona_account_id=persona_account_id,
        owner_user_id=owner_user_id,
    )

    stmt = select(PostPublication).where(
        PostPublication.variant_id == variant.id,
        PostPublication.account_persona_id == persona_account_id,
    )
    publication = (await db.execute(stmt)).scalar_one_or_none()
    if publication is None:
        publication = PostPublication(
            variant_id=variant.id,
            account_persona_id=persona_account_id,
            platform=variant.platform,
        )
        db.add(publication)
        await db.flush()

    if publication.status in ALREADY_PUBLISHED_STATUS:
        raise ValueError("cannot cancel a monitoring or published post")

    publication.status = PostStatus.CANCELLED
    publication.scheduled_at = None
    publication.updated_at = _now()
    db.add(publication)
    await db.flush()
    return publication

from __future__ import annotations

from datetime import datetime
from typing import Iterable, List

from apps.backend.src.core.context import get_persona_account_id
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.adapters.schemas import CompileResult
from apps.backend.src.modules.adapters.registry import ADAPTER_REGISTRY
from apps.backend.src.modules.common.enums import DraftState, PlatformKind, VariantStatus
from apps.backend.src.modules.drafts.models import Draft, DraftVariant
from apps.backend.src.modules.drafts.schemas import DraftIR, DraftSaveRequest
from apps.backend.src.workers.Adapter.tasks import enqueue_variant_compile


def _all_platforms() -> tuple[PlatformKind, ...]:
    return tuple(PlatformKind)


def _supported_compile_platforms() -> set[PlatformKind]:
    return set(ADAPTER_REGISTRY.get_all().keys())


def _now() -> datetime:
    return datetime.utcnow()


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
        await db.execute(select(DraftVariant).where(DraftVariant.draft_id == draft_id))
    ).scalars().all()
    for dv in rows:
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
            select(DraftVariant).where(
                DraftVariant.draft_id == draft.id,
                DraftVariant.platform.in_(list(supported)),
            )
        )
    ).scalars().all()
    
    for dv in rows:
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
        .order_by(DraftVariant.platform.asc())
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
    )
    return (await db.execute(stmt)).scalars().first()

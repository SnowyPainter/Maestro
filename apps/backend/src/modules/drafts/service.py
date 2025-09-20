from __future__ import annotations
from typing import List
from datetime import datetime
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.common.enums import PlatformKind, VariantStatus, DraftState
from apps.backend.src.modules.drafts.models import Draft, DraftVariant, PostPublication
from apps.backend.src.modules.drafts.schemas import DraftIR, DraftSaveRequest, DraftDeleteCommand
from apps.backend.src.modules.drafts.compilers import compile_for_platform

SUPPORTED_COMPILE_PLATFORMS: set[PlatformKind] = {
    PlatformKind.THREADS,
    PlatformKind.INSTAGRAM,
    PlatformKind.X,
    PlatformKind.BLOG,
}
ALL_PLATFORMS: tuple[PlatformKind, ...] = (
    PlatformKind.THREADS,
    PlatformKind.INSTAGRAM,
    PlatformKind.X,
    PlatformKind.BLOG,
)

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

    await _ensure_variants_for_platforms(db, draft, ALL_PLATFORMS)
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
    draft.updated_at = datetime.utcnow()

    # 기존 Variant들을 "stale" 처리: 상태를 PENDING으로 돌리고 컴파일 대기
    await _mark_variants_stale(db, draft_id=draft.id)

    # 누락된 플랫폼 Variant가 있으면 생성
    await _ensure_variants_for_platforms(db, draft, ALL_PLATFORMS)

    # 지원되는 플랫폼만 즉시 재컴파일
    await _compile_supported_variants(db, draft)

    await db.commit()
    return draft

async def delete_draft(db: AsyncSession, *, draft_id: int) -> None:
    draft = await db.get(Draft, draft_id)
    if not draft:
        raise ValueError("draft not found")
    
    draft.state = DraftState.DELETED
    draft.updated_at = datetime.utcnow()
    await db.flush()
    await db.commit()

    await _mark_variants_stale(db, draft_id=draft_id)

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

    for p in to_create:
        dv = DraftVariant(
            draft_id=draft.id,
            platform=p,
            status=VariantStatus.PENDING,
            ir_revision_compiled=None,
        )
        db.add(dv)
    if to_create:
        await db.flush()

async def _mark_variants_stale(db: AsyncSession, *, draft_id: int) -> None:
    rows: List[DraftVariant] = (await db.execute(select(DraftVariant).where(DraftVariant.draft_id == draft_id))).scalars().all()
    for dv in rows:
        dv.status = VariantStatus.PENDING
        dv.errors = None
        dv.warnings = None
        dv.rendered_caption = None
        dv.rendered_blocks = None
        dv.metrics = None
        dv.compiled_at = None
        dv.ir_revision_compiled = None
        dv.updated_at = datetime.utcnow()
        db.add(dv)
    if rows:
        await db.flush()


async def _compile_supported_variants(db: AsyncSession, draft: Draft) -> None:
    """
    실 구현: Celery task로 오프로딩 권장. 여기서는 동기/더미 스켈레톤.
    지원되는 플랫폼만 컴파일하고, 나머지는 PENDING 유지.
    """
    rows: List[DraftVariant] = (await db.execute(
        select(DraftVariant).where(
            DraftVariant.draft_id == draft.id,
            DraftVariant.platform.in_(list(SUPPORTED_COMPILE_PLATFORMS))
        )
    )).scalars().all()

    # 플랫폼 컴파일러를 사용하여 컴파일
    for dv in rows:
        try:
            caption, rendered_blocks, metrics, errors, warnings = compile_for_platform(
                draft.ir, dv.platform.value.lower()
            )
            dv.rendered_caption = caption
            dv.rendered_blocks = rendered_blocks
            dv.metrics = metrics
            dv.errors = errors or None
            dv.warnings = warnings or None
            dv.status = VariantStatus.VALID if not errors else VariantStatus.INVALID
            dv.compiled_at = datetime.utcnow()
            dv.ir_revision_compiled = draft.ir_revision
        except Exception as e:
            # 컴파일 실패 시 에러 기록
            dv.errors = [f"Compilation failed: {str(e)}"]
            dv.status = VariantStatus.INVALID
            dv.compiled_at = datetime.utcnow()
            dv.ir_revision_compiled = draft.ir_revision
        db.add(dv)
    if rows:
        await db.flush()



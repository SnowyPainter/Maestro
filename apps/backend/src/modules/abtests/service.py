from __future__ import annotations

from datetime import datetime
from typing import Optional, Tuple, List

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.abtests.models import ABTest, ABTestWinner
from apps.backend.src.modules.abtests.schemas import (
    ABTestComplete,
    ABTestCreate,
    ABTestFilter,
)
from apps.backend.src.modules.playbooks import service as playbook_service


async def create_abtest(
    db: AsyncSession,
    *,
    payload: ABTestCreate,
) -> ABTest:
    started_at = payload.started_at or datetime.utcnow()
    row = ABTest(
        persona_id=payload.persona_id,
        campaign_id=payload.campaign_id,
        variable=payload.variable,
        hypothesis=payload.hypothesis,
        variant_a_id=payload.variant_a_id,
        variant_b_id=payload.variant_b_id,
        started_at=started_at,
        notes=payload.notes,
    )
    db.add(row)
    await db.flush()
    await db.commit()
    return row


async def list_abtests(
    db: AsyncSession,
    *,
    filters: Optional[ABTestFilter] = None,
    limit: int = 20,
    offset: int = 0,
) -> Tuple[List[ABTest], int]:
    filters = filters or ABTestFilter()
    stmt: Select = select(ABTest)
    if filters.persona_id is not None:
        stmt = stmt.where(ABTest.persona_id == filters.persona_id)
    if filters.campaign_id is not None:
        stmt = stmt.where(ABTest.campaign_id == filters.campaign_id)
    if filters.active_only:
        stmt = stmt.where(ABTest.finished_at.is_(None))

    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(total_stmt)).scalar_one()

    rows = (
        await db.execute(
            stmt.order_by(ABTest.started_at.desc()).limit(limit).offset(offset)
        )
    ).scalars().all()
    return rows, total


async def get_abtest(db: AsyncSession, abtest_id: int) -> Optional[ABTest]:
    return await db.get(ABTest, abtest_id)


async def complete_abtest(
    db: AsyncSession,
    *,
    abtest_id: int,
    payload: ABTestComplete,
) -> ABTest:
    row = await db.get(ABTest, abtest_id)
    if row is None:
        raise ValueError("abtest not found")

    row.finished_at = payload.finished_at or datetime.utcnow()
    row.winner_variant = ABTestWinner(payload.winner_variant.value)
    row.uplift_percentage = payload.uplift_percentage
    if payload.insight_note:
        row.notes = payload.insight_note

    await db.flush()

    await playbook_service.record_abtest_completion(
        db,
        persona_id=row.persona_id,
        campaign_id=row.campaign_id,
        abtest=row,
        insight_note=payload.insight_note,
    )

    await db.commit()
    return row

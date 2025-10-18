from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Tuple, TYPE_CHECKING

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.playbooks.models import Playbook, PlaybookLog
from apps.backend.src.modules.playbooks.schemas import (
    PlaybookAggregatePatch,
    PlaybookEnsureRequest,
    PlaybookLogCreate,
)

if TYPE_CHECKING:
    from apps.backend.src.modules.abtests.models import ABTest


async def ensure_playbook(
    db: AsyncSession,
    *,
    persona_id: int,
    campaign_id: int,
) -> Playbook:
    stmt = (
        select(Playbook)
        .where(
            Playbook.persona_id == persona_id,
            Playbook.campaign_id == campaign_id,
        )
        .limit(1)
    )
    instance = (await db.execute(stmt)).scalar_one_or_none()
    if instance:
        return instance

    now = datetime.utcnow()
    playbook = Playbook(
        persona_id=persona_id,
        campaign_id=campaign_id,
        last_event="initialized",
        last_updated=now,
    )
    db.add(playbook)
    await db.flush()
    return playbook


async def find_playbook(
    db: AsyncSession,
    *,
    persona_id: int,
    campaign_id: int,
) -> Optional[Playbook]:
    stmt = (
        select(Playbook)
        .where(
            Playbook.persona_id == persona_id,
            Playbook.campaign_id == campaign_id,
        )
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def get_playbook(db: AsyncSession, playbook_id: int) -> Optional[Playbook]:
    return await db.get(Playbook, playbook_id)


async def list_playbooks(
    db: AsyncSession,
    *,
    persona_id: Optional[int] = None,
    campaign_id: Optional[int] = None,
    limit: int = 20,
    offset: int = 0,
) -> Tuple[List[Playbook], int]:
    stmt: Select = select(Playbook)
    if persona_id is not None:
        stmt = stmt.where(Playbook.persona_id == persona_id)
    if campaign_id is not None:
        stmt = stmt.where(Playbook.campaign_id == campaign_id)

    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(total_stmt)).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(Playbook.last_updated.desc()).limit(limit).offset(offset)
        )
    ).scalars().all()
    return rows, total


async def record_event(
    db: AsyncSession,
    payload: PlaybookLogCreate,
) -> PlaybookLog:
    playbook = await ensure_playbook(
        db,
        persona_id=payload.persona_id,
        campaign_id=payload.campaign_id,
    )
    ts = payload.timestamp or datetime.utcnow()
    log = PlaybookLog(
        playbook_id=playbook.id,
        event=payload.event,
        timestamp=ts,
        draft_id=payload.draft_id,
        schedule_id=payload.schedule_id,
        abtest_id=payload.abtest_id,
        ref_id=payload.ref_id,
        persona_snapshot=payload.persona_snapshot,
        trend_snapshot=payload.trend_snapshot,
        llm_input=payload.llm_input,
        llm_output=payload.llm_output,
        kpi_snapshot=payload.kpi_snapshot,
        meta=payload.meta,
        message=payload.message,
    )
    db.add(log)

    playbook.last_event = payload.event
    playbook.last_updated = ts
    _apply_patch(playbook, payload.aggregate_patch)

    await db.flush()
    return log


async def record_abtest_completion(
    db: AsyncSession,
    *,
    persona_id: int,
    campaign_id: int,
    abtest: "ABTest",
    insight_note: Optional[str] = None,
) -> PlaybookLog:
    timestamp = abtest.finished_at or datetime.utcnow()
    meta = {
        "variable": abtest.variable,
        "winner_variant": abtest.winner_variant.value if abtest.winner_variant else None,
        "uplift_percentage": abtest.uplift_percentage,
        "variant_a_id": abtest.variant_a_id,
        "variant_b_id": abtest.variant_b_id,
        "hypothesis": abtest.hypothesis,
    }
    return await record_event(
        db,
        PlaybookLogCreate(
            persona_id=persona_id,
            campaign_id=campaign_id,
            event="abtest.completed",
            timestamp=timestamp,
            abtest_id=abtest.id,
            meta=meta,
            message=insight_note,
        ),
    )


async def list_logs(
    db: AsyncSession,
    *,
    playbook_id: int,
    limit: int = 50,
    offset: int = 0,
) -> Tuple[List[PlaybookLog], int]:
    stmt = select(PlaybookLog).where(PlaybookLog.playbook_id == playbook_id)
    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(total_stmt)).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(PlaybookLog.timestamp.desc()).limit(limit).offset(offset)
        )
    ).scalars().all()
    return rows, total


async def update_playbook_fields(
    db: AsyncSession,
    *,
    playbook_id: int,
    patch: PlaybookAggregatePatch,
) -> Playbook:
    playbook = await db.get(Playbook, playbook_id)
    if playbook is None:
        raise ValueError("playbook not found")

    _apply_patch(playbook, patch)
    playbook.last_updated = datetime.utcnow()

    await db.flush()
    await db.commit()
    return playbook


def _apply_patch(playbook: Playbook, patch: Optional[PlaybookAggregatePatch]) -> None:
    if patch is None:
        return
    if patch.aggregate_kpi is not None:
        playbook.aggregate_kpi = patch.aggregate_kpi
    if patch.best_time_window is not None:
        playbook.best_time_window = patch.best_time_window
    if patch.best_tone is not None:
        playbook.best_tone = patch.best_tone
    if patch.top_hashtags is not None:
        playbook.top_hashtags = patch.top_hashtags

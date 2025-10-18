from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional, Tuple, TYPE_CHECKING

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.playbooks.models import Playbook, PlaybookLog
from apps.backend.src.modules.playbooks.schemas import (
    PlaybookAggregatePatch,
    PlaybookLogCreate,
)
from apps.backend.src.modules.accounts.models import Persona, PersonaAccount
from apps.backend.src.modules.drafts.models import Draft, DraftVariant, PostPublication
from apps.backend.src.modules.scheduler.models import Schedule

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
    owner_user_id: Optional[int] = None,
    persona_id: Optional[int] = None,
    campaign_id: Optional[int] = None,
    limit: int = 20,
    offset: int = 0,
) -> Tuple[List[Playbook], int]:
    stmt: Select = select(Playbook)
    if owner_user_id is not None:
        stmt = stmt.join(Playbook.persona).where(Persona.owner_user_id == owner_user_id)
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


def _as_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, bool):
        return int(value)
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None

async def record_playbook_event(
    db: AsyncSession,
    *,
    event: str,
    timestamp: Optional[datetime] = None,
    persona_id: Optional[int] = None,
    persona_account_id: Optional[int] = None,
    campaign_id: Optional[int] = None,
    draft_id: Optional[int] = None,
    variant_id: Optional[int] = None,
    post_publication_id: Optional[int] = None,
    schedule_id: Optional[int] = None,
    ref_id: Optional[int] = None,
    schedule: Optional[Schedule] = None,
    message: Optional[str] = None,
    meta: Optional[dict] = None,
    persona_snapshot: Optional[dict] = None,
    trend_snapshot: Optional[dict] = None,
    llm_input: Optional[dict] = None,
    llm_output: Optional[dict] = None,
    kpi_snapshot: Optional[dict] = None,
    aggregate_patch: Optional[PlaybookAggregatePatch] = None,
) -> Optional[PlaybookLog]:

    def _as_int(v):
        try:
            return int(v) if v is not None else None
        except Exception:
            return None

    persona_id = _as_int(persona_id)
    persona_account_id = _as_int(persona_account_id)
    campaign_id = _as_int(campaign_id)
    draft_id = _as_int(draft_id)
    variant_id = _as_int(variant_id)
    post_publication_id = _as_int(post_publication_id)
    schedule_id = _as_int(schedule_id)
    ref_id = _as_int(ref_id)

    schedule_obj = schedule
    if schedule_obj is None and schedule_id is not None:
        schedule_obj = await db.get(Schedule, schedule_id)

    # --- schedule 정보에서 추론
    if schedule_obj is not None:
        if persona_account_id is None:
            persona_account_id = schedule_obj.persona_account_id

        payload_data = schedule_obj.payload if isinstance(schedule_obj.payload, dict) else {}
        if isinstance(payload_data, dict):
            persona_id = persona_id or _as_int(payload_data.get("persona_id"))
            campaign_id = campaign_id or _as_int(payload_data.get("campaign_id"))
            draft_id = draft_id or _as_int(payload_data.get("draft_id"))
            variant_id = variant_id or _as_int(payload_data.get("variant_id"))
            post_publication_id = post_publication_id or _as_int(payload_data.get("post_publication_id"))

        context_data = schedule_obj.context if isinstance(schedule_obj.context, dict) else {}
        if isinstance(context_data, dict):
            persona_id = persona_id or _as_int(context_data.get("persona_id"))
            campaign_id = campaign_id or _as_int(context_data.get("campaign_id"))

    # --- PostPublication
    if post_publication_id is not None:
        publication = await db.get(PostPublication, post_publication_id)
        if publication:
            persona_account_id = persona_account_id or publication.account_persona_id
            variant_id = variant_id or publication.variant_id

    # --- DraftVariant
    if variant_id is not None:
        variant_row = await db.execute(
            select(DraftVariant.draft_id).where(DraftVariant.id == variant_id)
        )
        draft_id = draft_id or variant_row.scalar()
        if draft_id and campaign_id is None:
            campaign_id = await db.scalar(
                select(Draft.campaign_id).where(Draft.id == draft_id)
            )

    # --- Draft 직접 확인
    if draft_id is not None and campaign_id is None:
        campaign_id = await db.scalar(
            select(Draft.campaign_id).where(Draft.id == draft_id)
        )

    # --- PersonaAccount → Persona
    if persona_account_id is not None and persona_id is None:
        persona_id = await db.scalar(
            select(PersonaAccount.persona_id).where(PersonaAccount.id == persona_account_id)
        )

    # --- 필수 정보 확인
    if persona_id is None or campaign_id is None:
        return None

    payload = PlaybookLogCreate(
        persona_id=persona_id,
        campaign_id=campaign_id,
        event=event,
        timestamp=timestamp,
        draft_id=draft_id,
        schedule_id=schedule_id,
        ref_id=ref_id,
        persona_snapshot=persona_snapshot,
        trend_snapshot=trend_snapshot,
        llm_input=llm_input,
        llm_output=llm_output,
        kpi_snapshot=kpi_snapshot,
        meta=meta,
        message=message,
        aggregate_patch=aggregate_patch,
    )

    return await record_event(db, payload)


async def list_logs_for_persona(
    db: AsyncSession,
    *,
    persona_id: int,
    campaign_id: Optional[int] = None,
    since: Optional[datetime] = None,
    until: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0,
) -> Tuple[List[PlaybookLog], int]:
    stmt = (
        select(PlaybookLog)
        .join(Playbook, Playbook.id == PlaybookLog.playbook_id)
        .where(Playbook.persona_id == persona_id)
    )
    if campaign_id is not None:
        stmt = stmt.where(Playbook.campaign_id == campaign_id)
    if since is not None:
        stmt = stmt.where(PlaybookLog.timestamp >= since)
    if until is not None:
        stmt = stmt.where(PlaybookLog.timestamp <= until)

    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(total_stmt)).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(PlaybookLog.timestamp.desc(), PlaybookLog.id.desc())
            .limit(limit)
            .offset(offset)
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

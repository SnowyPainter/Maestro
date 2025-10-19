from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple, List, Iterable

from sqlalchemy import Select, func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.backend.src.modules.accounts.models import Persona, PersonaAccount, PlatformAccount
from apps.backend.src.modules.campaigns.models import Campaign
from apps.backend.src.modules.abtests.models import ABTest, ABTestWinner
from apps.backend.src.modules.abtests.schemas import (
    ABTestComplete,
    ABTestCreate,
    ABTestFilter,
)
from apps.backend.src.modules.common.enums import ALREADY_PUBLISHED_STATUS, ScheduleStatus
from apps.backend.src.modules.drafts.models import Draft, DraftVariant, PostPublication
from apps.backend.src.modules.drafts.service import (
    get_draft_variant,
    upsert_post_publication_schedule,
)
from apps.backend.src.modules.playbooks import service as playbook_service
from apps.backend.src.modules.scheduler.models import Schedule
from apps.backend.src.modules.scheduler.planner import normalize_due_at
from apps.backend.src.modules.scheduler.registry import ScheduleTemplateKey, compile_schedule_template
from apps.backend.src.modules.scheduler.schemas import (
    ABTestCompleteTemplateParams,
    ABTestScheduleTemplateParams,
    ABTestScheduleVariantParams,
    ScheduleCompileRequest,
    ScheduleDagSpec,
)


def _ensure_distinct_variants(payload: ABTestCreate) -> None:
    if payload.variant_a_id == payload.variant_b_id:
        raise ValueError("variant_a_id and variant_b_id must be different")


async def _load_drafts(
    db: AsyncSession,
    *,
    draft_ids: Iterable[int],
    owner_user_id: Optional[int],
    campaign_id: Optional[int],
) -> Dict[int, Draft]:
    ids = list({int(d) for d in draft_ids})
    if not ids:
        raise ValueError("at least one draft id is required")
    stmt = select(Draft).where(Draft.id.in_(ids))
    rows = (await db.execute(stmt)).scalars().all()
    found = {row.id: row for row in rows}
    missing = [draft_id for draft_id in ids if draft_id not in found]
    if missing:
        raise ValueError(f"draft(s) not found: {missing}")
    for draft in found.values():
        if owner_user_id is not None and draft.user_id != owner_user_id:
            raise PermissionError("draft does not belong to user")
        if campaign_id is not None and draft.campaign_id != campaign_id:
            raise ValueError("draft campaign does not match AB test campaign")
    return found


async def _ensure_variants_available(
    db: AsyncSession,
    *,
    draft_ids: Iterable[int],
) -> None:
    ids = list({int(d) for d in draft_ids})
    if not ids:
        return
    stmt = (
        select(func.count())
        .select_from(ABTest)
        .where(
            ABTest.finished_at.is_(None),
            or_(
                ABTest.variant_a_id.in_(ids),
                ABTest.variant_b_id.in_(ids),
            ),
        )
    )
    count = (await db.execute(stmt)).scalar_one()
    if count:
        raise ValueError("one or more drafts are already used in an active AB test")


async def _ensure_variants_not_published(
    db: AsyncSession,
    *,
    draft_ids: Iterable[int],
) -> None:
    ids = list({int(d) for d in draft_ids})
    if not ids:
        return
    stmt = (
        select(func.count())
        .select_from(PostPublication)
        .join(DraftVariant, DraftVariant.id == PostPublication.variant_id)
        .where(
            DraftVariant.draft_id.in_(ids),
            PostPublication.status.in_(tuple(ALREADY_PUBLISHED_STATUS)),
        )
    )
    count = (await db.execute(stmt)).scalar_one()
    if count:
        raise ValueError("one or more drafts have already been published")


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


async def _load_persona_account_for_abtest(
    db: AsyncSession,
    *,
    persona_account_id: int,
    persona_id: int,
    owner_user_id: int,
) -> tuple[PersonaAccount, PlatformAccount]:
    stmt = (
        select(PersonaAccount)
        .options(selectinload(PersonaAccount.persona))
        .where(PersonaAccount.id == persona_account_id)
    )
    persona_account = (await db.execute(stmt)).scalar_one_or_none()
    if persona_account is None:
        raise ValueError("persona account not found")
    if persona_account.persona_id != persona_id:
        raise ValueError("persona account does not match AB test persona")
    persona = persona_account.persona
    if persona is None:
        persona = await db.get(Persona, persona_account.persona_id)
    if persona is None:
        raise ValueError("persona linked to persona account not found")
    if persona.owner_user_id != owner_user_id:
        raise PermissionError("persona account does not belong to user")

    platform_account = await db.get(PlatformAccount, persona_account.account_id)
    if platform_account is None:
        raise ValueError("platform account linked to persona account not found")
    if platform_account.owner_user_id != owner_user_id:
        raise PermissionError("platform account does not belong to user")
    return persona_account, platform_account


@dataclass
class ABTestScheduleArtifacts:
    publish_schedule: Schedule
    completion_schedule: Schedule | None
    publications: tuple[PostPublication, PostPublication]


async def create_abtest(
    db: AsyncSession,
    *,
    payload: ABTestCreate,
    owner_user_id: Optional[int] = None,
) -> ABTest:
    _ensure_distinct_variants(payload)

    persona = await db.get(Persona, payload.persona_id)
    if persona is None:
        raise ValueError("persona not found")

    campaign = await db.get(Campaign, payload.campaign_id)
    if campaign is None:
        raise ValueError("campaign not found")

    if persona.owner_user_id != campaign.owner_user_id:
        raise ValueError("persona and campaign must belong to the same owner")

    if owner_user_id is not None:
        if persona.owner_user_id != owner_user_id:
            raise PermissionError("persona does not belong to user")
        if campaign.owner_user_id != owner_user_id:
            raise PermissionError("campaign does not belong to user")

    draft_ids = {payload.variant_a_id, payload.variant_b_id}
    drafts = await _load_drafts(
        db,
        draft_ids=draft_ids,
        owner_user_id=owner_user_id,
        campaign_id=payload.campaign_id,
    )

    # Ensure draft ownership matches persona owner even when owner_user_id is not supplied.
    persona_owner = persona.owner_user_id
    for draft in drafts.values():
        if draft.user_id != persona_owner:
            raise ValueError("draft owner does not match persona owner")

    await _ensure_variants_available(db, draft_ids=draft_ids)
    await _ensure_variants_not_published(db, draft_ids=draft_ids)

    started_at_source = payload.started_at or datetime.now(timezone.utc)
    started_at = _to_utc(started_at_source)
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


async def schedule_abtest(
    db: AsyncSession,
    *,
    abtest_id: int,
    persona_account_id: int,
    run_at: datetime,
    owner_user_id: int,
    complete_at: Optional[datetime] = None,
) -> ABTestScheduleArtifacts:
    abtest = await db.get(ABTest, abtest_id)
    if abtest is None:
        raise ValueError("abtest not found")
    if abtest.finished_at is not None:
        raise ValueError("abtest is already completed")

    persona = await db.get(Persona, abtest.persona_id)
    if persona is None:
        raise ValueError("persona not found")
    if persona.owner_user_id != owner_user_id:
        raise PermissionError("persona does not belong to user")

    campaign = await db.get(Campaign, abtest.campaign_id)
    if campaign is None:
        raise ValueError("campaign not found")
    if campaign.owner_user_id != owner_user_id:
        raise PermissionError("campaign does not belong to user")

    run_at_utc = _to_utc(run_at)
    now_utc = datetime.now(timezone.utc)
    if run_at_utc <= now_utc:
        raise ValueError("run_at must be in the future")

    completion_at_utc = _to_utc(complete_at) if complete_at is not None else None
    if completion_at_utc is not None and completion_at_utc <= run_at_utc:
        raise ValueError("complete_at must be after run_at")

    persona_account, platform_account = await _load_persona_account_for_abtest(
        db,
        persona_account_id=persona_account_id,
        persona_id=abtest.persona_id,
        owner_user_id=owner_user_id,
    )

    draft_ids = (abtest.variant_a_id, abtest.variant_b_id)
    drafts = await _load_drafts(
        db,
        draft_ids=draft_ids,
        owner_user_id=owner_user_id,
        campaign_id=abtest.campaign_id,
    )

    variant_a = await get_draft_variant(
        db,
        draft_id=abtest.variant_a_id,
        user_id=owner_user_id,
        platform=platform_account.platform,
        draft=drafts[abtest.variant_a_id],
    )
    if variant_a is None:
        raise ValueError("draft for variant A is not available for the target platform")

    variant_b = await get_draft_variant(
        db,
        draft_id=abtest.variant_b_id,
        user_id=owner_user_id,
        platform=platform_account.platform,
        draft=drafts[abtest.variant_b_id],
    )
    if variant_b is None:
        raise ValueError("draft for variant B is not available for the target platform")

    publication_a = await upsert_post_publication_schedule(
        db,
        variant=variant_a,
        persona_account_id=persona_account.id,
        scheduled_at=run_at_utc,
        owner_user_id=owner_user_id,
    )
    publication_b = await upsert_post_publication_schedule(
        db,
        variant=variant_b,
        persona_account_id=persona_account.id,
        scheduled_at=run_at_utc,
        owner_user_id=owner_user_id,
    )

    variant_a_params = ABTestScheduleVariantParams(
        label="A",
        post_publication_id=publication_a.id,
        persona_account_id=persona_account.id,
        variant_id=variant_a.id,
        draft_id=variant_a.draft_id,
        platform=variant_a.platform,
    )
    variant_b_params = ABTestScheduleVariantParams(
        label="B",
        post_publication_id=publication_b.id,
        persona_account_id=persona_account.id,
        variant_id=variant_b.id,
        draft_id=variant_b.draft_id,
        platform=variant_b.platform,
    )

    schedule_request = ABTestScheduleTemplateParams(
        abtest_id=abtest.id,
        persona_id=abtest.persona_id,
        campaign_id=abtest.campaign_id,
        persona_account_id=persona_account.id,
        variant_a=variant_a_params,
        variant_b=variant_b_params,
    )
    schedule_compile_request = ScheduleCompileRequest(
        template=ScheduleTemplateKey.SCHEDULE_AB_TEST,
        abtest_schedule=schedule_request,
    )
    schedule_spec: ScheduleDagSpec = compile_schedule_template(schedule_compile_request).dag_spec
    schedule_dict = schedule_spec.model_dump(by_alias=True, exclude_none=True)

    due_at_naive = normalize_due_at(run_at_utc)
    scheduled_iso = due_at_naive.replace(tzinfo=timezone.utc).isoformat()

    schedule = Schedule(
        persona_account_id=persona_account.id,
        dag_spec=schedule_dict,
        payload=schedule_spec.payload,
        context={
            "template": ScheduleTemplateKey.SCHEDULE_AB_TEST.value,
            "abtest_id": abtest.id,
            "persona_id": abtest.persona_id,
            "campaign_id": abtest.campaign_id,
            "persona_account_id": persona_account.id,
            "post_publication_ids": [publication_a.id, publication_b.id],
            "scheduled_for": scheduled_iso,
        },
        status=ScheduleStatus.PENDING.value,
        due_at=due_at_naive,
        queue="coworker",
        idempotency_key=f"abtest:{abtest.id}:persona_account:{persona_account.id}:run:{scheduled_iso}",
    )
    db.add(schedule)
    await db.flush()

    publications_with_labels = [("A", publication_a), ("B", publication_b)]
    timestamp = datetime.now(timezone.utc)
    base_meta = {
        "schedule_label": ScheduleTemplateKey.SCHEDULE_AB_TEST.value,
        "schedule_id": schedule.id,
        "scheduled_at": scheduled_iso,
        "abtest_id": abtest.id,
        "persona_account_id": persona_account.id,
    }
    for label, publication in publications_with_labels:
        meta = dict(publication.meta or {})
        meta.update(base_meta)
        meta["abtest_variant"] = label
        publication.meta = meta
        publication.updated_at = timestamp
        db.add(publication)

    completion_schedule: Schedule | None = None
    completion_iso: Optional[str] = None
    if completion_at_utc is not None:
        completion_request = ScheduleCompileRequest(
            template=ScheduleTemplateKey.COMPLETE_AB_TEST,
            abtest_complete=ABTestCompleteTemplateParams(
                abtest_id=abtest.id,
                persona_id=abtest.persona_id,
                campaign_id=abtest.campaign_id,
                persona_account_id=persona_account.id,
                publish_schedule_id=schedule.id,
                post_publication_ids=[publication_a.id, publication_b.id],
            ),
        )
        completion_spec: ScheduleDagSpec = compile_schedule_template(completion_request).dag_spec
        completion_dict = completion_spec.model_dump(by_alias=True, exclude_none=True)
        completion_due = normalize_due_at(completion_at_utc)
        completion_iso = completion_due.replace(tzinfo=timezone.utc).isoformat()

        completion_schedule = Schedule(
            persona_account_id=persona_account.id,
            dag_spec=completion_dict,
            payload=completion_spec.payload,
            context={
                "template": ScheduleTemplateKey.COMPLETE_AB_TEST.value,
                "abtest_id": abtest.id,
                "persona_id": abtest.persona_id,
                "campaign_id": abtest.campaign_id,
                "publish_schedule_id": schedule.id,
                "scheduled_for": completion_iso,
            },
            status=ScheduleStatus.PENDING.value,
            due_at=completion_due,
            queue="coworker",
            idempotency_key=f"abtest:{abtest.id}:complete:{completion_iso}",
        )
        db.add(completion_schedule)
        await db.flush()

        completion_meta = {
            "completion_schedule_id": completion_schedule.id,
            "completion_scheduled_at": completion_iso,
        }
        for _, publication in publications_with_labels:
            meta = dict(publication.meta or {})
            meta.update(completion_meta)
            publication.meta = meta
            publication.updated_at = timestamp
            db.add(publication)

    meta_payload = {
        key: value
        for key, value in {
            "template": ScheduleTemplateKey.SCHEDULE_AB_TEST.value,
            "persona_account_id": persona_account.id,
            "post_publication_ids": [publication_a.id, publication_b.id],
            "completion_schedule_id": completion_schedule.id if completion_schedule else None,
            "run_at": scheduled_iso,
            "complete_at": completion_iso,
        }.items()
        if value is not None
    }

    await playbook_service.record_playbook_event(
        db,
        event="abtest.scheduled",
        schedule_id=schedule.id,
        schedule=schedule,
        persona_id=abtest.persona_id,
        persona_account_id=persona_account.id,
        campaign_id=abtest.campaign_id,
        abtest_id=abtest.id,
        meta=meta_payload,
    )

    await db.commit()
    return ABTestScheduleArtifacts(
        publish_schedule=schedule,
        completion_schedule=completion_schedule,
        publications=(publication_a, publication_b),
    )

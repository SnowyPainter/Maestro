from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple, List, Iterable, Any

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
    ABTestInsightSummary,
    ABTestVariantInsight,
    ABTestDetermineWinnerResult,
)
from apps.backend.src.modules.common.enums import ALREADY_PUBLISHED_STATUS, KPIKey
from apps.backend.src.modules.drafts.models import Draft, DraftVariant, PostPublication
from apps.backend.src.modules.drafts.service import (
    get_draft_variant,
    upsert_post_publication_schedule,
)
from apps.backend.src.modules.insights.models import InsightSample
from apps.backend.src.modules.insights.schemas import InsightCommentOut
from apps.backend.src.modules.insights.service import list_insight_comments
from apps.backend.src.modules.playbooks import service as playbook_service
from apps.backend.src.modules.scheduler.registry import ScheduleTemplateKey
from apps.backend.src.modules.scheduler.schemas import (
    ABTestScheduleTemplateParams,
    ABTestScheduleVariantParams,
    ScheduleCompileRequest,
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
class ABTestSchedulePlan:
    abtest: ABTest
    persona_account_id: int
    variant_a: Optional[ABTestScheduleVariantParams]
    variant_b: Optional[ABTestScheduleVariantParams]
    publish_request: Optional[ScheduleCompileRequest]
    completion_params: Optional[Dict[str, object]]
    publications: tuple[PostPublication, ...]
    run_at: datetime
    complete_at: Optional[datetime]


_METRIC_PRIORITY: Tuple[str, ...] = (
    KPIKey.LINK_CLICKS.value,
    KPIKey.CTR.value,
    KPIKey.ER.value,
    KPIKey.PROFILE_VISITS.value,
    KPIKey.REACH.value,
    KPIKey.IMPRESSIONS.value,
    KPIKey.LIKES.value,
    KPIKey.COMMENTS.value,
    KPIKey.SHARES.value,
    KPIKey.SAVES.value,
    KPIKey.FOLLOWS.value,
)


async def _latest_sample_for_publication(
    db: AsyncSession,
    *,
    post_publication_id: int,
) -> Optional[InsightSample]:
    stmt = (
        select(InsightSample)
        .where(InsightSample.post_publication_id == post_publication_id)
        .order_by(InsightSample.ts.desc(), InsightSample.id.desc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalars().first()


async def _collect_variant_insight(
    db: AsyncSession,
    *,
    draft_id: int,
    persona_id: int,
    comment_limit: int = 5,
) -> ABTestVariantInsight:
    # ABTest의 경우, 이미 스케줄링된 PostPublication들이 있으므로 이를 통해 publications을 찾음
    # draft_id를 통해 해당 draft의 모든 publications을 찾음
    stmt = select(PostPublication).join(
        DraftVariant, DraftVariant.id == PostPublication.variant_id
    ).join(
        PersonaAccount, PersonaAccount.id == PostPublication.account_persona_id
    ).where(
        DraftVariant.draft_id == draft_id,
        PersonaAccount.persona_id == persona_id,
    ).order_by(PostPublication.created_at.desc())

    publications = (await db.execute(stmt)).scalars().all()
    publication_ids = [pub.id for pub in publications]
    
    metrics: Dict[str, float] = {}
    latest_sample_at: Optional[datetime] = None

    for ppid in publication_ids:
        sample = await _latest_sample_for_publication(db, post_publication_id=ppid)
        if sample is None:
            continue

        if latest_sample_at is None or (
            sample.ts and (latest_sample_at is None or sample.ts > latest_sample_at)
        ):
            latest_sample_at = sample.ts

        for key, value in (sample.metrics or {}).items():
            if not isinstance(key, str):
                continue
            try:
                metrics[key] = metrics.get(key, 0.0) + float(value)
            except (TypeError, ValueError):
                continue

    comments: List[InsightCommentOut] = []
    seen_comment_ids: set[str] = set()
    for ppid in publication_ids:
        comment_list = await list_insight_comments(
            db,
            post_publication_id=ppid,
            limit=comment_limit,
        )
        for comment in comment_list.comments:
            comment_id = f"{comment.platform}:{comment.comment_external_id}"
            if comment_id in seen_comment_ids:
                continue
            seen_comment_ids.add(comment_id)
            comments.append(comment)
            if len(comments) >= comment_limit:
                break
        if len(comments) >= comment_limit:
            break

    return ABTestVariantInsight(
        variant_id=draft_id,  # draft_id를 variant_id로 사용
        post_publication_ids=publication_ids,
        latest_sample_at=latest_sample_at,
        metrics=metrics,
        comments=comments,
    )


def _decide_winner(
    variant_a: ABTestVariantInsight,
    variant_b: ABTestVariantInsight,
) -> tuple[Optional[str], Optional[str], Optional[float], Optional[float], Optional[float]]:
    metrics_a = variant_a.metrics or {}
    metrics_b = variant_b.metrics or {}

    epsilon = 1e-6

    for metric_key in _METRIC_PRIORITY:
        value_a = metrics_a.get(metric_key)
        value_b = metrics_b.get(metric_key)

        if value_a is None and value_b is None:
            continue

        try:
            a = float(value_a) if value_a is not None else 0.0
            b = float(value_b) if value_b is not None else 0.0
        except (TypeError, ValueError):
            continue

        if abs(a - b) <= epsilon and (a <= epsilon and b <= epsilon):
            continue

        if a > b + epsilon:
            if b > epsilon:
                uplift = (a - b) / b * 100.0
            else:
                uplift = 100.0  # baseline is zero; treat as full improvement
            return "A", metric_key, a, b, uplift
        if b > a + epsilon:
            if a > epsilon:
                uplift = (b - a) / a * 100.0
            else:
                uplift = 100.0  # baseline is zero; treat as full improvement
            return "B", metric_key, b, a, uplift

    return None, None, None, None, None


async def collect_abtest_insights(
    db: AsyncSession,
    *,
    abtest_id: int,
    owner_user_id: Optional[int] = None,
    comment_limit: int = 5,
) -> ABTestInsightSummary:
    abtest = await get_abtest(db, abtest_id)
    if abtest is None:
        raise ValueError("AB test not found")

    persona = await db.get(Persona, abtest.persona_id)
    if persona is None:
        raise ValueError("persona not found for AB test")
    if owner_user_id is not None and persona.owner_user_id != owner_user_id:
        raise PermissionError("AB test does not belong to user")

    variant_a = await _collect_variant_insight(
        db,
        draft_id=abtest.variant_a_id,
        persona_id=abtest.persona_id,
        comment_limit=comment_limit,
    )
    variant_b = await _collect_variant_insight(
        db,
        draft_id=abtest.variant_b_id,
        persona_id=abtest.persona_id,
        comment_limit=comment_limit,
    )

    winner, metric_key, winner_value, loser_value, uplift = _decide_winner(variant_a, variant_b)

    return ABTestInsightSummary(
        variant_a=variant_a,
        variant_b=variant_b,
        decision_metric=metric_key,
        winner_variant=winner,
        winner_value=winner_value,
        loser_value=loser_value,
        uplift_percentage=uplift,
    )


async def determine_abtest_winner(
    db: AsyncSession,
    *,
    abtest_id: int,
    owner_user_id: Optional[int] = None,
) -> ABTestDetermineWinnerResult:
    summary = await collect_abtest_insights(
        db,
        abtest_id=abtest_id,
        owner_user_id=owner_user_id,
    )

    if not summary.winner_variant or not summary.decision_metric:
        raise ValueError("insufficient insight data to determine winner")

    finished_at = datetime.now(timezone.utc)
    winner_label = summary.winner_variant
    metric_label = summary.decision_metric

    insight_note = None
    if summary.winner_value is not None and summary.loser_value is not None:
        insight_note = (
            f"Variant {winner_label} outperformed based on '{metric_label}': "
            f"{summary.winner_value:.2f} vs {summary.loser_value:.2f}"
        )
    elif summary.winner_value is not None:
        insight_note = (
            f"Variant {winner_label} selected automatically using '{metric_label}' "
            f"value {summary.winner_value:.2f}"
        )

    return ABTestDetermineWinnerResult(
        abtest_id=abtest_id,
        winner_variant=winner_label,
        decision_metric=metric_label,
        winner_value=summary.winner_value,
        loser_value=summary.loser_value,
        uplift_percentage=summary.uplift_percentage,
        insight_note=insight_note,
        finished_at=finished_at,
    )
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
    owner_user_id: Optional[int] = None,
    limit: int = 20,
    offset: int = 0,
) -> Tuple[List[ABTest], int]:
    filters = filters or ABTestFilter()
    stmt: Select = select(ABTest)
    if owner_user_id is not None:
        stmt = stmt.join(ABTest.persona).where(Persona.owner_user_id == owner_user_id)
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
            stmt.order_by(ABTest.started_at.desc(), ABTest.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()
    return rows, total


async def get_abtest(db: AsyncSession, abtest_id: int) -> Optional[ABTest]:
    return await db.get(ABTest, abtest_id)


async def update_abtest(
    db: AsyncSession,
    *,
    abtest_id: int,
    owner_user_id: Optional[int],
    variable: Optional[str] = None,
    hypothesis: Optional[str] = None,
    notes: Optional[str] = None,
    started_at: Optional[datetime] = None,
) -> ABTest:
    row = await db.get(ABTest, abtest_id)
    if row is None:
        raise ValueError("abtest not found")

    if owner_user_id is not None:
        persona = await db.get(Persona, row.persona_id)
        if persona is None or persona.owner_user_id != owner_user_id:
            raise PermissionError("abtest does not belong to user")

    if variable is not None:
        row.variable = variable
    if hypothesis is not None:
        row.hypothesis = hypothesis
    if notes is not None:
        row.notes = notes
    if started_at is not None:
        row.started_at = _to_utc(started_at)

    await db.flush()
    await db.commit()
    await db.refresh(row)
    return row


async def delete_abtest(
    db: AsyncSession,
    *,
    abtest_id: int,
    owner_user_id: Optional[int],
) -> None:
    row = await db.get(ABTest, abtest_id)
    if row is None:
        raise ValueError("abtest not found")

    if owner_user_id is not None:
        persona = await db.get(Persona, row.persona_id)
        if persona is None or persona.owner_user_id != owner_user_id:
            raise PermissionError("abtest does not belong to user")

    await db.delete(row)
    await db.commit()


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

    kpi_snapshot: Optional[dict] = None
    try:
        summary = await collect_abtest_insights(
            db,
            abtest_id=abtest_id,
        )
        kpi_snapshot = {
            "decision_metric": summary.decision_metric,
            "winner_variant": summary.winner_variant,
            "winner_value": summary.winner_value,
            "loser_value": summary.loser_value,
            "uplift_percentage": summary.uplift_percentage,
            "variant_a": {
                "draft_id": row.variant_a_id,
                "post_publication_ids": summary.variant_a.post_publication_ids,
                "metrics": summary.variant_a.metrics,
            },
            "variant_b": {
                "draft_id": row.variant_b_id,
                "post_publication_ids": summary.variant_b.post_publication_ids,
                "metrics": summary.variant_b.metrics,
            },
        }
    except Exception:
        kpi_snapshot = None

    await playbook_service.record_abtest_completion(
        db,
        persona_id=row.persona_id,
        campaign_id=row.campaign_id,
        abtest=row,
        insight_note=payload.insight_note,
        kpi_snapshot=kpi_snapshot,
    )

    await db.commit()
    return row


async def get_abtest_existing_publications(
    db: AsyncSession,
    *,
    abtest_id: int,
    persona_account_id: int,
) -> List[PostPublication]:
    """AB Test의 기존 스케줄된 publications을 가져옵니다."""
    abtest = await db.get(ABTest, abtest_id)
    if abtest is None:
        return []

    # AB Test의 두 draft에 속한 모든 variants 찾기
    stmt = select(DraftVariant.id).where(
        DraftVariant.draft_id.in_([abtest.variant_a_id, abtest.variant_b_id])
    )
    result = await db.execute(stmt)
    variant_ids = [row[0] for row in result.all()]

    if not variant_ids:
        return []

    # 해당 variant들에 해당하는 publications 찾기
    stmt = select(PostPublication).where(
        PostPublication.variant_id.in_(variant_ids),
        PostPublication.account_persona_id == persona_account_id,
        PostPublication.status.in_(tuple(ALREADY_PUBLISHED_STATUS)),  # 이미 스케줄된 것들만
    ).order_by(PostPublication.scheduled_at.desc())

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def schedule_abtest(
    db: AsyncSession,
    *,
    abtest_id: int,
    persona_account_id: int,
    run_at: datetime,
    owner_user_id: int,
    complete_at: Optional[datetime] = None,
) -> ABTestSchedulePlan:
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

    # 기존에 이미 스케줄된 publications이 있는지 확인
    existing_publications = await get_abtest_existing_publications(
        db,
        abtest_id=abtest_id,
        persona_account_id=persona_account_id,
    )

    
    run_at_utc = _to_utc(run_at)
    now_utc = datetime.now(timezone.utc)
    if run_at_utc <= now_utc and len(existing_publications) < 2:
        raise ValueError("run_at must be in the future")

    completion_at_utc = _to_utc(complete_at) if complete_at is not None else None
    if completion_at_utc is not None and completion_at_utc <= run_at_utc:
        raise ValueError("complete_at must be after run_at")

    # 이미 publications이 존재하면 publish 스케줄링은 건너뜀
    if len(existing_publications) >= 2:
        # 기존 publications 사용
        publication_a = existing_publications[0]
        publication_b = existing_publications[1]

        existing_scheduled_ats = [pub.scheduled_at or pub.published_at for pub in existing_publications]

        # completion time 검증 (publish time는 기존 publications의 시간 사용)
        existing_scheduled_at = max(existing_scheduled_ats)
        if completion_at_utc is not None and completion_at_utc <= existing_scheduled_at:
            raise ValueError("complete_at must be after publication time")

        # variant 정보 재구성
        variant_a = await db.get(DraftVariant, publication_a.variant_id)
        variant_b = await db.get(DraftVariant, publication_b.variant_id)

        if variant_a is None or variant_b is None:
            raise ValueError("Draft variants not found")

        # variant_a와 variant_b를 올바르게 매핑
        if variant_a.draft_id == abtest.variant_a_id:
            variant_a_variant = variant_a
            variant_b_variant = variant_b
        else:
            variant_a_variant = variant_b
            variant_b_variant = variant_a
            # publications 순서도 맞춰줌
            publication_a, publication_b = publication_b, publication_a

        # completion_params 생성 - 기존 publish schedule id 찾기
        completion_params = None
        if completion_at_utc is not None:
            completion_params = {
                "abtest_id": abtest.id,
                "persona_id": abtest.persona_id,
                "campaign_id": abtest.campaign_id,
                "persona_account_id": persona_account.id,
                "post_publication_ids": [publication_a.id, publication_b.id],
            }

        return ABTestSchedulePlan(
            abtest=abtest,
            persona_account_id=persona_account.id,
            variant_a=None,  # publish 스케줄링 안 함
            variant_b=None,  # publish 스케줄링 안 함
            publish_request=None,  # publish 스케줄링 안 함
            completion_params=completion_params,
            publications=(publication_a, publication_b),  # 기존 publications 사용
            run_at=existing_scheduled_at,  # 기존 publication 시간
            complete_at=completion_at_utc,
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
    completion_payload: Optional[Dict[str, object]] = None
    if completion_at_utc is not None:
        completion_payload = {
            "abtest_id": abtest.id,
            "persona_id": abtest.persona_id,
            "campaign_id": abtest.campaign_id,
            "persona_account_id": persona_account.id,
            "post_publication_ids": [publication_a.id, publication_b.id],
        }

    await db.flush()
    return ABTestSchedulePlan(
        abtest=abtest,
        persona_account_id=persona_account.id,
        variant_a=variant_a_params,
        variant_b=variant_b_params,
        publish_request=schedule_compile_request,
        completion_params=completion_payload,
        publications=(publication_a, publication_b),
        run_at=run_at_utc,
        complete_at=completion_at_utc,
    )

"""Action flows for schedule and automation management."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from apps.backend.src.modules.scheduler.models import Schedule
from apps.backend.src.modules.common.enums import ScheduleStatus
from apps.backend.src.modules.scheduler.registry import (
    ScheduleTemplateDefinition,
    ScheduleTemplateKey,
    TemplateVisibility,
    compile_schedule_template,
    list_schedule_templates,
)
from apps.backend.src.modules.scheduler.schemas import (
    ScheduleCompileRequest,
    ScheduleCompileResult,
    CancelPostScheduleCommand,
    MailScheduleBatchRequest,
    ScheduleCreateFromRawDagRequest,
    CancelSchedulesCommand,
)
from apps.backend.src.modules.scheduler.planner import (
    normalize_due_at,
    plan_mail_schedule_instances,
)
from apps.backend.src.orchestrator.flows.action.drafts import MessageOut
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator
from apps.backend.src.modules.drafts.service import (
    cancel_post_publication,
    _load_owned_draft,
    remove_publication_schedule,
    upsert_post_publication_schedule,
    ensure_publication_schedule,
)
from apps.backend.src.modules.drafts.models import PostPublication

# ---- 공통 유틸: DB가 TIMESTAMP WITHOUT TIME ZONE이면 모든 dt를 UTC-naive로 강제 ----
def to_utc_naive(dt: datetime) -> datetime:
    """
    - aware -> UTC로 변환 후 tzinfo 제거
    - naive -> 그대로 사용 (이미 UTC라고 가정)
    """
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)

def opt_to_utc_naive(dt: Optional[datetime]) -> Optional[datetime]:
    return None if dt is None else to_utc_naive(dt)

# ---- 오퍼레이터 ----

# ---------------------------------------------------------------------------
# Template metadata helpers
# ---------------------------------------------------------------------------


class ScheduleTemplateSummary(BaseModel):
    key: ScheduleTemplateKey
    title: str
    description: str
    visibility: TemplateVisibility


class ListScheduleTemplatesResult(BaseModel):
    templates: List[ScheduleTemplateSummary]


class ScheduleCreateResult(BaseModel):
    schedule_ids: List[int]

class _EmptyPayload(BaseModel):
    """Placeholder model for GET endpoints."""


class DraftPostScheduleRequest(BaseModel):
    persona_account_id: int
    variant_id: int
    run_at: datetime



# ---------------------------------------------------------------------------
# Template-based helpers (retained for compatibility)
# ---------------------------------------------------------------------------


@operator(
    key="action.schedule.compile_template",
    title="Compile Schedule Template",
    side_effect="read",
)
async def op_compile_schedule_template(
    payload: ScheduleCompileRequest,
    ctx: TaskContext,
) -> ScheduleCompileResult:
    return compile_schedule_template(payload)


@FLOWS.flow(
    key="action.schedule.compile_template",
    title="Compile Schedule DAG",
    description="Generate a schedule DAG specification from higher level template parameters",
    input_model=ScheduleCompileRequest,
    output_model=ScheduleCompileResult,
    method="post",
    path="/actions/schedules/compile",
    tags=("action", "schedule", "dag", "compile"),
)
def _flow_compile_schedule(builder: FlowBuilder):
    task = builder.task("compile_template", "action.schedule.compile_template")
    builder.expect_terminal(task)

@operator(
    key="action.schedule.create_from_raw_dag",
    title="Create Schedule(s) From DAG",
    side_effect="write",
)
async def op_create_schedule_from_raw_dag(
    payload: ScheduleCreateFromRawDagRequest,
    ctx: TaskContext,
) -> ScheduleCreateResult:
    dag_spec = payload.dag_spec
    if payload.meta:
        merged_meta = dict(dag_spec.meta or {})
        merged_meta.update(payload.meta)
        dag_spec = dag_spec.model_copy(update={"meta": merged_meta})

    dag_json = dag_spec.model_dump(by_alias=True, exclude_none=True)
    dag_payload = dag_spec.payload

    db: AsyncSession = ctx.require(AsyncSession)

    schedule_ids: List[int] = []
    run_at = normalize_due_at(payload.run_at)
    interval = timedelta(minutes=payload.repeat_interval_minutes)

    for _ in range(payload.repeats):
        schedule = Schedule(
            persona_account_id=payload.persona_account_id,
            dag_spec=dag_json,
            payload=dag_payload,
            context={},
            status=ScheduleStatus.PENDING.value,
            due_at=run_at,
            queue=payload.queue,
            idempotency_key=uuid4().hex,
        )
        db.add(schedule)
        await db.flush()
        schedule_ids.append(schedule.id)
        run_at = normalize_due_at(run_at + interval) if interval else run_at

    await db.commit()
    return ScheduleCreateResult(schedule_ids=schedule_ids)


@operator(
    key="action.schedule.create_draft_post_schedule",
    title="Create Draft Post Schedule",
    side_effect="write",
)
async def op_create_draft_post_schedule(
    payload: DraftPostScheduleRequest,
    ctx: TaskContext,
) -> ScheduleCreateResult:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    variant = await _load_owned_draft(
        db,
        variant_id=payload.variant_id,
        owner_user_id=user.id,  
    )

    try:
        publication = await upsert_post_publication_schedule(
            db,
            variant=variant,
            persona_account_id=payload.persona_account_id,
            scheduled_at=payload.run_at,
            owner_user_id=user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    schedule = await ensure_publication_schedule(
        db,
        publication=publication,
        variant=variant,
        persona_account_id=payload.persona_account_id,
        scheduled_at=payload.run_at,
    )

    schedule_context = schedule.context_data()
    schedule_context.setdefault("template", ScheduleTemplateKey.POST_PUBLISH.value)
    schedule_context["scheduled_via"] = "action.schedule.create_draft_post_schedule"
    schedule_context["requested_at"] = datetime.now(timezone.utc).isoformat()
    scheduled_for = schedule.due_at or payload.run_at
    if scheduled_for.tzinfo is None:
        scheduled_for = scheduled_for.replace(tzinfo=timezone.utc)
    else:
        scheduled_for = scheduled_for.astimezone(timezone.utc)
    schedule_context["scheduled_for"] = scheduled_for.isoformat()
    schedule_context["user_id"] = user.id
    schedule.context = schedule_context
    db.add(schedule)

    await db.commit()
    return ScheduleCreateResult(schedule_ids=[schedule.id])

@operator(
    key="action.schedule.cancel_draft_post_schedule",
    title="Cancel Post Schedule",
    side_effect="write",
)
async def op_cancel_post_schedule(
    payload: CancelPostScheduleCommand,
    ctx: TaskContext,
) -> MessageOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    variant = await _load_owned_draft(db, variant_id=payload.variant_id, owner_user_id=user.id)

    publication: PostPublication | None = await cancel_post_publication(
        db,
        variant=variant,
        persona_account_id=payload.persona_account_id,
        owner_user_id=user.id,
    )
    if publication is None:
        raise HTTPException(status_code=404, detail="Publication not found")
    await remove_publication_schedule(db, publication=publication)
    await db.commit()
    await db.refresh(publication)
    return MessageOut(message="Post schedule cancelled")


def _infer_schedule_template(schedule: Schedule) -> Optional[str]:
    context = schedule.context_data()
    template = context.get("template") if isinstance(context, dict) else None
    if isinstance(template, str):
        return template

    dag_spec = schedule.dag_spec
    if isinstance(dag_spec, dict):
        meta = dag_spec.get("meta")
        if isinstance(meta, dict):
            label = meta.get("label") or meta.get("kind")
            if isinstance(label, str):
                return label
    return None


async def _cancel_post_publish_schedule(
    db: AsyncSession,
    *,
    schedule: Schedule,
    user: Optional[User],
) -> bool:
    if user is None:
        return False

    payload = schedule.payload_data()
    variant_id = payload.get("variant_id")
    persona_account_id = payload.get("persona_account_id", schedule.persona_account_id)

    if variant_id is None or persona_account_id is None:
        return False

    try:
        variant_id_int = int(variant_id)
        persona_account_id_int = int(persona_account_id)
    except (TypeError, ValueError):
        return False

    variant = await _load_owned_draft(
        db,
        variant_id=variant_id_int,
        owner_user_id=user.id,
    )
    try:
        publication = await cancel_post_publication(
            db,
            variant=variant,
            persona_account_id=persona_account_id_int,
            owner_user_id=user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await remove_publication_schedule(db, publication=publication)
    return True


@operator(
    key="action.schedule.create_trends_mail_schedule",
    title="Create Trends Mail Schedule",
    side_effect="write",
)
async def op_create_trends_mail_schedule(
    payload: MailScheduleBatchRequest,
    ctx: TaskContext,
) -> ScheduleCreateResult:
    db: AsyncSession = ctx.require(AsyncSession)
    user: Optional[User] = ctx.optional(User)

    compile_request = ScheduleCompileRequest(
        template=ScheduleTemplateKey.MAIL_TRENDS_WITH_REPLY,
        mail=payload.payload_template,
    )
    compile_result = compile_schedule_template(compile_request)
    dag_spec = compile_result.dag_spec

    try:
        planned_instances = plan_mail_schedule_instances(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not planned_instances:
        raise HTTPException(
            status_code=400,
            detail="no schedule instances could be generated for the provided window",
        )

    base_meta = dict(dag_spec.meta or {})
    if payload.title:
        base_meta.setdefault("title", payload.title)
        base_meta["plan_title"] = payload.title

    base_context: Dict[str, Any] = {
        "template": ScheduleTemplateKey.MAIL_TRENDS_WITH_REPLY.value,
        "plan_timezone": payload.timezone,
    }
    if payload.title:
        base_context["plan_title"] = payload.title
    if user is not None:
        base_context["user_id"] = user.id

    persona_account_id = payload.payload_template.persona_account_id
    queue = payload.queue or "coworker"
    schedule_ids: List[int] = []

    for instance in planned_instances:
        segment_id = instance.segment_id
        local_dt = instance.local_due_at
        due_at_utc = instance.due_at_utc
        index = instance.schedule_index
        meta = dict(base_meta)
        meta.update(
            {
                "plan_segment": segment_id,
                "scheduled_for": local_dt.isoformat(),
                "schedule_index": index,
            }
        )
        spec_instance = dag_spec.model_copy(update={"meta": meta})
        dag_json = spec_instance.model_dump(by_alias=True, exclude_none=True)

        schedule_context = dict(base_context)
        schedule_context.update(
            {
                "plan_segment": segment_id,
                "plan_local_due": local_dt.isoformat(),
                "schedule_index": index,
            }
        )

        schedule = Schedule(
            persona_account_id=persona_account_id,
            dag_spec=dag_json,
            payload=spec_instance.payload,
            context=schedule_context,
            status=ScheduleStatus.PENDING.value,
            due_at=normalize_due_at(due_at_utc),
            queue=queue,
            idempotency_key=uuid4().hex,
        )
        db.add(schedule)
        await db.flush()
        schedule_ids.append(schedule.id)

    await db.commit()
    return ScheduleCreateResult(schedule_ids=schedule_ids)

@operator(
    key="action.schedule.cancel_schedules",
    title="Cancel Schedules",
    side_effect="write",
)
async def op_cancel_schedules(
    payload: CancelSchedulesCommand,
    ctx: TaskContext,
) -> MessageOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: Optional[User] = ctx.optional(User)

    # 최소 한 개의 필터는 필요
    if not any([
        payload.schedule_ids,
        payload.persona_account_id is not None,
        payload.status is not None,
        payload.window_start is not None,
        payload.window_end is not None,
    ]):
        raise HTTPException(status_code=400, detail="at least one filter must be provided")

    # 필터의 날짜도 모두 UTC-naive로 정규화
    window_start_naive = opt_to_utc_naive(payload.window_start)
    window_end_naive   = opt_to_utc_naive(payload.window_end)

    stmt = select(Schedule)
    if payload.schedule_ids:
        stmt = stmt.where(Schedule.id.in_(payload.schedule_ids))
    if payload.persona_account_id is not None:
        stmt = stmt.where(Schedule.persona_account_id == payload.persona_account_id)
    if payload.status is not None:
        stmt = stmt.where(Schedule.status == payload.status.value)
    if window_start_naive is not None:
        stmt = stmt.where(Schedule.due_at >= window_start_naive)
    if window_end_naive is not None:
        stmt = stmt.where(Schedule.due_at <= window_end_naive)

    result = await db.execute(stmt)
    schedules: List[Schedule] = list(result.scalars().all())

    if not schedules:
        return MessageOut(message="No schedules matched the provided filters")

    cancellable_statuses = {
        ScheduleStatus.PENDING.value,
        ScheduleStatus.ENQUEUED.value,
        ScheduleStatus.RUNNING.value,
        ScheduleStatus.FAILED.value,
    }

    # DB 컬럼이 TIMESTAMP WITHOUT TIME ZONE 이므로 UTC-naive 값으로 저장
    now_utc_naive = datetime.now(timezone.utc).replace(tzinfo=None)

    cancelled = 0
    for schedule in schedules:
        if schedule.status not in cancellable_statuses:
            continue

        template_key = _infer_schedule_template(schedule)
        if template_key == ScheduleTemplateKey.POST_PUBLISH.value:
            draft_cancelled = await _cancel_post_publish_schedule(
                db,
                schedule=schedule,
                user=user,
            )
            if draft_cancelled:
                cancelled += 1
                continue

        schedule.status = ScheduleStatus.CANCELLED.value
        schedule.updated_at = now_utc_naive

        context = schedule.context_data() or {}
        context.update({
            "cancelled_at": now_utc_naive.isoformat() + "Z",  # 컨텍스트는 문자열 ISO UTC로
            "cancel_reason": "user_request",
        })
        schedule.context = context

        db.add(schedule)
        cancelled += 1

    if cancelled == 0:
        return MessageOut(message="No schedules were cancelled")

    await db.commit()
    return MessageOut(message=f"Cancelled {cancelled} schedule(s)")


@FLOWS.flow(
    key="action.schedule.create_from_raw_dag",
    title="Create Schedule(s) From DAG",
    description="Persist one or multiple schedules using a provided DAG specification",
    input_model=ScheduleCreateFromRawDagRequest,
    output_model=ScheduleCreateResult,
    method="post",
    path="/actions/schedules/create/raw",
    tags=("action", "schedule", "create", "dag"),
)
def _flow_create_schedule_from_raw_dag(builder: FlowBuilder):
    task = builder.task("create_from_raw_dag", "action.schedule.create_from_raw_dag")
    builder.expect_terminal(task)


# ---------------------------------------------------------------------------
# Draft scheduling flows
# ---------------------------------------------------------------------------

@FLOWS.flow(
    key="action.schedule.create_draft_post_schedule",
    title="Create Post Schedule",
    description="Create or update a post publication schedule for the given draft variant",
    input_model=DraftPostScheduleRequest,
    output_model=ScheduleCreateResult,
    method="post",
    path="/actions/schedules/create/draft/post",
    tags=("action", "schedule", "create", "draft", "post"),
)
def _flow_create_draft_post_schedule(builder: FlowBuilder):
    task = builder.task(
        "create_draft_post_schedule",
        "action.schedule.create_draft_post_schedule",
    )
    builder.expect_terminal(task)


@FLOWS.flow(
    key="action.schedule.cancel_draft_post_schedule",
    title="Cancel Post Schedule",
    description="Cancel a post publication schedule for the given draft variant",
    input_model=CancelPostScheduleCommand,
    output_model=MessageOut,
    method="post",
    path="/actions/schedules/cancel/draft/post",
    tags=("action", "schedule", "cancel", "draft", "post"),
)
def _flow_cancel_draft_post_schedule(builder: FlowBuilder):
    task = builder.task("cancel_draft_post_schedule", "action.schedule.cancel_draft_post_schedule")
    builder.expect_terminal(task)

# ---------------------------------------------------------------------------
# Mailing schedule flows
# ---------------------------------------------------------------------------

@FLOWS.flow(
    key="action.schedule.create_trends_mail_schedule",
    title="Create Trends similar to persona Mail Schedule",
    description="Create or update a mail publication schedule for the given draft variant",
    input_model=MailScheduleBatchRequest,
    output_model=ScheduleCreateResult,
    method="post",
    path="/actions/schedules/mail/create",
    tags=("action", "schedule", "cancel")
)
def _flow_create_trends_mail_schedule(builder: FlowBuilder):
    task = builder.task(
        "create_trends_mail_schedule",
        "action.schedule.create_trends_mail_schedule",
    )
    builder.expect_terminal(task)

@FLOWS.flow(
    key="action.schedule.cancel_schedules",
    title="Cancel Schedules",
    description="Cancel a list of schedules",
    input_model=CancelSchedulesCommand,
    output_model=MessageOut,
    method="post",
    path="/actions/schedules/cancel",
    tags=("action", "schedule", "cancel"),
)
def _flow_cancel_schedules(builder: FlowBuilder):
    task = builder.task("cancel_schedules", "action.schedule.cancel_schedules")
    builder.expect_terminal(task)

__all__ = []

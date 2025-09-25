"""Action flows for schedule and automation management."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from apps.backend.src.modules.accounts.models import Persona, PersonaAccount
from apps.backend.src.modules.scheduler import repository as scheduler_repo
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
    PostPublishTemplateParams,
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
from apps.backend.src.workers.CoWorker.execute_due_schedules import execute_due_schedules
from apps.backend.src.modules.drafts.service import (
    cancel_post_publication,
    _load_owned_draft,
    remove_publication_schedule,
)
from apps.backend.src.modules.drafts.models import PostPublication

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
    key="action.schedule.list_templates",
    title="List Schedule Templates",
    side_effect="read",
)
async def op_list_schedule_templates(
    payload: _EmptyPayload,
    ctx: TaskContext,
) -> ListScheduleTemplatesResult:
    definitions: List[ScheduleTemplateDefinition] = list_schedule_templates()
    summaries = [
        ScheduleTemplateSummary(
            key=definition.key,
            title=definition.title,
            description=definition.description,
            visibility=definition.visibility,
        )
        for definition in definitions
    ]
    return ListScheduleTemplatesResult(templates=summaries)


@FLOWS.flow(
    key="action.schedule.list_templates",
    title="List Available Schedule Templates",
    description="Return metadata about available schedule templates",
    input_model=_EmptyPayload,
    output_model=ListScheduleTemplatesResult,
    method="get",
    path="/actions/schedules/templates",
    tags=("action", "schedule", "templates"),
)
def _flow_list_templates(builder: FlowBuilder):
    task = builder.task("list_templates", "action.schedule.list_templates")
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
    run_at = payload.run_at
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
        run_at += interval

    await db.commit()
    return ScheduleCreateResult(schedule_ids=schedule_ids)


@operator(
    key="action.schedule.create_draft_post_schedule",
    title="Create Draft Post Schedule",
    side_effect="write",
)
async def op_create_draft_post_schedule(
    payload: PostPublishTemplateParams,
    ctx: TaskContext,
) -> ScheduleCreateResult:
    db: AsyncSession = ctx.require(AsyncSession)
    user: Optional[User] = ctx.optional(User)

    compile_request = ScheduleCompileRequest(
        template=ScheduleTemplateKey.POST_PUBLISH,
        post_publish=payload,
    )
    compile_result = compile_schedule_template(compile_request)
    dag_spec = compile_result.dag_spec
    dag_json = dag_spec.model_dump(by_alias=True, exclude_none=True)

    created_at = datetime.now(timezone.utc)
    schedule_context: Dict[str, Any] = {
        "template": ScheduleTemplateKey.POST_PUBLISH.value,
        "created_at": created_at.isoformat(),
    }
    if user is not None:
        schedule_context["user_id"] = user.id

    schedule = Schedule(
        persona_account_id=payload.persona_account_id,
        dag_spec=dag_json,
        payload=dag_spec.payload,
        context=schedule_context,
        status=ScheduleStatus.PENDING.value,
        due_at=normalize_due_at(created_at),
        queue="coworker",
        idempotency_key=uuid4().hex,
    )
    db.add(schedule)
    await db.flush()
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

    if not any(
        [
            payload.schedule_ids,
            payload.persona_account_id is not None,
            payload.status is not None,
            payload.window_start is not None,
            payload.window_end is not None,
        ]
    ):
        raise HTTPException(status_code=400, detail="at least one filter must be provided")

    stmt = select(Schedule)
    if payload.schedule_ids:
        stmt = stmt.where(Schedule.id.in_(payload.schedule_ids))
    if payload.persona_account_id is not None:
        stmt = stmt.where(Schedule.persona_account_id == payload.persona_account_id)
    if payload.status is not None:
        stmt = stmt.where(Schedule.status == payload.status.value)
    if payload.window_start is not None:
        stmt = stmt.where(Schedule.due_at >= payload.window_start)
    if payload.window_end is not None:
        stmt = stmt.where(Schedule.due_at <= payload.window_end)

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
    cancelled = 0
    now = datetime.now(timezone.utc)

    for schedule in schedules:
        if schedule.status not in cancellable_statuses:
            continue
        schedule.status = ScheduleStatus.CANCELLED.value
        schedule.updated_at = now
        context = schedule.context_data()
        context.update(
            {
                "cancelled_at": now.isoformat(),
                "cancel_reason": "user_request",
            }
        )
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
    input_model=PostPublishTemplateParams,
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

# ---------------------------------------------------------------------------
# CoWorker lease controls
# ---------------------------------------------------------------------------


async def _persona_account_ids_for_user(db: AsyncSession, user_id: int) -> list[int]:
    stmt = (
        select(PersonaAccount.id)
        .join(Persona, PersonaAccount.persona_id == Persona.id)
        .where(Persona.owner_user_id == user_id)
    )
    res = await db.execute(stmt)
    return [pid for pid in res.scalars().all()]


@operator(
    key="action.schedule.start_my_coworker",
    title="Start My CoWorker",
    side_effect="write",
)
async def op_start_my_coworker(payload: _EmptyPayload, ctx: TaskContext) -> _EmptyPayload:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    persona_ids = await _persona_account_ids_for_user(db, user.id)
    if not persona_ids:
        return _EmptyPayload()

    existing = await scheduler_repo.get_coworker_lease(db, owner_user_id=user.id)
    interval = existing.interval_seconds if existing else 30
    interval = max(interval, 5)
    task_id = existing.task_id if existing and existing.active else None

    await scheduler_repo.upsert_coworker_lease(
        db,
        owner_user_id=user.id,
        persona_account_ids=persona_ids,
        interval_seconds=interval,
        active=True,
        task_id=task_id,
    )
    await db.commit()

    if existing and existing.active and existing.task_id:
        return _EmptyPayload()

    async_result = execute_due_schedules.apply_async(kwargs={"owner_user_id": user.id})
    await scheduler_repo.update_coworker_lease_task(
        db,
        owner_user_id=user.id,
        task_id=async_result.id,
    )
    await db.commit()
    return _EmptyPayload()


@operator(
    key="action.schedule.stop_my_coworker",
    title="Stop My CoWorker",
    side_effect="write",
)
async def op_stop_my_coworker(payload: _EmptyPayload, ctx: TaskContext) -> _EmptyPayload:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    lease = await scheduler_repo.get_coworker_lease(db, owner_user_id=user.id)
    if lease is None:
        return _EmptyPayload()

    await scheduler_repo.set_coworker_lease_active(
        db,
        owner_user_id=user.id,
        active=False,
    )
    await db.commit()

    if lease.task_id:
        execute_due_schedules.app.control.revoke(lease.task_id, terminate=True)
    return _EmptyPayload()


@FLOWS.flow(
    key="action.schedule.start_my_coworker",
    title="Start My CoWorker",
    description="Start the CoWorker worker",
    input_model=_EmptyPayload,
    output_model=_EmptyPayload,
    method="post",
    path="/actions/schedules/start_my_coworker",
    tags=("action", "schedule", "start", "coworker"),
)
def _flow_start_my_coworker(builder: FlowBuilder):
    task = builder.task("start_my_coworker", "action.schedule.start_my_coworker")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="action.schedule.stop_my_coworker",
    title="Stop My CoWorker",
    description="Stop the CoWorker worker",
    input_model=_EmptyPayload,
    output_model=_EmptyPayload,
    method="post",
    path="/actions/schedules/stop_my_coworker",
    tags=("action", "schedule", "stop", "coworker"),
)
def _flow_stop_my_coworker(builder: FlowBuilder):
    task = builder.task("stop_my_coworker", "action.schedule.stop_my_coworker")
    builder.expect_terminal(task)


__all__ = []

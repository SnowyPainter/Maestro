"""Action flows for schedule templates and batch scheduling."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import List
from uuid import uuid4

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.accounts.models import Persona, PersonaAccount
from apps.backend.src.modules.scheduler import repository as scheduler_repo
from apps.backend.src.modules.scheduler.models import Schedule, ScheduleStatus
from apps.backend.src.modules.scheduler.schemas import (
    MailScheduleTemplateParams,
    ScheduleCompileRequest,
    ScheduleCompileResult,
    ScheduleDagSpec,
    ScheduleTemplateKey,
)
from apps.backend.src.orchestrator.adapters.schedule import compile_schedule_template
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator
from apps.backend.src.modules.users.models import User
from apps.backend.src.workers.CoWorker.execute_due_schedules import execute_due_schedules


class ScheduleTemplateSummary(BaseModel):
    key: ScheduleTemplateKey
    title: str
    description: str


class ListScheduleTemplatesResult(BaseModel):
    templates: List[ScheduleTemplateSummary]


class ScheduleCreateRequest(BaseModel):
    """Request to create one or more schedules from a template."""

    template: ScheduleTemplateKey = Field(..., description="Template to use")
    params: MailScheduleTemplateParams
    run_at: datetime = Field(default_factory=datetime.utcnow)
    repeats: int = 1
    repeat_interval_minutes: int = 0
    queue: str | None = None


class ScheduleCreateResult(BaseModel):
    schedule_ids: List[int]


class _EmptyPayload(BaseModel):
    """Placeholder model for GET endpoints."""


_TEMPLATE_DEFINITIONS = {
    ScheduleTemplateKey.MAIL_TRENDS_WITH_REPLY: ScheduleTemplateSummary(
        key=ScheduleTemplateKey.MAIL_TRENDS_WITH_REPLY,
        title="Persona Trends Mail with Reply Await",
        description="Send persona-adapted trends email and await reply to ingest draft",
    )
}


@operator(
    key="action.schedule.list_templates",
    title="List Schedule Templates",
    side_effect="read",
)
async def op_list_schedule_templates(ctx: TaskContext) -> ListScheduleTemplatesResult:
    return ListScheduleTemplatesResult(templates=list(_TEMPLATE_DEFINITIONS.values()))


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
    key="action.schedule.create_from_template",
    title="Create Schedule(s) From Template",
    side_effect="write",
)
async def op_create_schedule_from_template(
    payload: ScheduleCreateRequest,
    ctx: TaskContext,
) -> ScheduleCreateResult:
    compile_result = compile_schedule_template(
        ScheduleCompileRequest(template=payload.template, mail=payload.params)
    )
    dag_spec: ScheduleDagSpec = compile_result.dag_spec

    db: AsyncSession = ctx.require(AsyncSession)

    schedule_ids: List[int] = []
    run_at = payload.run_at
    interval = timedelta(minutes=max(payload.repeat_interval_minutes, 0))
    total_runs = max(payload.repeats, 1)

    dag_json = dag_spec.model_dump(by_alias=True, exclude_none=True)
    dag_payload = dag_spec.payload

    for _ in range(total_runs):
        schedule = Schedule(
            persona_account_id=payload.params.persona_account_id,
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


@FLOWS.flow(
    key="action.schedule.create_from_template",
    title="Schedule Template Instances",
    description="Create one or multiple schedules from a template and timing options",
    input_model=ScheduleCreateRequest,
    output_model=ScheduleCreateResult,
    method="post",
    path="/actions/schedules/create",
    tags=("action", "schedule", "create", "batch"),
)
def _flow_create_schedule(builder: FlowBuilder):
    task = builder.task("create_from_template", "action.schedule.create_from_template")
    builder.expect_terminal(task)

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

"""BFF flows for inspecting Schedule records with meta information."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.accounts.models import Persona, PersonaAccount
from apps.backend.src.modules.common.enums import ScheduleStatus
from apps.backend.src.modules.scheduler.models import Schedule
from apps.backend.src.modules.scheduler.registry import (
    ScheduleTemplateKey,
    ScheduleTemplateDefinition,
    list_schedule_templates,
    TemplateVisibility
)
from apps.backend.src.modules.users.models import User

from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


class ScheduleListPayload(BaseModel):
    persona_account_id: Optional[int] = Field(
        default=None,
        description="Filter schedules by persona account id. If omitted, all schedules for the user are returned.",
    )
    status: Optional[ScheduleStatus] = Field(
        default=None,
        description="Optional status filter.",
    )
    queue: Optional[str] = Field(
        default=None,
        description="Optional queue filter (e.g. 'coworker').",
    )
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0)


class ScheduleMeta(BaseModel):
    label: Optional[str]
    dag_meta: Optional[Dict[str, Any]] = None
    context: Optional[Dict[str, Any]] = None
    payload: Optional[Dict[str, Any]] = None


class ScheduleListItem(BaseModel):
    id: int
    persona_account_id: int
    status: str
    queue: Optional[str]
    due_at: Optional[datetime]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    dag_spec: Optional[Dict[str, Any]]
    payload: Optional[Dict[str, Any]]
    context: Optional[Dict[str, Any]]
    attempts: Optional[int]
    max_attempts: Optional[int]
    last_error: Optional[str]
    errors: Optional[Dict[str, Any]]
    idempotency_key: Optional[str]
    meta: ScheduleMeta


class ScheduleListResult(BaseModel):
    total: int
    items: list[ScheduleListItem]
    limit: int
    offset: int


class ScheduleTemplateItem(BaseModel):
    key: str
    title: str
    description: str
    visibility: str
    group: str


class ScheduleTemplateListResult(BaseModel):
    templates: list[ScheduleTemplateItem]

class EmptyPayload(BaseModel):
    pass

def _base_schedule_query(user_id: int) -> Select[tuple[Schedule]]:
    return (
        select(Schedule)
        .join(PersonaAccount, PersonaAccount.id == Schedule.persona_account_id)
        .join(Persona, PersonaAccount.persona_id == Persona.id)
        .where(Persona.owner_user_id == user_id)
    )


def _build_meta(schedule: Schedule) -> ScheduleMeta:
    dag_spec = schedule.dag_spec if isinstance(schedule.dag_spec, dict) else None
    dag_meta = dag_spec.get("meta") if dag_spec else None
    context = schedule.context_data() or None
    payload = schedule.payload_data() or None
    return ScheduleMeta(
        label=schedule.timeline_label,
        dag_meta=dag_meta,
        context=context,
        payload=payload,
    )


@operator(
    key="bff.schedule.list_schedules",
    title="List Schedules",
    side_effect="read",
)
async def op_list_schedules(
    payload: ScheduleListPayload,
    ctx: TaskContext,
) -> ScheduleListResult:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    base_stmt = _base_schedule_query(user.id)
    if payload.persona_account_id is not None:
        base_stmt = base_stmt.where(
            Schedule.persona_account_id == payload.persona_account_id
        )
    if payload.status is not None:
        base_stmt = base_stmt.where(Schedule.status == payload.status.value)
    if payload.queue is not None:
        base_stmt = base_stmt.where(Schedule.queue == payload.queue)

    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = (
        base_stmt.order_by(Schedule.due_at.asc())
        .limit(payload.limit)
        .offset(payload.offset)
    )
    rows = (await db.execute(stmt)).scalars().all()

    items = [
        ScheduleListItem(
            id=schedule.id,
            persona_account_id=schedule.persona_account_id,
            status=schedule.status,
            queue=schedule.queue,
            due_at=schedule.due_at,
            created_at=schedule.created_at,
            updated_at=schedule.updated_at,
            dag_spec=schedule.dag_spec,
            payload=schedule.payload,
            context=schedule.context,
            attempts=schedule.attempts,
            max_attempts=schedule.max_attempts,
            last_error=schedule.last_error,
            errors=schedule.errors,
            idempotency_key=schedule.idempotency_key,
            meta=_build_meta(schedule),
        )
        for schedule in rows
    ]

    return ScheduleListResult(
        total=total,
        items=items,
        limit=payload.limit,
        offset=payload.offset,
    )


@operator(
    key="bff.schedule.list_templates",
    title="List Available Schedule Templates",
    side_effect="read",
)
async def op_list_schedule_templates(
    payload: EmptyPayload,  # Empty payload for now
    ctx: TaskContext,
) -> ScheduleTemplateListResult:
    # Get all available templates from registry
    templates = list_schedule_templates()

    # Convert to response format
    template_items = []
    for template in templates:
        # Map visibility enum to string
        visibility_str = template.visibility.value
        template_items.append(ScheduleTemplateItem(
            key=template.key.value,
            title=template.title,
            description=template.description,
            visibility=visibility_str,
            group=template.group,
        ))

    return ScheduleTemplateListResult(templates=template_items)


@FLOWS.flow(
    key="bff.schedule.list_schedules",
    title="List Schedules",
    description="List schedules for the authenticated user with optional persona filtering and meta information.",
    input_model=ScheduleListPayload,
    output_model=ScheduleListResult,
    method="get",
    path="/schedules",
    tags=("bff", "schedule", "list"),
)
def _flow_bff_list_schedules(builder: FlowBuilder):
    task = builder.task("list", "bff.schedule.list_schedules")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.schedule.list_templates",
    title="List Available Schedule Templates",
    description="List all available schedule templates that can be used for creating new schedules.",
    input_model=EmptyPayload,  # Empty payload
    output_model=ScheduleTemplateListResult,
    method="get",
    path="/schedule-templates",
    tags=("bff", "schedule", "templates"),
)
def _flow_bff_list_templates(builder: FlowBuilder):
    task = builder.task("list_templates", "bff.schedule.list_templates")
    builder.expect_terminal(task)

__all__ = []

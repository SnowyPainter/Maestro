"""Action flows for managing CoWorker leases."""

from __future__ import annotations

from typing import Iterable, Optional

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.accounts.models import Persona, PersonaAccount
from apps.backend.src.modules.scheduler import repository as scheduler_repo
from apps.backend.src.modules.scheduler.repository import CoWorkerLeaseData
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.flows.action.schedule import _EmptyPayload
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator
from apps.backend.src.workers.CoWorker.execute_due_schedules import execute_due_schedules


class CoworkerLeaseUpdatePayload(BaseModel):
    """Payload for updating the caller's CoWorker lease."""

    persona_account_ids: Optional[list[int]] = Field(
        default=None,
        description="Explicit list of persona_account_ids to associate with the lease.",
    )
    add_persona_account_ids: Optional[list[int]] = Field(
        default=None,
        description="Persona account IDs to append to the existing lease scope.",
    )
    remove_persona_account_ids: Optional[list[int]] = Field(
        default=None,
        description="Persona account IDs to remove from the existing lease scope.",
    )
    interval_seconds: Optional[int] = Field(
        default=30,
        description="Polling interval for the CoWorker lease. Minimum 5 seconds.",
    )
    active: Optional[bool] = Field(
        default=None,
        description="Toggle the active state of the lease.",
    )
    force_restart: bool = Field(
        default=False,
        description=(
            "If true, enqueue a fresh execute_due_schedules task even when a task "
            "is already registered."
        ),
    )


class CoworkerLeaseOut(BaseModel):
    """Representation of a CoWorker lease returned by action operators."""

    active: bool
    interval_seconds: int
    persona_account_ids: list[int]
    task_id: Optional[str]


async def _persona_account_ids_for_user(
    db: AsyncSession,
    user_id: int,
    *,
    limit_to: Optional[Iterable[int]] = None,
) -> list[int]:
    ids_filter = None if limit_to is None else {int(pid) for pid in limit_to}
    if ids_filter is not None and not ids_filter:
        return []
    stmt = (
        select(PersonaAccount.id)
        .join(Persona, PersonaAccount.persona_id == Persona.id)
        .where(Persona.owner_user_id == user_id)
    )
    if ids_filter is not None:
        stmt = stmt.where(PersonaAccount.id.in_(ids_filter))
    res = await db.execute(stmt)
    owned = {pid for pid in res.scalars().all()}
    if ids_filter is not None and owned != ids_filter:
        missing = sorted(ids_filter - owned)
        raise HTTPException(status_code=403, detail={"missing_persona_account_ids": missing})
    return sorted(owned)


def _lease_to_output(lease: CoWorkerLeaseData) -> CoworkerLeaseOut:
    return CoworkerLeaseOut(
        active=lease.active,
        interval_seconds=lease.interval_seconds,
        persona_account_ids=list(lease.persona_account_ids),
        task_id=lease.task_id,
    )


async def _apply_lease_update(
    db: AsyncSession,
    *,
    user: User,
    payload: CoworkerLeaseUpdatePayload,
    fallback_persona_ids: Optional[list[int]] = None,
) -> CoworkerLeaseOut:
    existing = await scheduler_repo.get_coworker_lease(db, owner_user_id=user.id)
    base_persona_ids = (
        list(existing.persona_account_ids)
        if existing is not None
        else list(fallback_persona_ids or [])
    )

    if payload.persona_account_ids is not None:
        persona_ids = await _persona_account_ids_for_user(
            db,
            user.id,
            limit_to=payload.persona_account_ids,
        )
    else:
        persona_ids = list(base_persona_ids)
        if payload.add_persona_account_ids:
            additions = await _persona_account_ids_for_user(
                db,
                user.id,
                limit_to=payload.add_persona_account_ids,
            )
            persona_ids = sorted({*persona_ids, *additions})
        if payload.remove_persona_account_ids:
            removal = {int(pid) for pid in payload.remove_persona_account_ids}
            persona_ids = [pid for pid in persona_ids if pid not in removal]

    persona_ids = sorted({int(pid) for pid in persona_ids})

    interval = (
        payload.interval_seconds
        if payload.interval_seconds is not None
        else (existing.interval_seconds if existing is not None else 30)
    )
    if interval < 5:
        raise HTTPException(status_code=400, detail="interval_seconds must be >= 5")

    active = (
        payload.active
        if payload.active is not None
        else (existing.active if existing is not None else bool(persona_ids))
    )

    if active and not persona_ids:
        raise HTTPException(status_code=400, detail="Cannot activate CoWorker with empty persona scope")

    previous_task_id = existing.task_id if existing is not None else None
    target_task_id: Optional[str] = previous_task_id
    drop_existing_task = False
    if not active or payload.force_restart:
        target_task_id = None
        drop_existing_task = previous_task_id is not None

    lease = await scheduler_repo.upsert_coworker_lease(
        db,
        owner_user_id=user.id,
        persona_account_ids=persona_ids,
        interval_seconds=interval,
        active=active,
        task_id=target_task_id,
    )
    await db.commit()

    if drop_existing_task and previous_task_id:
        execute_due_schedules.app.control.revoke(previous_task_id, terminate=True)

    if lease.active and lease.persona_account_ids:
        needs_restart = payload.force_restart or lease.task_id is None
        if needs_restart:
            async_result = execute_due_schedules.apply_async(
                kwargs={"owner_user_id": user.id}
            )
            lease = await scheduler_repo.update_coworker_lease_task(
                db,
                owner_user_id=user.id,
                task_id=async_result.id,
            ) or lease
            await db.commit()

    return _lease_to_output(lease)


@operator(
    key="action.coworker.start_my_coworker",
    title="Start My CoWorker",
    side_effect="write",
)
async def op_start_my_coworker(payload: _EmptyPayload, ctx: TaskContext) -> _EmptyPayload:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    persona_ids = await _persona_account_ids_for_user(db, user.id)
    if not persona_ids:
        return _EmptyPayload()
    update_payload = CoworkerLeaseUpdatePayload(
        persona_account_ids=persona_ids,
        active=True,
    )
    await _apply_lease_update(
        db,
        user=user,
        payload=update_payload,
        fallback_persona_ids=persona_ids,
    )
    return _EmptyPayload()


@operator(
    key="action.coworker.stop_my_coworker",
    title="Stop My CoWorker",
    side_effect="write",
)
async def op_stop_my_coworker(payload: _EmptyPayload, ctx: TaskContext) -> _EmptyPayload:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    await _apply_lease_update(
        db,
        user=user,
        payload=CoworkerLeaseUpdatePayload(active=False),
    )
    return _EmptyPayload()


@operator(
    key="action.coworker.update_my_coworker",
    title="Update My CoWorker Lease",
    side_effect="write",
)
async def op_update_my_coworker(
    payload: CoworkerLeaseUpdatePayload,
    ctx: TaskContext,
) -> CoworkerLeaseOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    lease = await _apply_lease_update(
        db,
        user=user,
        payload=payload,
    )
    return lease


@FLOWS.flow(
    key="action.coworker.start_my_coworker",
    title="Start My CoWorker",
    description="Start the CoWorker worker",
    input_model=_EmptyPayload,
    output_model=_EmptyPayload,
    method="post",
    path="/actions/schedules/start_my_coworker",
    tags=("action", "coworker", "schedule", "start"),
)
def _flow_start_my_coworker(builder: FlowBuilder):
    task = builder.task("start_my_coworker", "action.coworker.start_my_coworker")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="action.coworker.stop_my_coworker",
    title="Stop My CoWorker",
    description="Stop the CoWorker worker",
    input_model=_EmptyPayload,
    output_model=_EmptyPayload,
    method="post",
    path="/actions/schedules/stop_my_coworker",
    tags=("action", "coworker", "schedule", "stop"),
)
def _flow_stop_my_coworker(builder: FlowBuilder):
    task = builder.task("stop_my_coworker", "action.coworker.stop_my_coworker")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="action.coworker.update_my_coworker",
    title="Update My CoWorker Lease",
    description="Update CoWorker lease scope, interval, and activation state.",
    input_model=CoworkerLeaseUpdatePayload,
    output_model=CoworkerLeaseOut,
    method="post",
    path="/actions/schedules/coworker/lease",
    tags=("action", "coworker", "schedule", "update"),
)
def _flow_update_my_coworker(builder: FlowBuilder):
    task = builder.task("update_my_coworker", "action.coworker.update_my_coworker")
    builder.expect_terminal(task)


__all__ = []

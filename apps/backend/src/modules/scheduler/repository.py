"""Helper utilities for schedule orchestration and state transitions."""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterable, Optional, Sequence

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from apps.backend.src.modules.scheduler.models import (
    CoWorkerLease,
    Schedule,
    ScheduleStatus,
)


DEFAULT_DUE_STATUSES: tuple[str, ...] = (
    ScheduleStatus.PENDING.value,
    ScheduleStatus.FAILED.value,
    ScheduleStatus.RUNNING.value,
)


def pick_due(
    session: Session,
    *,
    limit: int = 100,
    statuses: Iterable[str] = DEFAULT_DUE_STATUSES,
    persona_account_ids: Optional[Sequence[int]] = None,
) -> list[Schedule]:
    """Select due schedules for execution with row-level locking.

    Uses ``skip_locked`` to avoid contention when multiple workers poll concurrently.
    """
    stmt = (
        select(Schedule)
        .where(Schedule.status.in_(tuple(statuses)))
        .where(Schedule.due_at <= func.now())
        .order_by(Schedule.due_at.asc())
        .limit(limit)
        .with_for_update(skip_locked=True)
    )
    if persona_account_ids:
        stmt = stmt.where(Schedule.persona_account_id.in_(tuple(persona_account_ids)))
    return list(session.execute(stmt).scalars())


@contextmanager
def lock(session: Session, schedule_id: int):
    """Lock a specific schedule row until the context exits."""
    try:
        session.execute(
            select(Schedule)
            .where(Schedule.id == schedule_id)
            .with_for_update()
        )
        yield
        session.commit()
    except Exception:
        session.rollback()
        raise


def mark_running(session: Session, schedule_id: int):
    session.execute(
        update(Schedule)
        .where(Schedule.id == schedule_id)
        .values(
            status=ScheduleStatus.RUNNING.value,
            attempts=Schedule.attempts + 1,
            last_error=None,
        )
    )


def mark_done(session: Session, schedule_id: int, *, context: Optional[dict] = None):
    values = {
        "status": ScheduleStatus.DONE.value,
        "last_error": None,
    }
    if context is not None:
        values["context"] = context
    session.execute(
        update(Schedule)
        .where(Schedule.id == schedule_id)
        .values(**values)
    )


def mark_failed(session: Session, schedule_id: int, *, error: str, context: Optional[dict] = None):
    values = {
        "status": ScheduleStatus.FAILED.value,
        "last_error": error,
    }
    if context is not None:
        values["context"] = context
    session.execute(
        update(Schedule)
        .where(Schedule.id == schedule_id)
        .values(**values)
    )


def mark_rescheduled(
    session: Session,
    schedule_id: int,
    *,
    due_at: datetime,
    payload: Optional[dict] = None,
    context: Optional[dict] = None,
    status: ScheduleStatus = ScheduleStatus.PENDING,
):
    """Update a schedule for a future retry (used for wait/suspend semantics)."""
    values = {
        "status": status.value,
        "due_at": due_at,
    }
    if payload is not None:
        values["payload"] = payload
    if context is not None:
        values["context"] = context
    session.execute(
        update(Schedule)
        .where(Schedule.id == schedule_id)
        .values(**values)
    )


def mark_rescheduled_in(
    session: Session,
    schedule_id: int,
    *,
    delay: timedelta,
    payload: Optional[dict] = None,
    context: Optional[dict] = None,
    status: ScheduleStatus = ScheduleStatus.PENDING,
):
    mark_rescheduled(
        session,
        schedule_id,
        due_at=datetime.utcnow() + delay,
        payload=payload,
        context=context,
        status=status,
    )


@dataclass
class CoWorkerLeaseData:
    id: int
    owner_user_id: int
    persona_account_ids: list[int]
    interval_seconds: int
    active: bool
    task_id: Optional[str]


async def ensure_coworker_leases_table(session: AsyncSession) -> None:
    await session.run_sync(CoWorkerLease.__table__.create, checkfirst=True)


def _coerce_persona_ids(raw: Iterable[int]) -> list[int]:
    return sorted({int(pid) for pid in raw})


def _lease_to_data(lease: CoWorkerLease) -> CoWorkerLeaseData:
    ids = lease.persona_account_ids or []
    return CoWorkerLeaseData(
        id=lease.id,
        owner_user_id=lease.owner_user_id,
        persona_account_ids=[int(pid) for pid in ids],
        interval_seconds=int(lease.interval_seconds),
        active=bool(lease.active),
        task_id=lease.task_id,
    )


async def get_coworker_lease(
    session: AsyncSession,
    *,
    owner_user_id: int,
    for_update: bool = False,
) -> Optional[CoWorkerLeaseData]:
    await ensure_coworker_leases_table(session)
    stmt = select(CoWorkerLease).where(CoWorkerLease.owner_user_id == owner_user_id)
    if for_update:
        stmt = stmt.with_for_update()
    res = await session.execute(stmt)
    lease = res.scalar_one_or_none()
    if lease is None:
        return None
    return _lease_to_data(lease)


async def upsert_coworker_lease(
    session: AsyncSession,
    *,
    owner_user_id: int,
    persona_account_ids: Iterable[int],
    interval_seconds: int,
    active: bool,
    task_id: Optional[str] = None,
) -> CoWorkerLeaseData:
    await ensure_coworker_leases_table(session)
    stmt = (
        select(CoWorkerLease)
        .where(CoWorkerLease.owner_user_id == owner_user_id)
        .with_for_update()
    )
    res = await session.execute(stmt)
    lease = res.scalar_one_or_none()
    persona_ids = _coerce_persona_ids(persona_account_ids)
    now = datetime.utcnow()

    if lease is None:
        lease = CoWorkerLease(
            owner_user_id=owner_user_id,
            persona_account_ids=persona_ids,
            interval_seconds=interval_seconds,
            active=active,
            task_id=task_id,
            created_at=now,
            updated_at=now,
        )
        session.add(lease)
    else:
        lease.persona_account_ids = persona_ids
        lease.interval_seconds = interval_seconds
        lease.active = active
        lease.task_id = task_id
        lease.touch()

    await session.flush()
    return _lease_to_data(lease)


async def update_coworker_lease_task(
    session: AsyncSession,
    *,
    owner_user_id: int,
    task_id: Optional[str],
) -> Optional[CoWorkerLeaseData]:
    await ensure_coworker_leases_table(session)
    stmt = (
        select(CoWorkerLease)
        .where(CoWorkerLease.owner_user_id == owner_user_id)
        .with_for_update()
    )
    res = await session.execute(stmt)
    lease_row = res.scalar_one_or_none()
    if lease_row is None:
        return None
    lease_row.task_id = task_id
    lease_row.touch()
    await session.flush()
    return _lease_to_data(lease_row)


async def set_coworker_lease_active(
    session: AsyncSession,
    *,
    owner_user_id: int,
    active: bool,
) -> Optional[CoWorkerLeaseData]:
    await ensure_coworker_leases_table(session)
    stmt = select(CoWorkerLease).where(CoWorkerLease.owner_user_id == owner_user_id).with_for_update()
    res = await session.execute(stmt)
    lease_row = res.scalar_one_or_none()
    if lease_row is None:
        return None
    lease_row.active = active
    lease_row.touch()
    if not active:
        lease_row.task_id = None
    await session.flush()
    return _lease_to_data(lease_row)


__all__ = [
    "pick_due",
    "lock",
    "mark_running",
    "mark_done",
    "mark_failed",
    "mark_rescheduled",
    "mark_rescheduled_in",
    "CoWorkerLeaseData",
    "get_coworker_lease",
    "upsert_coworker_lease",
    "update_coworker_lease_task",
    "set_coworker_lease_active",
    "ensure_coworker_leases_table",
]

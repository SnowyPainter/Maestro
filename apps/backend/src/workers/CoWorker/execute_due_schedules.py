"""Celery task that executes schedule-provided DAGs."""

from __future__ import annotations

import asyncio
import logging
import threading
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from typing import Any, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from apps.backend.src.orchestrator.dag_executor import ExecutionResult

from apps.backend.src.core.celery_app import celery_app
from sqlalchemy import create_engine, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from apps.backend.src.core.config import settings
from apps.backend.src.core.db import SessionLocal as AsyncSessionLocal
from apps.backend.src.modules.scheduler import repository as repo
from apps.backend.src.modules.scheduler.models import CoWorkerLease, Schedule, ScheduleStatus
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import ExecutionRuntime
from apps.backend.src.orchestrator.dsl import parse_dag_spec
from apps.backend.src.workers.CoWorker.runtime import ScheduleReschedule
from apps.backend.src.modules.scheduler.events import (
    ScheduleEvent,
    ScheduleEventType,
    publish_schedule_event,
)

logger = logging.getLogger(__name__)

ENGINE = create_engine(settings.SYNC_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=ENGINE, autocommit=False, autoflush=False)
_LOOP: Optional[asyncio.AbstractEventLoop] = None
_LOOP_THREAD: Optional[threading.Thread] = None
_LOOP_LOCK = threading.Lock()


def _loop_runner(loop: asyncio.AbstractEventLoop) -> None:
    asyncio.set_event_loop(loop)
    loop.run_forever()


def _ensure_loop() -> asyncio.AbstractEventLoop:
    global _LOOP, _LOOP_THREAD
    with _LOOP_LOCK:
        needs_start = False
        if _LOOP is None or _LOOP.is_closed():
            _LOOP = asyncio.new_event_loop()
            needs_start = True
        if needs_start or _LOOP_THREAD is None or not _LOOP_THREAD.is_alive():
            _LOOP_THREAD = threading.Thread(
                target=_loop_runner,
                name="coworker-execute-loop",
                args=(_LOOP,),
                daemon=True,
            )
            _LOOP_THREAD.start()
    return _LOOP  # type: ignore[return-value]


def _emit_schedule_event(event: ScheduleEvent) -> None:
    try:
        publish_schedule_event(event)
    except Exception:
        logger.exception("Failed to emit schedule event", extra={"event": event.to_dict()})

@dataclass
class ScheduleSnapshot:
    id: int
    dag_spec: Optional[dict[str, Any]]
    payload: dict[str, Any]
    context: dict[str, Any]
    persona_account_id: Optional[int]
    queue: Optional[str]
    idempotency_key: Optional[str]

    @classmethod
    def from_model(cls, schedule: Schedule) -> "ScheduleSnapshot":
        return cls(
            id=schedule.id,
            dag_spec=schedule.dag_spec,
            payload=schedule.payload_data(),
            context=schedule.context_data(),
            persona_account_id=getattr(schedule, "persona_account_id", None),
            queue=getattr(schedule, "queue", None),
            idempotency_key=getattr(schedule, "idempotency_key", None),
        )


async def _fetch_lease(owner_user_id: int) -> Optional[repo.CoWorkerLeaseData]:
    async with AsyncSessionLocal() as session:  # type: ignore
        return await repo.get_coworker_lease(session, owner_user_id=owner_user_id)


async def _store_task_id(owner_user_id: int, task_id: Optional[str]) -> Optional[repo.CoWorkerLeaseData]:
    async with AsyncSessionLocal() as session:  # type: ignore
        data = await repo.update_coworker_lease_task(
            session,
            owner_user_id=owner_user_id,
            task_id=task_id,
        )
        await session.commit()
        return data


async def _execute_due_schedules(owner_user_id: Optional[int], task) -> dict[str, Any]:
    persona_scope: Optional[list[int]] = None
    if owner_user_id is not None:
        lease = await _fetch_lease(owner_user_id)
        if lease is None or not lease.active:
            logger.info("coworker lease inactive for user %s", owner_user_id)
            return {"processed": 0, "rescheduled": False, "reason": "inactive"}
        persona_scope = lease.persona_account_ids
        if not persona_scope:
            logger.info("coworker lease has no persona accounts for user %s", owner_user_id)
            await _store_task_id(owner_user_id, None)
            return {"processed": 0, "rescheduled": False, "reason": "no_persona_accounts"}

    with SessionLocal() as session:
        due_schedules = repo.pick_due(
            session,
            persona_account_ids=persona_scope,
        )
        if not due_schedules:
            logger.debug("no due schedules found for scope %s", persona_scope)
            if owner_user_id is None:
                return {"processed": 0, "rescheduled": False}
            # Still reschedule to poll again later while lease is active
            rescheduled = await _reschedule_self(task, owner_user_id)
            return {"processed": 0, "rescheduled": rescheduled}

        processed = 0
        for schedule in due_schedules:
            snapshot = ScheduleSnapshot.from_model(schedule)
            try:
                repo.mark_running(session, schedule.id)
                session.commit()
                _emit_schedule_event(
                    ScheduleEvent(
                        id=schedule.id,
                        status=ScheduleStatus.RUNNING.value,
                        persona_account_id=snapshot.persona_account_id,
                        queue=snapshot.queue,
                        due_at=schedule.due_at,
                        updated_at=datetime.utcnow().replace(tzinfo=timezone.utc),
                        event_type=ScheduleEventType.RUNNING,
                        payload={"idempotency_key": snapshot.idempotency_key},
                        meta={"source": "coworker", "action": "mark_running"},
                    )
                )
            except Exception:
                session.rollback()
                logger.exception("Failed to mark schedule %s running", schedule.id)
                continue

            try:
                exec_result = await _run_snapshot(snapshot)
                repo.mark_done(session, schedule.id, context=exec_result.context)
                session.commit()
                processed += 1
                _emit_schedule_event(
                    ScheduleEvent(
                        id=schedule.id,
                        status=ScheduleStatus.DONE.value,
                        persona_account_id=snapshot.persona_account_id,
                        queue=snapshot.queue,
                        due_at=schedule.due_at,
                        updated_at=datetime.utcnow().replace(tzinfo=timezone.utc),
                        event_type=ScheduleEventType.DONE,
                        payload={
                            "result_context": exec_result.context,
                            "idempotency_key": snapshot.idempotency_key,
                        },
                        meta={"source": "coworker", "action": "mark_done"},
                    )
                )
            except ScheduleReschedule as suspend:
                directive = suspend.directive
                due_at = directive.effective_resume_at()
                new_payload = snapshot.payload if directive.payload is None else directive.payload
                new_context = directive.context or snapshot.context
                status = ScheduleStatus(directive.status)
                repo.mark_rescheduled(
                    session,
                    schedule.id,
                    due_at=due_at,
                    payload=new_payload,
                    context=new_context,
                    status=status,
                )
                session.commit()
                logger.info(
                    "schedule %s rescheduled to %s", schedule.id, due_at.isoformat()
                )
                _emit_schedule_event(
                    ScheduleEvent(
                        id=schedule.id,
                        status=status.value,
                        persona_account_id=snapshot.persona_account_id,
                        queue=snapshot.queue,
                        due_at=due_at,
                        updated_at=datetime.utcnow().replace(tzinfo=timezone.utc),
                        event_type=ScheduleEventType.RESCHEDULED,
                        payload={
                            "payload": new_payload,
                            "context": new_context,
                            "idempotency_key": snapshot.idempotency_key,
                        },
                        meta={"source": "coworker", "action": "mark_rescheduled"},
                    )
                )
            except Exception as exc:
                session.rollback()
                logger.exception("schedule %s failed", schedule.id)
                try:
                    failure_context = getattr(exc, "__schedule_context__", snapshot.context)
                    repo.mark_failed(session, schedule.id, error=str(exc), context=failure_context)
                    session.commit()
                    _emit_schedule_event(
                        ScheduleEvent(
                            id=schedule.id,
                            status=ScheduleStatus.FAILED.value,
                            persona_account_id=snapshot.persona_account_id,
                            queue=snapshot.queue,
                        due_at=schedule.due_at,
                        updated_at=datetime.utcnow().replace(tzinfo=timezone.utc),
                            event_type=ScheduleEventType.FAILED,
                            payload={
                                "error": str(exc),
                                "context": failure_context,
                                "idempotency_key": snapshot.idempotency_key,
                            },
                            meta={"source": "coworker", "action": "mark_failed"},
                        )
                    )
                except Exception:
                    session.rollback()
                    logger.exception("Failed to mark schedule %s as failed", schedule.id)
        rescheduled = False
        if owner_user_id is not None:
            rescheduled = await _reschedule_self(task, owner_user_id)
        return {"processed": processed, "rescheduled": rescheduled}


@celery_app.task(
    name="apps.backend.src.workers.coworker.execute_due_schedules",
    queue="coworker",
    bind=True,
    max_retries=0,
)
def execute_due_schedules(self, owner_user_id: Optional[int] = None):
    async def _execute() -> dict[str, Any]:
        return await _execute_due_schedules(owner_user_id, self)

    loop = _ensure_loop()
    future = asyncio.run_coroutine_threadsafe(_execute(), loop)
    try:
        return future.result()
    except Exception as exc:
        logger.exception("execute_due_schedules failed")
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries))
        raise


async def _run_snapshot(snapshot: ScheduleSnapshot) -> ExecutionResult:
    # Import here to avoid circular import
    from apps.backend.src.orchestrator.dag_executor import DagExecutor, ExecutionResult

    if not snapshot.dag_spec:
        raise ValueError("Schedule is missing dag_spec")

    spec = parse_dag_spec(snapshot.dag_spec)
    schedule_context = dict(snapshot.context)
    resume_payload = schedule_context.get("_resume")
    schedule_payload = dict(snapshot.payload)

    runtime = ExecutionRuntime()
    async with AsyncSessionLocal() as db:  # type: ignore
        runtime.provide(db, name="db", type_hint=AsyncSession)

        user_id = schedule_context.get("user_id")
        if user_id is not None:
            user = await db.get(User, user_id)
            if user is not None:
                runtime.provide(user, name="user", type_hint=User)

        if snapshot.persona_account_id is not None:
            runtime.provide(
                snapshot.persona_account_id,
                name="persona_account_id",
                type_hint=int,
            )

        runtime.provide(snapshot.id, name="schedule_id", type_hint=int)
        if snapshot.idempotency_key:
            runtime.provide(snapshot.idempotency_key, name="idempotency_key", type_hint=str)

        runtime.provide(schedule_context, name="schedule_context", type_hint=dict)

        executor = DagExecutor(
            spec,
            runtime=runtime,
            schedule_payload=schedule_payload,
            schedule_context=schedule_context,
            resume_payload=resume_payload,
        )
        try:
            result = await executor.run()
        except Exception as exc:
            setattr(exc, "__schedule_context__", schedule_context)
            raise
    return result


def _lease_needs_restart(lease: CoWorkerLease, *, now: datetime) -> bool:
    interval = max(int(getattr(lease, "interval_seconds", 0) or 0), 5)
    if not lease.task_id:
        return True

    updated_at = lease.updated_at or datetime.min
    stale_cutoff = now - timedelta(seconds=max(interval * 2, 60))
    if updated_at < stale_cutoff:
        return True

    try:
        result = execute_due_schedules.AsyncResult(lease.task_id)
    except Exception:  # pragma: no cover - backend connectivity issues
        logger.debug(
            "Failed to inspect async result for lease %s", lease.owner_user_id, exc_info=True
        )
        return True

    if result.state in {"REVOKED", "FAILURE"}:
        return True
    if result.ready() and updated_at < stale_cutoff:
        return True
    return False


@celery_app.task(
    name="apps.backend.src.workers.coworker.ensure_coworker_polls",
    queue="coworker",
    max_retries=0,
)
def ensure_coworker_polls() -> dict[str, int]:
    now = datetime.utcnow()
    restarted = 0
    cleared = 0

    with SessionLocal() as session:
        stmt = (
            select(CoWorkerLease)
            .where(CoWorkerLease.active.is_(True))
            .with_for_update(skip_locked=True)
        )
        leases = session.execute(stmt).scalars().all()

        for lease in leases:
            if not lease.persona_account_ids:
                if lease.task_id is not None:
                    lease.task_id = None
                    lease.touch()
                    cleared += 1
                continue

            if not _lease_needs_restart(lease, now=now):
                continue

            async_result = execute_due_schedules.apply_async(
                kwargs={"owner_user_id": lease.owner_user_id}
            )
            lease.task_id = async_result.id
            lease.touch()
            restarted += 1

        if restarted or cleared:
            session.commit()
        else:
            session.rollback()

    if restarted or cleared:
        logger.info(
            "ensure_coworker_polls restarted=%s cleared=%s", restarted, cleared
        )
    return {"inspected": len(leases), "started": restarted, "cleared": cleared}


async def _reschedule_self(task, owner_user_id: int) -> bool:
    lease = await _fetch_lease(owner_user_id)
    if lease is None or not lease.active:
        await _store_task_id(owner_user_id, None)
        return False

    countdown = max(int(lease.interval_seconds), 5)
    async_result = task.apply_async(
        kwargs={"owner_user_id": owner_user_id},
        countdown=countdown,
    )
    await _store_task_id(owner_user_id, async_result.id)
    return True


__all__ = ["execute_due_schedules", "ensure_coworker_polls"]

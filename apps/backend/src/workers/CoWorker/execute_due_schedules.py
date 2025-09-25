"""Celery task that executes schedule-provided DAGs."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Optional

from celery import shared_task
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from apps.backend.src.core.config import settings
from apps.backend.src.core.db import SessionLocal as AsyncSessionLocal
from apps.backend.src.modules.scheduler import repository as repo
from apps.backend.src.modules.scheduler.models import Schedule, ScheduleStatus
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dag_executor import DagExecutor, ExecutionResult
from apps.backend.src.orchestrator.dispatch import ExecutionRuntime
from apps.backend.src.orchestrator.dsl import parse_dag_spec
from apps.backend.src.workers.CoWorker.runtime import ScheduleReschedule

logger = logging.getLogger(__name__)

ENGINE = create_engine(settings.SYNC_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=ENGINE, autocommit=False, autoflush=False)


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


@shared_task(
    name="apps.backend.src.workers.coworker.execute_due_schedules",
    queue="coworker",
    bind=True,
    max_retries=0,
)
def execute_due_schedules(self, owner_user_id: Optional[int] = None):
    persona_scope: Optional[list[int]] = None
    if owner_user_id is not None:
        lease = asyncio.run(_fetch_lease(owner_user_id))
        if lease is None or not lease.active:
            logger.info("coworker lease inactive for user %s", owner_user_id)
            return {"processed": 0, "rescheduled": False, "reason": "inactive"}
        persona_scope = lease.persona_account_ids
        if not persona_scope:
            logger.info("coworker lease has no persona accounts for user %s", owner_user_id)
            asyncio.run(_store_task_id(owner_user_id, None))
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
            rescheduled = _reschedule_self(self, owner_user_id)
            return {"processed": 0, "rescheduled": rescheduled}

        processed = 0
        for schedule in due_schedules:
            snapshot = ScheduleSnapshot.from_model(schedule)
            try:
                repo.mark_running(session, schedule.id)
                session.commit()
            except Exception:
                session.rollback()
                logger.exception("Failed to mark schedule %s running", schedule.id)
                continue

            try:
                exec_result = asyncio.run(_run_snapshot(snapshot))
                repo.mark_done(session, schedule.id, context=exec_result.context)
                session.commit()
                processed += 1
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
            except Exception as exc:
                session.rollback()
                logger.exception("schedule %s failed", schedule.id)
                try:
                    failure_context = getattr(exc, "__schedule_context__", snapshot.context)
                    repo.mark_failed(session, schedule.id, error=str(exc), context=failure_context)
                    session.commit()
                except Exception:
                    session.rollback()
                    logger.exception("Failed to mark schedule %s as failed", schedule.id)
        rescheduled = False
        if owner_user_id is not None:
            rescheduled = _reschedule_self(self, owner_user_id)
        return {"processed": processed, "rescheduled": rescheduled}


async def _run_snapshot(snapshot: ScheduleSnapshot) -> ExecutionResult:
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


def _reschedule_self(task, owner_user_id: int) -> bool:
    lease = asyncio.run(_fetch_lease(owner_user_id))
    if lease is None or not lease.active:
        asyncio.run(_store_task_id(owner_user_id, None))
        return False

    countdown = max(int(lease.interval_seconds), 5)
    async_result = task.apply_async(
        kwargs={"owner_user_id": owner_user_id},
        countdown=countdown,
    )
    asyncio.run(_store_task_id(owner_user_id, async_result.id))
    return True


__all__ = ["execute_due_schedules"]

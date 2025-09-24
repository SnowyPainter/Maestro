# apps/backend/src/workers/CoWorker/tasks.py
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, update
from .dispatcher import run_schedule
from sqlalchemy.orm import sessionmaker
from apps.backend.src.modules.scheduler.models import Schedule, ScheduleStatus
from sqlalchemy import create_engine    
from apps.backend.src.core.config import settings
from apps.backend.src.core.celery_app import celery_app
_ENGINE = create_engine(settings.SYNC_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=_ENGINE, autocommit=False, autoflush=False)


SCAN_INTERVAL_SEC = 30

@celery_app.task(name="apps.backend.src.workers.coworker.scan_and_dispatch", queue="coworker", bind=True, max_retries=None, autoretry_for=())
def scan_and_dispatch(self):
    """스케줄 테이블을 30초마다 스캔하고 due 스케줄을 실행 큐에 올린다.
       beat 없이 자기 재예약."""
    now = datetime.utcnow()
    with SessionLocal() as s:
        due = s.execute(
            select(Schedule).where(
                Schedule.status.in_([ScheduleStatus.PENDING, ScheduleStatus.FAILED]),
                Schedule.due_at <= now
            ).order_by(Schedule.due_at.asc()).limit(100)
        ).scalars().all()

        for sch in due:
            # 상태 전이: ENQUEUED
            s.execute(update(Schedule)
                      .where(Schedule.id == sch.id)
                      .values(status=ScheduleStatus.ENQUEUED, updated_at=now))
            s.commit()
            execute_schedule.apply_async(kwargs={"schedule_id": sch.id})

    # 자기-재예약
    scan_and_dispatch.apply_async(countdown=SCAN_INTERVAL_SEC)


@celery_app.task(name="apps.backend.src.workers.coworker.execute_schedule", queue="coworker", bind=True, max_retries=3, default_retry_delay=15)
def execute_schedule(self, schedule_id: int):
    """단일 스케줄 실행. 실패 시 재시도."""
    with SessionLocal() as s:
        sch: Schedule = s.get(Schedule, schedule_id)
        if not sch or sch.status in ("CANCELLED", "DONE"):
            return
        sch.status = ScheduleStatus.RUNNING
        sch.attempts += 1
        s.commit()

    try:
        # 결정론적 실행(플랫폼/변수 주입은 dispatcher 내부)
        result = run_schedule(sch)
        # 성공 시 internal event 신고 (예: publish-done/metrics 등)
        # post_internal_event(...)
        with SessionLocal() as s2:
            s2.execute(update(Schedule).where(Schedule.id == schedule_id)
                       .values(status=ScheduleStatus.DONE, updated_at=datetime.utcnow()))
            s2.commit()
    except Exception as e:
        with SessionLocal() as s3:
            s3.execute(update(Schedule).where(Schedule.id == schedule_id).values(
                status=ScheduleStatus.FAILED,
                last_error=str(e),
                updated_at=datetime.utcnow()
            ))
            s3.commit()
        raise self.retry(exc=e)

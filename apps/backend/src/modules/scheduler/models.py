# apps/backend/src/modules/scheduler/models.py
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from apps.backend.src.core.db import Base

class ScheduleStatus(str, Enum):
    PENDING = "pending"
    ENQUEUED = "enqueued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    CANCELLED = "cancelled"

class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True)
    # 필수 사용자가 입력
    persona_account_id = Column(Integer, ForeignKey("persona_accounts.id"), nullable=False)

    due_at = Column(DateTime, nullable=False, index=True)
    queue = Column(String, nullable=True, index=True)
    dag_spec = Column(JSON, nullable=False)
    payload = Column(JSON, nullable=True)               # platform, variant, media refs, etc.
    context = Column(JSON, nullable=True)

    # 시스템 수정
    status = Column(String, default=ScheduleStatus.PENDING.value, index=True)  # ScheduleStatus
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    last_error = Column(String, nullable=True)
    errors = Column(JSON, nullable=True)
    idempotency_key = Column(String, nullable=True, unique=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    persona_account = relationship("PersonaAccount")

    def payload_data(self) -> dict[str, Any]:
        """Return payload as dict, guarding against None."""
        return self.payload or {}

    def context_data(self) -> dict[str, Any]:
        """Return context as dict, guarding against None."""
        return self.context or {}


class CoWorkerLease(Base):
    __tablename__ = "coworker_leases"

    id = Column(Integer, primary_key=True)
    owner_user_id = Column(Integer, nullable=False, unique=True, index=True)
    persona_account_ids = Column(JSON, nullable=False, default=list)
    interval_seconds = Column(Integer, nullable=False, default=30)
    active = Column(Boolean, nullable=False, default=True)
    task_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def touch(self) -> None:
        self.updated_at = datetime.utcnow()

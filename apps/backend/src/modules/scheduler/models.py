# apps/backend/src/modules/scheduler/models.py
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from apps.backend.src.core.db import Base
from apps.backend.src.modules.common.enums import ScheduleStatus

class Schedule(Base):
    """Stateful automation entry executed by CoWorker via DagExecutor.

    A schedule records *when* and *how* to run an automated interaction. The
    DAG definition (`dag_spec`) describes the flows to execute, while runtime
    context captures progress (e.g. `_dag.results`, `_resume`). Downstream
    artefacts such as `PostPublication` reference the actual published content
    and do not overlap with this scheduling layer.
    """
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

    @property
    def timeline_label(self) -> str | None:
        """Human-friendly identifier derived from dag_spec metadata.

        Timeline views can call this helper to obtain a descriptive tag
        without hard-coding schedule IDs. To populate it, include a
        top-level ``meta`` block or ``dag.meta`` block in dag_spec, e.g.

        {"meta": {"label": "mail.compose"}, "dag": {...}}
        """

        if not isinstance(self.dag_spec, dict):
            return None

        meta = self.dag_spec.get("meta")
        if isinstance(meta, dict):
            label = meta.get("label") or meta.get("kind")
            if isinstance(label, str):
                return label

        dag = self.dag_spec.get("dag") if isinstance(self.dag_spec, dict) else None
        if isinstance(dag, dict):
            dag_meta = dag.get("meta")
            if isinstance(dag_meta, dict):
                label = dag_meta.get("label") or dag_meta.get("kind")
                if isinstance(label, str):
                    return label

        return None


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

# apps/backend/src/modules/scheduler/models.py
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Index, text
from sqlalchemy.dialects.postgresql import JSONB
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
    dag_spec = Column(JSONB, nullable=False)
    payload = Column(JSONB, nullable=True)               # platform, variant, media refs, etc.
    context = Column(JSONB, nullable=True)

    # 시스템 수정
    status = Column(String, default=ScheduleStatus.PENDING.value, index=True)  # ScheduleStatus
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    last_error = Column(String, nullable=True)
    errors = Column(JSONB, nullable=True)
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
        """Human-friendly identifier derived from context metadata.

        Timeline views can call this helper to obtain a descriptive tag
        without hard-coding schedule IDs. To populate it, include a
        ``template`` field in context, e.g.

        {"template": "mail.trends_with_reply", "plan_title": "test", ...}
        """

        if not isinstance(self.context, dict):
            return None

        # context에서 template 필드 확인
        template = self.context.get("template")
        if isinstance(template, str):
            return template

        # plan_title도 대안으로 사용
        plan_title = self.context.get("plan_title")
        if isinstance(plan_title, str):
            return plan_title

        return None
    
    @property
    def derived_timeline_label(self) -> str | None:
        """캐시된 timeline_label을 반환하거나 계산하여 반환합니다."""
        # 이미 계산된 값이 있으면 반환
        if hasattr(self, '_cached_timeline_label'):
            return self._cached_timeline_label
        
        # timeline_label 계산 후 캐시
        self._cached_timeline_label = self.timeline_label
        return self._cached_timeline_label

    __table_args__ = (
        # 기본 인덱스들
        Index('idx_schedules_due_at', 'due_at'),
        Index('idx_schedules_status', 'status'),
        Index('idx_schedules_persona_account_id', 'persona_account_id'),
        
        # PostgreSQL JSONB용 GIN 인덱스 (context 부분)
        Index('idx_schedules_context', 'context', postgresql_using='gin', 
              postgresql_ops={'context': 'jsonb_path_ops'}),
        
        # timeline_label 빠른 조회용 함수 기반 인덱스 (context의 template 필드)
        Index('idx_schedules_timeline_label', 
              text("((context->>'template'))")),
    )


class CoWorkerLease(Base):
    __tablename__ = "coworker_leases"

    id = Column(Integer, primary_key=True)
    owner_user_id = Column(Integer, nullable=False, unique=True, index=True)
    persona_account_ids = Column(JSONB, nullable=False, default=list)
    interval_seconds = Column(Integer, nullable=False, default=30)
    active = Column(Boolean, nullable=False, default=True)
    task_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def touch(self) -> None:
        self.updated_at = datetime.utcnow()

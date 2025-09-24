# apps/backend/src/modules/scheduler/models.py
from sqlalchemy import Column, Integer, String, DateTime, JSON, Enum, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from apps.backend.src.core.db import Base

"""
ScheduleKind는 1회 작업 단위로 지정한다.
ScheduleKind는 특정 작업 단위가 아닌 미치는 스코프에 따라 나눈다.
"""
class ScheduleKind(str, Enum):
    PUBLISH = "publish" #글 발행/댓글 달기
    DELETE = "delete" #댓글 삭제/글 삭제
    INSIGHT_COLLECT = "insight_collect" #메트릭 수집, 댓글 모니터링
    MAIL = "mail" #이메일 발송

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
    
    kind = Column(String, nullable=False)               # ScheduleKind
    due_at = Column(DateTime, nullable=False, index=True)
    payload = Column(JSON, nullable=True)               # platform, variant, media refs, etc.
    
    # 시스템 수정
    status = Column(String, default="pending", index=True)  # ScheduleStatus
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    last_error = Column(String, nullable=True)
    errors = Column(JSON, nullable=True)
    idempotency_key = Column(String, nullable=True, unique=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    persona_account = relationship("PersonaAccount")
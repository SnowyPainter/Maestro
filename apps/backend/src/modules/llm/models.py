from __future__ import annotations
from datetime import datetime
from typing import Optional, Dict, Any

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, Float, Boolean, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from apps.backend.src.core.db import Base  # 프로젝트의 공용 Base를 사용한다고 가정


class LLMUsage(Base):
    """LLM 활동 추적 로그"""
    __tablename__ = "llm_usage"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # 요청 컨텍스트
    request_id: Mapped[Optional[str]] = mapped_column(String(64))
    user_id: Mapped[Optional[str]] = mapped_column(String(64))
    account_id: Mapped[Optional[str]] = mapped_column(String(64))
    endpoint: Mapped[Optional[str]] = mapped_column(String(128))
    action: Mapped[Optional[str]] = mapped_column(String(128))
    trace_parent: Mapped[Optional[str]] = mapped_column(String(128))
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(128))

    # LLM 호출 정보
    model: Mapped[str] = mapped_column(String(64), nullable=False)
    prompt_key: Mapped[str] = mapped_column(String(64), nullable=False)
    version: Mapped[Optional[str]] = mapped_column(String(32))

    # 자원 사용량
    tokens_prompt: Mapped[Optional[int]] = mapped_column(Integer)
    tokens_completion: Mapped[Optional[int]] = mapped_column(Integer)
    cost_usd: Mapped[Optional[float]] = mapped_column(Float)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer)

    # 결과/에러
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    error_code: Mapped[Optional[str]] = mapped_column(String(64))
    error_message: Mapped[Optional[str]] = mapped_column(String(512))

    # 프롬프트/결과 메타(선택 저장: 보안/프라이버시 고려해 요약/프리뷰만)
    meta: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict)

# src/modules/insights/models.py
from __future__ import annotations
from datetime import datetime
from typing import Optional

import enum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import (
    Integer, String, DateTime, Enum, JSON, ForeignKey, Index, UniqueConstraint
)
from apps.backend.src.core.db import Base
from apps.backend.src.modules.common.enums import PlatformKind


class InsightSource(str, enum.Enum):
    WEBHOOK = "webhook"
    POLL = "poll"
    MANUAL = "manual"


class InsightSample(Base):
    """
    모니터링 원시 샘플 (드래프트 종속)
    - 한 행은 특정 ts 시점의 '해당 게시물' 상태 스냅샷
    - idempotency를 위해 ingest_key(플랫폼 이벤트 id 등) 또는 (platform, platform_post_id, ts) 유니크
    """
    __tablename__ = "insight_samples"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    owner_user_id: Mapped[int] = mapped_column(Integer, index=True)

    draft_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("drafts.id", ondelete="SET NULL"), index=True
    )

    platform: Mapped[PlatformKind] = mapped_column(Enum(PlatformKind), index=True)
    platform_post_id: Mapped[Optional[str]] = mapped_column(String(128), index=True)
    
    account_persona_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("persona_accounts.id", ondelete="SET NULL"), index=True
    )

    # 관측 시각(플랫폼에서 보고된 시각 or 조회 기준 시각)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    # 측정 값 (ex: {"impressions":123, "likes":10, ...})
    metrics: Mapped[dict] = mapped_column(JSON)

    # 중복 방지용 키(플랫폼 이벤트 id 등)
    ingest_key: Mapped[Optional[str]] = mapped_column(String(128), unique=True, index=True)

    source: Mapped[str] = mapped_column(String(16), default=InsightSource.WEBHOOK.value)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        # 동일 포스트의 동일 시각 샘플은 1개만
        UniqueConstraint("platform", "platform_post_id", "ts", name="uq_insight_post_ts"),
        Index("ix_insight_draft_ts", "draft_id", "ts"),
        Index("ix_insight_platform_post_ts", "platform", "platform_post_id", "ts"),
    )

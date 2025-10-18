from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.backend.src.core.db import Base


class Playbook(Base):
    """
    Persona x Campaign 단위의 브랜드 인텔리전스 컨테이너.
    """

    __tablename__ = "playbooks"
    __table_args__ = (
        UniqueConstraint(
            "persona_id",
            "campaign_id",
            name="uq_playbook_persona_campaign",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    persona_id: Mapped[int] = mapped_column(
        ForeignKey("personas.id", ondelete="CASCADE"),
        index=True,
    )
    campaign_id: Mapped[int] = mapped_column(
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        index=True,
    )

    aggregate_kpi: Mapped[Optional[dict]] = mapped_column(JSON)
    best_time_window: Mapped[Optional[str]] = mapped_column(String(40))
    best_tone: Mapped[Optional[str]] = mapped_column(String(40))
    top_hashtags: Mapped[Optional[list[str]]] = mapped_column(JSON)

    last_event: Mapped[Optional[str]] = mapped_column(String(50))
    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )

    persona = relationship("Persona")
    campaign = relationship("Campaign")
    logs = relationship(
        "PlaybookLog",
        back_populates="playbook",
        cascade="all, delete-orphan",
    )


class PlaybookLog(Base):
    """
    Playbook에 속한 모든 이벤트 로그.
    """

    __tablename__ = "playbook_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    playbook_id: Mapped[int] = mapped_column(
        ForeignKey("playbooks.id", ondelete="CASCADE"),
        index=True,
    )
    event: Mapped[str] = mapped_column(String(50))
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )

    draft_id: Mapped[Optional[int]] = mapped_column(Integer)
    schedule_id: Mapped[Optional[int]] = mapped_column(Integer)
    abtest_id: Mapped[Optional[int]] = mapped_column(Integer)
    ref_id: Mapped[Optional[int]] = mapped_column(Integer)

    persona_snapshot: Mapped[Optional[dict]] = mapped_column(JSON)
    trend_snapshot: Mapped[Optional[dict]] = mapped_column(JSON)
    llm_input: Mapped[Optional[dict]] = mapped_column(JSON)
    llm_output: Mapped[Optional[dict]] = mapped_column(JSON)
    kpi_snapshot: Mapped[Optional[dict]] = mapped_column(JSON)
    meta: Mapped[Optional[dict]] = mapped_column(JSON)
    message: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )

    playbook = relationship("Playbook", back_populates="logs")

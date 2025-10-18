from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.backend.src.core.db import Base


class ABTestWinner(str, Enum):
    VARIANT_A = "A"
    VARIANT_B = "B"


class ABTest(Base):
    """
    Persona x Campaign 단위로 실행되는 A/B 테스트 스냅샷.
    Draft Variant 두 개를 비교하며 결과를 Playbook에 축적한다.
    """

    __tablename__ = "ab_tests"
    __table_args__ = (
        UniqueConstraint(
            "persona_id",
            "campaign_id",
            "variant_a_id",
            "variant_b_id",
            name="uq_abtest_persona_campaign_variants",
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

    variable: Mapped[str] = mapped_column(String(50))
    hypothesis: Mapped[Optional[str]] = mapped_column(String(255))

    variant_a_id: Mapped[int] = mapped_column(
        ForeignKey("drafts.id", ondelete="CASCADE"),
        index=True,
    )
    variant_b_id: Mapped[int] = mapped_column(
        ForeignKey("drafts.id", ondelete="CASCADE"),
        index=True,
    )

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    winner_variant: Mapped[Optional[ABTestWinner]] = mapped_column(
        SAEnum(ABTestWinner),
        nullable=True,
    )
    uplift_percentage: Mapped[Optional[float]] = mapped_column(Float)
    notes: Mapped[Optional[str]] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    persona = relationship("Persona")
    campaign = relationship("Campaign")
    variant_a = relationship(
        "Draft",
        foreign_keys=[variant_a_id],
        lazy="joined",
    )
    variant_b = relationship(
        "Draft",
        foreign_keys=[variant_b_id],
        lazy="joined",
    )

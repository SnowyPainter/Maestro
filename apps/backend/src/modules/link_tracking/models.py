from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column

from apps.backend.src.core.db import Base


class TrackingLink(Base):
    __tablename__ = "tracking_links"
    __table_args__ = (
        UniqueConstraint("token", name="uq_tracking_link_token"),
        Index("ix_tracking_links_persona_created_at", "persona_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(String(64), nullable=False)
    owner_user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    persona_id: Mapped[int] = mapped_column(
        ForeignKey("personas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    variant_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("draft_variants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    draft_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("drafts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    target_url: Mapped[str] = mapped_column(Text, nullable=False)
    context: Mapped[dict | None] = mapped_column(JSON)

    visit_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_visited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


__all__ = ["TrackingLink"]

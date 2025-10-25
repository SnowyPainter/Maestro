from __future__ import annotations

from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.backend.src.core.db import Base


class FileKind(str, PyEnum):
    IMAGE = "image"
    VIDEO = "video"
    TEXT = "text"


class MediaAsset(Base):
    __tablename__ = "media_assets"
    __table_args__ = (
        Index("ix_media_assets_owner_kind", "owner_user_id", "kind"),
        {'extend_existing': True}
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int] = mapped_column(Integer, index=True)
    draft_id: Mapped[Optional[int]] = mapped_column(ForeignKey("drafts.id", ondelete="SET NULL"), nullable=True, index=True)
    kind: Mapped[FileKind] = mapped_column(Enum(FileKind), nullable=False, index=True)

    bucket: Mapped[str] = mapped_column(String(128), nullable=False)
    object_name: Mapped[str] = mapped_column(String(512), nullable=False)
    url: Mapped[str] = mapped_column(String(1024), nullable=False)
    content_type: Mapped[Optional[str]] = mapped_column(String(128))
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    original_filename: Mapped[Optional[str]] = mapped_column(String(256))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    draft = relationship("Draft", foreign_keys=[draft_id])


__all__ = ["FileKind", "MediaAsset"]

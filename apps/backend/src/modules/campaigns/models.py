# src/modules/campaigns/models.py
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Integer, String, DateTime, Enum, JSON, ForeignKey, Index, UniqueConstraint
from datetime import datetime
import uuid
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from pgvector.sqlalchemy import Vector
from apps.backend.src.core.db import Base
from apps.backend.src.modules.common.enums import KPIKey, Aggregation, PlatformKind
from apps.backend.src.core.config import settings

class Campaign(Base):
    __tablename__ = "campaigns"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int] = mapped_column(Integer, index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    description: Mapped[str | None] = mapped_column(String(500))
    start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_at:   Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    graph_node_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True, index=True)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(settings.EMBED_DIM), nullable=True)

    __table_args__ = (UniqueConstraint('owner_user_id','name', name='uq_campaign_name_owner'),)

class CampaignKPIDef(Base):
    """
    캠페인에서 추적할 KPI 정의(목표/집계방식/가중 등)
    """
    __tablename__ = "campaign_kpi_defs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"), index=True)
    key: Mapped[KPIKey] = mapped_column(Enum(KPIKey), index=True)
    target_value: Mapped[float | None] = mapped_column(Integer)      # 목표치(없어도 됨)
    aggregation: Mapped[Aggregation] = mapped_column(Enum(Aggregation), default=Aggregation.SUM)
    weight: Mapped[float] = mapped_column(Integer, default=1)

class CampaignKPIResult(Base):
    """
    특정 시점 기준으로 계산된 캠페인 KPI 값(롤업 테이블)
    """
    __tablename__ = "campaign_kpi_results"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"), index=True)
    as_of: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    values: Mapped[dict] = mapped_column(JSON)  # {"impressions": 1234, "ctr": 0.042, ...}

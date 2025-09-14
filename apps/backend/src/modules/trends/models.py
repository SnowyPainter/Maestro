from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from sqlalchemy import (
    String, Integer, DateTime, Text, ForeignKey, UniqueConstraint, Index, func
)
from sqlalchemy.orm import (
    DeclarativeBase, Mapped, mapped_column, relationship
)
from pgvector.sqlalchemy import Vector

from apps.backend.src.core.db import Base
from apps.backend.src.core.config import settings

class Trend(Base):
    __tablename__ = "trends"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # 수집 메타
    country: Mapped[str] = mapped_column(String(8), index=True)           # 예: "KR", "US"
    retrieved: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, default=func.now())
    rank: Mapped[int] = mapped_column(Integer, index=True)

    # 본문
    title: Mapped[str] = mapped_column(String(512), index=True)
    approx_traffic: Mapped[Optional[str]] = mapped_column(String(64))
    link: Mapped[Optional[str]] = mapped_column(Text)
    pub_date: Mapped[Optional[str]] = mapped_column(String(64))            # 원문이 string이라 string 유지
    picture: Mapped[Optional[str]] = mapped_column(Text)
    picture_source: Mapped[Optional[str]] = mapped_column(Text)
    news_item_raw: Mapped[Optional[str]] = mapped_column(Text)

    # 벡터 검색(임베딩 차원은 Alembic에서 고정: vector(EMBED_DIM))
    title_embedding: Mapped[Optional[list[float]]] = mapped_column(Vector(settings.EMBED_DIM), nullable=True)

    # 관계
    news_items: Mapped[List["NewsItem"]] = relationship(
        back_populates="trend", cascade="all, delete-orphan", lazy="selectin"
    )

    __table_args__ = (
        # 같은 시각 같은 국가에서 동일 키워드는 중복 방지
        UniqueConstraint("country", "retrieved", "title", name="uq_trend_country_retrieved_title"),
        # 정렬/조회 자주 쓰는 조합 인덱스
        Index("ix_trends_country_retrieved_rank", "country", "retrieved", "rank"),
    )

    def __repr__(self) -> str:
        return f"<Trend id={self.id} {self.country} #{self.rank} '{self.title[:24]}' @ {self.retrieved}>"

# ────────────────────────────────────────────────────────────────────────────────
# NewsItem: 트렌드에 딸린 관련 뉴스
# ────────────────────────────────────────────────────────────────────────────────
class NewsItem(Base):
    __tablename__ = "trend_news_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trend_id: Mapped[int] = mapped_column(ForeignKey("trends.id", ondelete="CASCADE"), index=True)

    title: Mapped[Optional[str]] = mapped_column(Text)
    url: Mapped[Optional[str]] = mapped_column(Text)
    picture: Mapped[Optional[str]] = mapped_column(Text)
    source: Mapped[Optional[str]] = mapped_column(Text)

    trend: Mapped[Trend] = relationship(back_populates="news_items")

    def __repr__(self) -> str:
        return f"<NewsItem id={self.id} trend_id={self.trend_id} title='{(self.title or '')[:24]}'>"

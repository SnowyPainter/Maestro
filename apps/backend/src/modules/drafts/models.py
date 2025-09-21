from __future__ import annotations
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Integer, String, Text, DateTime, ForeignKey, Enum, JSON, Index, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import select
from sqlalchemy.ext.hybrid import hybrid_property
from apps.backend.src.core.db import Base
from apps.backend.src.modules.common.enums import DraftState, PlatformKind, VariantStatus, PostStatus
from apps.backend.src.modules.accounts.models import PersonaAccount


class Draft(Base):
    """
    유저 범용 드래프트 (페르소나/어카운트와 독립)
    - IR(중간표현)을 저장
    - 캠페인에 속할 수도, 속하지 않을 수도 있음
    - 퍼블리시는 다른 모듈에서 draft_id + persona_account_id로 실행
    """
    __tablename__ = "drafts"
    __table_args__ = (
        Index("ix_drafts_user_state", "user_id", "state"),
        {'extend_existing': True}
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # 소유자 / 범 캠페인
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    campaign_id: Mapped[Optional[int]] = mapped_column(ForeignKey("campaigns.id", ondelete="SET NULL"), index=True, nullable=True)

    # 메타
    title: Mapped[Optional[str]] = mapped_column(String(140))
    tags: Mapped[Optional[list[str]]] = mapped_column(JSON)   # 내부 분류 태그
    goal: Mapped[Optional[str]] = mapped_column(String(40))   # awareness|lead|cta_click 등

    # IR(중간표현): 블록 기반 문서 + 옵션
    ir: Mapped[dict] = mapped_column(JSON)                    # {"blocks":[...], "options":{...}}
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    ir_revision: Mapped[int] = mapped_column(Integer, default=1)  # IR 변경 시 증가 (Variant staleness 판정)

    # 상태 전이 (작성/예약/모니터링/게시/삭제)
    state: Mapped[DraftState] = mapped_column(Enum(DraftState), default=DraftState.DRAFT, index=True)

    # 추적 정보
    created_by: Mapped[int] = mapped_column(Integer, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    variants = relationship(
        "DraftVariant",
        back_populates="draft",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class DraftVariant(Base):
    """
    드래프트의 '플랫폼별' 컴파일 산출물(계정과 무관)
    - 하나의 Draft에 대해 플랫폼마다 0..1개의 Variant가 존재
    - 퍼블리시 단계에서 이 Variant를 기반으로 계정별 페이로드로 변환
    """
    __tablename__ = "draft_variants"
    __table_args__ = (
        UniqueConstraint("draft_id", "platform", name="uq_variant_draft_platform"),
        Index("ix_variant_draft_platform", "draft_id", "platform"),
        {'extend_existing': True}
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    draft_id: Mapped[int] = mapped_column(ForeignKey("drafts.id", ondelete="CASCADE"), index=True)
    platform: Mapped[PlatformKind] = mapped_column(Enum(PlatformKind), index=True)

    # 컴파일/검증 상태
    status: Mapped[VariantStatus] = mapped_column(Enum(VariantStatus), default=VariantStatus.PENDING, index=True)
    errors: Mapped[Optional[list[str]]] = mapped_column(JSON)
    warnings: Mapped[Optional[list[str]]] = mapped_column(JSON)

    # 컴파일 결과(플랫폼 중립 페이로드/블록 뷰)
    rendered_caption: Mapped[Optional[str]] = mapped_column(Text)
    rendered_blocks: Mapped[Optional[dict]] = mapped_column(JSON)   # {"media":[...], "poll": {...}} 등
    metrics: Mapped[Optional[dict]] = mapped_column(JSON)           # {"char_count":..,"hashtags":..,"line_breaks":..}

    # 동기화/버전
    compiled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ir_revision_compiled: Mapped[Optional[int]] = mapped_column(Integer)  # 이 Variant를 만들 때 사용한 Draft.ir_revision
    compiler_version: Mapped[int] = mapped_column(Integer, default=1)     # 규칙 변경 시 재컴파일 판단용

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    draft = relationship("Draft", back_populates="variants")

    @hybrid_property
    def draft_owner_id(self) -> int:
        return self.draft.user_id

    @draft_owner_id.expression
    def draft_owner_id(cls):
        return select(Draft.user_id).where(Draft.id == cls.draft_id).scalar_subquery()

    publications = relationship(
        "PostPublication",
        back_populates="variant",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class PostPublication(Base):
    __tablename__ = "post_publications"
    __table_args__ = (
        # 동일 계정에서 동일 external_id는 유일
        UniqueConstraint("platform", "account_persona_id", "external_id", name="uq_pub_account_external", deferrable=True, initially="DEFERRED"),
        Index("ix_pub_variant_account", "variant_id", "account_persona_id"),
        {'extend_existing': True}
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    variant_id: Mapped[int] = mapped_column(ForeignKey("draft_variants.id", ondelete="CASCADE"), index=True)
    account_persona_id: Mapped[int] = mapped_column(ForeignKey("persona_accounts.id", ondelete="CASCADE"), index=True)

    variant = relationship("DraftVariant", back_populates="publications")
    persona_account = relationship(PersonaAccount)

    platform: Mapped[PlatformKind] = mapped_column(Enum(PlatformKind), index=True)

    # 실제 외부 게시물 식별자
    external_id: Mapped[Optional[str]] = mapped_column(String(128), index=True, nullable=True)
    permalink: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    # 퍼블리시 라이프사이클
    status: Mapped[str] = mapped_column(Enum(PostStatus), default=PostStatus.PENDING, index=True)
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # 모니터링 윈도우(계정/게시물별)
    monitoring_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    monitoring_ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # 마지막 수집 시각(옵션)
    last_polled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    errors: Mapped[Optional[list[str]]] = mapped_column(JSON)
    warnings: Mapped[Optional[list[str]]] = mapped_column(JSON)
    meta: Mapped[Optional[dict]] = mapped_column(JSON)  # 요청 페이로드 스냅샷 등

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    @hybrid_property
    def draft_id_hybrid(self) -> int | None:
        return self.variant.draft_id if self.variant else None

    @draft_id_hybrid.expression
    def draft_id_hybrid(cls):
        return (
            select(DraftVariant.draft_id)
            .where(DraftVariant.id == cls.variant_id)
            .correlate(cls)
            .scalar_subquery()
        )
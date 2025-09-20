# src/modules/accounts/models.py
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, DateTime, JSON, Text, ForeignKey, Boolean, UniqueConstraint, Index, Enum
from datetime import datetime
from apps.backend.src.core.db import Base
from apps.backend.src.modules.common.enums import PlatformKind, Permission

class PlatformAccount(Base):
    __tablename__ = "platform_accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int] = mapped_column(Integer, index=True)  # 시스템 사용자 소유자
    platform: Mapped[PlatformKind] = mapped_column(Enum(PlatformKind), index=True)
    handle: Mapped[str] = mapped_column(String(128), index=True)     # @handle / 채널명
    external_id: Mapped[str | None] = mapped_column(String(256), index=True)  # 플랫폼 고유 ID
    avatar_url: Mapped[str | None] = mapped_column(String(512))
    bio: Mapped[str | None] = mapped_column(String(160))

    # OAuth / 토큰
    access_token: Mapped[str | None] = mapped_column(Text)
    refresh_token: Mapped[str | None] = mapped_column(Text)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scopes: Mapped[list[str] | None] = mapped_column(JSON)  # ["content_publish", "dm", ...]

    # 상태/건강
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('platform', 'external_id', name='uq_platform_external'),
        Index('ix_platform_handle', 'platform', 'handle'),
    )

class Persona(Base):
    __tablename__ = "personas"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int] = mapped_column(Integer, index=True)

    name: Mapped[str] = mapped_column(String(100), index=True)     # “Tapgrow Korea”, “민우_개인브랜딩”
    avatar_url: Mapped[str | None] = mapped_column(String(512))
    bio: Mapped[str | None] = mapped_column(String(200))

    # 작성 정책(주요 필드는 스키마화)
    language: Mapped[str] = mapped_column(String(10), default="en")   # "ko", "en", "zh"
    tone: Mapped[str | None] = mapped_column(String(40))              # "witty", "formal", "playful", ...
    style_guide: Mapped[str | None] = mapped_column(Text)             # 문체 지침(요약)
    pillars: Mapped[list[str] | None] = mapped_column(JSON)           # ["제품팁", "사용사례", "비하인드", ...]
    banned_words: Mapped[list[str] | None] = mapped_column(JSON)      # 금칙어
    default_hashtags: Mapped[list[str] | None] = mapped_column(JSON)  # 후보 해시태그 세트
    hashtag_rules: Mapped[dict | None] = mapped_column(JSON)          # {max_count: 12, casing: "lower", pinned: ["#Tapgrow"]}
    link_policy: Mapped[dict | None] = mapped_column(JSON)            # {link_in_bio: "...", utm: {...}}
    media_prefs: Mapped[dict | None] = mapped_column(JSON)            # {preferred_ratio: "9:16", allow_carousel: true}
    posting_windows: Mapped[list[dict] | None] = mapped_column(JSON)  # [{dow: "Mon", start:"09:00", end:"12:00"}]

    # 확장 메타(스키마 버전관리)
    extras: Mapped[dict | None] = mapped_column(JSON)                 # JSONSchema로 검증
    schema_version: Mapped[int] = mapped_column(Integer, default=1)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (UniqueConstraint('owner_user_id','name', name='uq_persona_name_per_owner'),)

class PersonaAccount(Base):
    """
    '사용가능한 계정' = 특정 Persona가 특정 PlatformAccount를 사용 가능함을 의미.
    권한/검증상태/기본 템플릿을 담아 운용.
    """
    __tablename__ = "persona_accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    persona_id: Mapped[int] = mapped_column(ForeignKey("personas.id", ondelete="CASCADE"), index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("platform_accounts.id", ondelete="CASCADE"), index=True)

    can_permissions: Mapped[list[Permission]] = mapped_column(JSON, default=[Permission.READ, Permission.PUBLISH, Permission.WRITE])
    is_verified_link: Mapped[bool] = mapped_column(Boolean, default=False)  # 브랜드/비즈 인증 등
    default_templates: Mapped[dict | None] = mapped_column(JSON)            # 플랫폼별 캡션/서명 템플릿

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    persona = relationship(Persona)

    __table_args__ = (UniqueConstraint('persona_id','account_id', name='uq_persona_account'),)

# apps/backend/src/modules/reactive/models.py
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.backend.src.core.db import Base

from apps.backend.src.modules.common.enums import (
    ReactionActionStatus,
    ReactionActionType,
    ReactionLLMMode,
    ReactionMatchType,
    ReactionRuleStatus,
)


class ReactionRule(Base):
    """Top-level configuration that maps keywords to tags and tags to actions."""

    __tablename__ = "reaction_rules"
    __table_args__ = (
        Index("ix_reaction_rules_owner_priority", "owner_user_id", "priority"),
        {"extend_existing": True},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int] = mapped_column(Integer, index=True)

    name: Mapped[str] = mapped_column(String(120), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[ReactionRuleStatus] = mapped_column(
        Enum(ReactionRuleStatus), default=ReactionRuleStatus.ACTIVE, index=True
    )
    priority: Mapped[int] = mapped_column(Integer, default=100, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    keywords: Mapped[list["ReactionRuleKeyword"]] = relationship(
        "ReactionRuleKeyword",
        back_populates="rule",
        cascade="all, delete-orphan",
    )
    actions: Mapped[list["ReactionRuleAction"]] = relationship(
        "ReactionRuleAction",
        back_populates="rule",
        cascade="all, delete-orphan",
    )
    publications: Mapped[list["ReactionRulePublication"]] = relationship(
        "ReactionRulePublication",
        back_populates="rule",
        cascade="all, delete-orphan",
    )
    alerts: Mapped[list["ReactionAlert"]] = relationship(
        "ReactionAlert",
        back_populates="rule",
        cascade="all, delete-orphan",
    )


class ReactionRuleKeyword(Base):
    """Keyword matcher that produces a tag when matched."""

    __tablename__ = "reaction_rule_keywords"
    __table_args__ = (
        UniqueConstraint(
            "reaction_rule_id",
            "tag_key",
            "keyword",
            name="uq_rule_tag_keyword",
        ),
        Index(
            "ix_reaction_rule_keywords_rule_tag",
            "reaction_rule_id",
            "tag_key",
        ),
        {"extend_existing": True},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reaction_rule_id: Mapped[int] = mapped_column(
        ForeignKey("reaction_rules.id", ondelete="CASCADE"),
        index=True,
    )
    tag_key: Mapped[str] = mapped_column(String(64), index=True)
    match_type: Mapped[ReactionMatchType] = mapped_column(
        Enum(ReactionMatchType),
        default=ReactionMatchType.CONTAINS,
    )
    keyword: Mapped[str] = mapped_column(String(160))
    language: Mapped[Optional[str]] = mapped_column(String(10))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    priority: Mapped[int] = mapped_column(Integer, default=100)

    rule: Mapped[ReactionRule] = relationship("ReactionRule", back_populates="keywords")


class ReactionRuleAction(Base):
    """Per-tag action configuration."""

    __tablename__ = "reaction_rule_actions"
    __table_args__ = (
        UniqueConstraint(
            "reaction_rule_id",
            "tag_key",
            name="uq_rule_action_tag",
        ),
        {"extend_existing": True},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reaction_rule_id: Mapped[int] = mapped_column(
        ForeignKey("reaction_rules.id", ondelete="CASCADE"),
        index=True,
    )
    tag_key: Mapped[str] = mapped_column(String(64), index=True)

    dm_template_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reply_template_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    alert_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    alert_severity: Mapped[Optional[str]] = mapped_column(String(20))
    alert_assignee_user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    llm_mode: Mapped[ReactionLLMMode] = mapped_column(
        Enum(ReactionLLMMode),
        default=ReactionLLMMode.TEMPLATE_ONLY,
    )
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSON)

    rule: Mapped[ReactionRule] = relationship("ReactionRule", back_populates="actions")


class ReactionRulePublication(Base):
    """Link table connecting rules to post publications."""

    __tablename__ = "reaction_rule_publications"
    __table_args__ = (
        UniqueConstraint(
            "reaction_rule_id",
            "post_publication_id",
            name="uq_rule_publication",
        ),
        Index(
            "ix_reaction_rule_publications_publication",
            "post_publication_id",
            "priority",
        ),
        {"extend_existing": True},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reaction_rule_id: Mapped[int] = mapped_column(
        ForeignKey("reaction_rules.id", ondelete="CASCADE"),
        index=True,
    )
    post_publication_id: Mapped[int] = mapped_column(
        ForeignKey("post_publications.id", ondelete="CASCADE"),
        index=True,
    )
    priority: Mapped[int] = mapped_column(Integer, default=100, index=True)
    active_from: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    active_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    rule: Mapped[ReactionRule] = relationship("ReactionRule", back_populates="publications")


class ReactionMessageTemplate(Base):
    """Reusable message template for DM or reply interactions."""

    __tablename__ = "reaction_message_templates"
    __table_args__ = (
        Index(
            "ix_reaction_message_templates_owner",
            "owner_user_id",
            "template_type",
        ),
        {"extend_existing": True},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int] = mapped_column(Integer, index=True)
    persona_account_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        index=True,
        nullable=True,
    )
    template_type: Mapped[ReactionActionType] = mapped_column(Enum(ReactionActionType), index=True)
    tag_key: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(Text)
    language: Mapped[Optional[str]] = mapped_column(String(10))
    template_metadata: Mapped[dict | None] = mapped_column("metadata", JSON)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


class ReactionActionLog(Base):
    """Execution log for actions triggered by reaction rules."""

    __tablename__ = "reaction_action_logs"
    __table_args__ = (
        UniqueConstraint(
            "insight_comment_id",
            "tag_key",
            "action_type",
            name="uq_reaction_action_unique",
        ),
        Index(
            "ix_reaction_action_logs_comment",
            "insight_comment_id",
            "status",
        ),
        {"extend_existing": True},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    insight_comment_id: Mapped[int] = mapped_column(
        ForeignKey("insight_comments.id", ondelete="CASCADE"),
        index=True,
    )
    reaction_rule_id: Mapped[int] = mapped_column(
        ForeignKey("reaction_rules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    tag_key: Mapped[str] = mapped_column(String(64), index=True)
    action_type: Mapped[ReactionActionType] = mapped_column(Enum(ReactionActionType), index=True)
    status: Mapped[ReactionActionStatus] = mapped_column(
        Enum(ReactionActionStatus),
        default=ReactionActionStatus.PENDING,
    )
    payload: Mapped[dict | None] = mapped_column(JSON)
    error: Mapped[Optional[str]] = mapped_column(Text)
    executed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    rule: Mapped[Optional[ReactionRule]] = relationship("ReactionRule")


class ReactionAlert(Base):
    """Alert entity created when a tag requires manual review."""

    __tablename__ = "reaction_alerts"
    __table_args__ = (
        Index(
            "ix_reaction_alerts_status",
            "status",
        ),
        {"extend_existing": True},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reaction_rule_id: Mapped[int] = mapped_column(
        ForeignKey("reaction_rules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    insight_comment_id: Mapped[int] = mapped_column(
        ForeignKey("insight_comments.id", ondelete="CASCADE"),
        index=True,
    )
    tag_key: Mapped[str] = mapped_column(String(64), index=True)
    severity: Mapped[Optional[str]] = mapped_column(String(20))
    assignee_user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[ReactionActionStatus] = mapped_column(
        Enum(ReactionActionStatus),
        default=ReactionActionStatus.PENDING,
    )
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    resolution_note: Mapped[Optional[str]] = mapped_column(Text)

    rule: Mapped[Optional[ReactionRule]] = relationship("ReactionRule", back_populates="alerts")

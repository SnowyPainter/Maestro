# apps/backend/src/modules/reactive/schemas.py
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from apps.backend.src.modules.common.enums import (
    ReactionActionStatus,
    ReactionActionType,
    ReactionLLMMode,
    ReactionMatchType,
    ReactionRuleStatus,
)


class ReactionRuleKeywordConfig(BaseModel):
    tag_key: str = Field(..., description="Tag emitted when the keyword matches")
    match_type: ReactionMatchType = Field(
        default=ReactionMatchType.CONTAINS,
        description="Matching rule for the keyword",
    )
    keyword: str = Field(..., description="Keyword or pattern to match")
    language: Optional[str] = Field(default=None, description="Optional language hint")
    is_active: bool = Field(default=True)
    priority: int = Field(default=100)


class ReactionRuleActionConfig(BaseModel):
    tag_key: str = Field(..., description="Tag key this action applies to")
    dm_template_id: Optional[int] = Field(default=None)
    reply_template_id: Optional[int] = Field(default=None)
    alert_enabled: bool = Field(default=False)
    alert_severity: Optional[str] = Field(default=None)
    alert_assignee_user_id: Optional[int] = Field(default=None)
    llm_mode: ReactionLLMMode = Field(default=ReactionLLMMode.TEMPLATE_ONLY)
    metadata: Optional[dict] = Field(default=None)


class ReactionRuleBase(BaseModel):
    name: str
    description: Optional[str] = None
    status: ReactionRuleStatus = ReactionRuleStatus.ACTIVE
    priority: int = 100
    keywords: list[ReactionRuleKeywordConfig] = Field(default_factory=list)
    actions: list[ReactionRuleActionConfig] = Field(default_factory=list)


class ReactionRuleCreate(ReactionRuleBase):
    owner_user_id: Optional[int] = Field(default=None, description="Set by service when omitted")


class ReactionRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ReactionRuleStatus] = None
    priority: Optional[int] = None
    keywords: Optional[list[ReactionRuleKeywordConfig]] = None
    actions: Optional[list[ReactionRuleActionConfig]] = None


class ReactionRuleKeywordOut(ReactionRuleKeywordConfig):
    id: int


class ReactionRuleActionOut(ReactionRuleActionConfig):
    id: int


class ReactionRuleOut(BaseModel):
    id: int
    owner_user_id: int
    name: str
    description: Optional[str]
    status: ReactionRuleStatus
    priority: int
    created_at: datetime
    updated_at: datetime
    keywords: list[ReactionRuleKeywordOut] = Field(default_factory=list)
    actions: list[ReactionRuleActionOut] = Field(default_factory=list)


class ReactionRulePublicationLink(BaseModel):
    id: int
    reaction_rule_id: int
    post_publication_id: int
    priority: int
    active_from: Optional[datetime]
    active_until: Optional[datetime]
    is_active: bool


class ReactionRulePublicationCreate(BaseModel):
    post_publication_id: int
    priority: int = 100
    active_from: Optional[datetime] = None
    active_until: Optional[datetime] = None
    is_active: bool = True


class ReactionActionLogOut(BaseModel):
    id: int
    insight_comment_id: int
    reaction_rule_id: Optional[int]
    tag_key: str
    action_type: ReactionActionType
    status: ReactionActionStatus
    payload: Optional[dict]
    error: Optional[str]
    executed_at: Optional[datetime]
    created_at: datetime


class ReactionEvaluationAction(BaseModel):
    reaction_rule_id: int
    rule_priority: int
    tag_key: str
    dm_template_id: Optional[int]
    reply_template_id: Optional[int]
    alert_enabled: bool
    alert_severity: Optional[str]
    alert_assignee_user_id: Optional[int]
    llm_mode: ReactionLLMMode
    metadata: Optional[dict]


class ReactionEvaluationResult(BaseModel):
    comment_id: int
    matched_tags: list[str] = Field(default_factory=list)
    actions: list[ReactionEvaluationAction] = Field(default_factory=list)


class ReactionActionLogListResult(BaseModel):
    total: int
    items: List[ReactionActionLogOut] = Field(default_factory=list)


class ReactionMessageTemplateBase(BaseModel):
    persona_account_id: Optional[int] = Field(default=None)
    template_type: ReactionActionType
    tag_key: Optional[str] = Field(default=None)
    title: Optional[str] = Field(default=None)
    body: str
    language: Optional[str] = Field(default=None)
    metadata: Optional[dict] = Field(default=None)
    is_active: bool = True


class ReactionMessageTemplateCreate(ReactionMessageTemplateBase):
    pass


class ReactionMessageTemplateUpdate(BaseModel):
    persona_account_id: Optional[int] = Field(default=None)
    template_type: Optional[ReactionActionType] = Field(default=None)
    tag_key: Optional[str] = Field(default=None)
    title: Optional[str] = Field(default=None)
    body: Optional[str] = Field(default=None)
    language: Optional[str] = Field(default=None)
    metadata: Optional[dict] = Field(default=None)
    is_active: Optional[bool] = Field(default=None)


class ReactionMessageTemplateOut(BaseModel):
    id: int
    owner_user_id: int
    persona_account_id: Optional[int]
    template_type: ReactionActionType
    tag_key: Optional[str]
    title: Optional[str]
    body: str
    language: Optional[str]
    metadata: Optional[dict]
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ReactionMessageTemplateListResult(BaseModel):
    items: List[ReactionMessageTemplateOut] = Field(default_factory=list)

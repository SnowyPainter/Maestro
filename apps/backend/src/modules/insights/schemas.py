# src/modules/insights/schemas.py
from __future__ import annotations
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict, field_validator
from apps.backend.src.modules.common.enums import PlatformKind, KPIKey, MetricsScope, ContentKind, InsightSource

class InsightIn(BaseModel):
    owner_user_id: int
    post_publication_id: Optional[int] = None
    platform: PlatformKind
    platform_post_id: Optional[str] = None
    account_persona_id: Optional[int] = None
    ts: datetime

    # 표준화 KPI dict (키: KPIKey.value 문자열)
    metrics: Dict[str, float] = Field(default_factory=dict)

    scope: MetricsScope = MetricsScope.SINCE_PUBLISH
    content_kind: ContentKind = ContentKind.UNKNOWN
    mapping_version: int = 1             # 어댑터 매핑 규칙 버전
    raw: Dict[str, Any] = Field(default_factory=dict)  # 플랫폼 원시 응답 보관
    warnings: list[str] = Field(default_factory=list)
    source: InsightSource = InsightSource.WEBHOOK
    ingest_key: Optional[str] = None

    # 키를 KPIKey로 강제/정규화
    @field_validator("metrics")
    @classmethod
    def normalize_kpi_keys(cls, v: Dict[str, float]) -> Dict[str, float]:
        norm: Dict[str, float] = {}
        for k, val in (v or {}).items():
            try:
                kk = KPIKey(k).value  # 이미 KPIKey면 그대로, alias 문자면 Enum 에러
            except ValueError:
                # 자주 쓰는 alias 매핑(필요시 확장)
                alias = {
                    "engagement_rate": KPIKey.ER.value,
                    "er": KPIKey.ER.value,
                    "imps": KPIKey.IMPRESSIONS.value,
                    "linkClicks": KPIKey.LINK_CLICKS.value,
                    "profileViews": KPIKey.PROFILE_VISITS.value,
                    "reposts": KPIKey.SHARES.value,
                    "retweets": KPIKey.SHARES.value,
                    "favorites": KPIKey.SAVES.value,
                    "saves_count": KPIKey.SAVES.value,
                    "likes_count": KPIKey.LIKES.value,
                    "comments_count": KPIKey.COMMENTS.value,
                }
                if k in alias:
                    kk = alias[k]
                else:
                    # 모르는 키는 버리지 않고 raw 쪽에만 두고, 표준 metrics에서는 무시
                    continue
            # float 캐스팅은 호출측에서 보장하되, 혹시 모르면 best-effort
            try:
                norm[kk] = float(val)
            except Exception:
                continue
        return norm

class InsightOut(InsightIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ingested_at: datetime


class InsightCommentIn(BaseModel):
    owner_user_id: Optional[int] = None
    post_publication_id: Optional[int] = None
    platform: PlatformKind
    platform_post_id: Optional[str] = None
    account_persona_id: Optional[int] = None
    comment_external_id: str
    parent_external_id: Optional[str] = None
    author_id: Optional[str] = None
    author_username: Optional[str] = None
    text: Optional[str] = None
    permalink: Optional[str] = None
    comment_created_at: Optional[datetime] = None
    metrics: Dict[str, float] = Field(default_factory=dict)
    raw: Dict[str, Any] = Field(default_factory=dict)


class InsightCommentOut(InsightCommentIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ingested_at: datetime


class InsightCommentList(BaseModel):
    comments: List[InsightCommentOut]
    total: int
    has_more: bool = False

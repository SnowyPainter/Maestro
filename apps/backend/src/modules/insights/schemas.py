# src/modules/insights/schemas.py
from __future__ import annotations
from datetime import datetime
from typing import Optional, Dict, Literal
from pydantic import BaseModel, Field, ConfigDict
from apps.backend.src.modules.common.enums import PlatformKind

class InsightIn(BaseModel):
    owner_user_id: int
    draft_id: Optional[int] = None
    published_post_id: Optional[int] = None
    platform: PlatformKind
    platform_post_id: Optional[str] = None
    account_persona_id: Optional[int] = None
    ts: datetime
    metrics: Dict[str, float] = Field(default_factory=dict)
    source: Literal["webhook", "poll", "manual"] = "webhook"
    ingest_key: Optional[str] = None

class InsightOut(InsightIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ingested_at: datetime

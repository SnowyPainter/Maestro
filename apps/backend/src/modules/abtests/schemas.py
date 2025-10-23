from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from apps.backend.src.modules.abtests.models import ABTestWinner
from apps.backend.src.modules.insights.schemas import InsightCommentOut


class ABTestWinnerEnum(str, Enum):
    VARIANT_A = ABTestWinner.VARIANT_A.value
    VARIANT_B = ABTestWinner.VARIANT_B.value


class ABTestCreate(BaseModel):
    persona_id: int
    campaign_id: int
    variable: str = Field(max_length=50)
    hypothesis: Optional[str] = Field(default=None, max_length=255)
    variant_a_id: int
    variant_b_id: int
    started_at: Optional[datetime] = None
    notes: Optional[str] = Field(default=None, max_length=500)


class ABTestComplete(BaseModel):
    winner_variant: ABTestWinnerEnum
    uplift_percentage: Optional[float] = None
    finished_at: Optional[datetime] = None
    insight_note: Optional[str] = Field(
        default=None,
        description="Playbook 로그에 남길 핵심 인사이트 요약",
        max_length=500,
    )


class ABTestUpdate(BaseModel):
    variable: Optional[str] = Field(default=None, max_length=50)
    hypothesis: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = Field(default=None, max_length=500)
    started_at: Optional[datetime] = None


class ABTestFilter(BaseModel):
    persona_id: Optional[int] = None
    campaign_id: Optional[int] = None
    active_only: bool = False


class ABTestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    persona_id: int
    campaign_id: int
    variable: str
    hypothesis: Optional[str] = None
    variant_a_id: int
    variant_b_id: int
    started_at: datetime
    finished_at: Optional[datetime] = None
    winner_variant: Optional[str] = None
    uplift_percentage: Optional[float] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    insights: Optional["ABTestInsightSummary"] = None


class ABTestListResponse(BaseModel):
    items: list[ABTestOut]
    total: int


class ABTestVariantInsight(BaseModel):
    variant_id: int
    post_publication_ids: List[int] = Field(default_factory=list)
    latest_sample_at: Optional[datetime] = None
    metrics: Dict[str, float] = Field(default_factory=dict)
    comments: List[InsightCommentOut] = Field(default_factory=list)


class ABTestInsightSummary(BaseModel):
    variant_a: ABTestVariantInsight
    variant_b: ABTestVariantInsight
    decision_metric: Optional[str] = None
    winner_variant: Optional[str] = None
    winner_value: Optional[float] = None
    loser_value: Optional[float] = None
    uplift_percentage: Optional[float] = None


class ABTestDetermineWinnerResult(BaseModel):
    abtest_id: int
    winner_variant: str
    decision_metric: str
    winner_value: Optional[float] = None
    loser_value: Optional[float] = None
    uplift_percentage: Optional[float] = None
    insight_note: Optional[str] = None
    finished_at: datetime


ABTestOut.model_rebuild()

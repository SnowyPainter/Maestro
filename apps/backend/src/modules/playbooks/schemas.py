from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Dict

from pydantic import BaseModel, ConfigDict, Field


class PlaybookAggregatePatch(BaseModel):
    aggregate_kpi: Optional[Dict[str, float]] = None
    best_time_window: Optional[str] = Field(
        default=None,
        max_length=40,
    )
    best_tone: Optional[str] = Field(
        default=None,
        max_length=40,
    )
    top_hashtags: Optional[List[str]] = None


class PlaybookEnsureRequest(BaseModel):
    persona_id: int
    campaign_id: int


class PlaybookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    persona_id: int
    campaign_id: int
    aggregate_kpi: Optional[Dict[str, float]] = None
    best_time_window: Optional[str] = None
    best_tone: Optional[str] = None
    top_hashtags: Optional[List[str]] = None
    last_event: Optional[str] = None
    last_updated: datetime
    created_at: datetime


class PlaybookLogCreate(BaseModel):
    persona_id: int
    campaign_id: int
    event: str = Field(max_length=50)
    timestamp: Optional[datetime] = None
    draft_id: Optional[int] = None
    schedule_id: Optional[int] = None
    abtest_id: Optional[int] = None
    ref_id: Optional[int] = None
    persona_snapshot: Optional[dict] = None
    trend_snapshot: Optional[dict] = None
    llm_input: Optional[dict] = None
    llm_output: Optional[dict] = None
    kpi_snapshot: Optional[dict] = None
    meta: Optional[dict] = None
    message: Optional[str] = Field(
        default=None,
        description="LLM/ABTest 결과에서 추출한 자연어 요약",
    )
    aggregate_patch: Optional[PlaybookAggregatePatch] = None


class PlaybookLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    playbook_id: int
    event: str
    timestamp: datetime
    draft_id: Optional[int] = None
    schedule_id: Optional[int] = None
    abtest_id: Optional[int] = None
    ref_id: Optional[int] = None
    persona_snapshot: Optional[dict] = None
    trend_snapshot: Optional[dict] = None
    llm_input: Optional[dict] = None
    llm_output: Optional[dict] = None
    kpi_snapshot: Optional[dict] = None
    meta: Optional[dict] = None
    message: Optional[str] = None
    created_at: datetime


class PlaybookLogsResponse(BaseModel):
    items: List[PlaybookLogOut]
    total: int

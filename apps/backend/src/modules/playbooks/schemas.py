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


class PlaybookEnrichedOut(PlaybookOut):
    """Enriched Playbook schema with campaign and persona names."""
    campaign_name: str
    campaign_description: Optional[str] = None
    persona_name: str
    persona_bio: Optional[str] = None


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


# Dashboard Schemas

class HourlyActivityItem(BaseModel):
    hour: str  # "00", "01", ..., "23"
    total: int
    sync_metrics: Optional[int] = 0
    schedule: Optional[int] = 0


class DashboardOverviewResponse(BaseModel):
    playbook_id: int
    total_logs: int
    success_rate: int  # percentage 0-100
    hourly_activity: List[HourlyActivityItem]


class EventTypeItem(BaseModel):
    name: str  # event type like "sync.metrics"
    value: int  # count


class DashboardEventChainResponse(BaseModel):
    playbook_id: int
    event_types: List[EventTypeItem]
    avg_sync_interval_seconds: float
    latest_kpi: Optional[Dict[str, float]] = None


class ActionStatsItem(BaseModel):
    total: int
    success: int
    rate: int  # percentage 0-100


class DashboardPerformanceResponse(BaseModel):
    playbook_id: int
    success_rate: int  # percentage 0-100
    failure_rate: int  # percentage 0-100
    action_stats: Dict[str, ActionStatsItem]  # {"ALERT": {...}, "REPLY": {...}, "DM": {...}}


class InsightsMetrics(BaseModel):
    engagement_improvement: int  # percentage
    optimal_time: str  # "22시"
    consistency_score: int  # percentage
    response_time_reduction: Optional[int] = None  # percentage (for manager)
    automation_rate: Optional[int] = None  # percentage (for manager)
    monitoring_coverage: Optional[int] = None  # percentage (for manager)
    policy_compliance: Optional[int] = None  # percentage (for brand)
    tone_consistency: Optional[int] = None  # percentage (for brand)
    quality_assurance: Optional[int] = None  # percentage (for brand)


class OverallROI(BaseModel):
    response_time_improvement: int  # percentage
    engagement_increase: int  # percentage


class DashboardInsightsResponse(BaseModel):
    playbook_id: int
    persona_name: str
    creator: InsightsMetrics
    manager: InsightsMetrics
    brand: InsightsMetrics
    overall_roi: OverallROI


class PhaseItem(BaseModel):
    id: int
    title: str
    status: str  # "completed", "in_progress", "planned"
    progress: int  # percentage 0-100
    features: List[str]


class DashboardRecommendationsResponse(BaseModel):
    playbook_id: int
    phases: List[PhaseItem]
    overall_roi: OverallROI
    dynamic_recommendations: List[str]


class MetricCorrelationItem(BaseModel):
    metric: str
    correlation: Optional[float] = None
    direction: str = "neutral"
    strength: str = "insufficient"
    sample_size: int = 0


class TrendCorrelationMetricInsight(BaseModel):
    metric: str
    average_value: float
    correlation: Optional[float] = None
    direction: str = "neutral"
    strength: str = "insufficient"


class TrendCorrelationItem(BaseModel):
    trend_title: str
    avg_rank: Optional[float] = None
    sample_size: int = 0
    metrics: List[TrendCorrelationMetricInsight] = Field(default_factory=list)
    latest_seen_at: Optional[datetime] = None


class TrendCountryInsight(BaseModel):
    country: str
    sample_size: int = 0
    avg_metrics: Dict[str, float] = Field(default_factory=dict)


class DashboardTrendCorrelationResponse(BaseModel):
    playbook_id: int
    total_samples: int = 0
    metric_correlations: List[MetricCorrelationItem] = Field(default_factory=list)
    top_trends: List[TrendCorrelationItem] = Field(default_factory=list)
    country_insights: List[TrendCountryInsight] = Field(default_factory=list)

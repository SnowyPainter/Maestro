from __future__ import annotations
from enum import Enum
from typing import Any, Dict, List, Optional, Type, Set
from pydantic import BaseModel, Field
from apps.backend.src.modules.drafts.schemas import DraftIR
from apps.backend.src.modules.trends.schemas import TrendItem
from apps.backend.src.modules.insights.schemas import InsightCommentOut


# --- Prompt & Context ---

class PromptKey(str, Enum):
    HASHTAG_FROM_TREND = "hashtag.from_trend" # 트렌드데이터를 바탕으로 해시태그 추천
    GUIDANCE_FROM_TREND = "guidance.from_trend" # 트렌드데이터를 바탕으로 글 작성 지침 추천
    DRAFT_FROM_TREND = "draft.from_trend" # 트렌드데이터를 바탕으로 글 작성
    DRAFT_FROM_COMMENT = "draft.from_comment" # 댓글데이터를 바탕으로 글 작성
    COWORKER_CONTEXTUAL_WRITE = "coworker.contextual.write"


class PromptVars(BaseModel):
    trend_data: Optional[List[TrendItem]] = None
    comment_data: Optional[List[InsightCommentOut]] = None
    product_name: Optional[str] = None
    audience: Optional[str] = None
    tone: Optional[str] = None
    goal: Optional[str] = None #플랫폼에 따라 goal 지정
    text: Optional[str] = None #세부적인 지침
    persona_brief: Optional[Dict[str, Any]] = None
    campaign_brief: Optional[Dict[str, Any]] = None
    playbook_summary: Optional[Dict[str, Any]] = None
    recent_publications: Optional[List[Dict[str, Any]]] = None

class PromptMetadata(BaseModel):
    """프롬프트 템플릿의 메타데이터"""
    key: PromptKey
    required_vars: Set[str] = Field(default_factory=set)  # 필수 변수들
    optional_vars: Set[str] = Field(default_factory=set)  # 선택적 변수들
    output_schema: Type[BaseModel]  # 출력 스키마 클래스
    description: Optional[str] = None  # 설명
    version: Optional[str] = None  # 버전 (향후 확장용)


class LlmInvokeContext(BaseModel):
    request_id: Optional[str] = None
    user_id: Optional[str] = None
    account_id: Optional[str] = None
    endpoint: Optional[str] = None
    action: Optional[str] = None
    trace_parent: Optional[str] = None
    idempotency_key: Optional[str] = None


# --- Output Schemas (JSON only) ---

class HashtagFromTrendOutput(BaseModel):
    hashtags: List[str]

class GuidanceFromTrendOutput(BaseModel):
    guidelines: List[str]
    key_points: List[str]
    tone_suggestions: List[str]
    hashtags: List[str]
    examples: List[str] = Field(default_factory=list)

class DraftFromTrendOutput(BaseModel):
    draft_ir: DraftIR

class DraftFromCommentOutput(BaseModel):
    draft_ir: DraftIR

class CoworkerContextualWriteOutput(BaseModel):
    text: str

PROMPT_OUTPUT_SCHEMA: Dict[PromptKey, Type[BaseModel]] = {
    PromptKey.HASHTAG_FROM_TREND: HashtagFromTrendOutput,
    PromptKey.GUIDANCE_FROM_TREND: GuidanceFromTrendOutput,
    PromptKey.DRAFT_FROM_TREND: DraftFromTrendOutput,
    PromptKey.DRAFT_FROM_COMMENT: DraftFromCommentOutput,
    PromptKey.COWORKER_CONTEXTUAL_WRITE: CoworkerContextualWriteOutput,
}

# 프롬프트 메타데이터 레지스트리
PROMPT_METADATA_REGISTRY: Dict[PromptKey, PromptMetadata] = {
    PromptKey.HASHTAG_FROM_TREND: PromptMetadata(
        key=PromptKey.HASHTAG_FROM_TREND,
        required_vars={"trend_data"},
        optional_vars={"product_name", "audience", "tone", "goal", "text"},
        output_schema=HashtagFromTrendOutput,
        description="트렌드데이터를 바탕으로 해시태그 추천"
    ),
    PromptKey.GUIDANCE_FROM_TREND: PromptMetadata(
        key=PromptKey.GUIDANCE_FROM_TREND,
        required_vars={"trend_data"},
        optional_vars={"product_name", "audience", "tone", "goal", "text"},
        output_schema=GuidanceFromTrendOutput,
        description="트렌드데이터를 바탕으로 글 작성 지침 추천"
    ),
    PromptKey.DRAFT_FROM_TREND: PromptMetadata(
        key=PromptKey.DRAFT_FROM_TREND,
        required_vars={"trend_data"},
        optional_vars={"product_name", "audience", "tone", "goal", "text", "persona_brief"},
        output_schema=DraftFromTrendOutput,
        description="트렌드데이터를 바탕으로 글 작성"
    ),
    PromptKey.DRAFT_FROM_COMMENT: PromptMetadata(
        key=PromptKey.DRAFT_FROM_COMMENT,
        required_vars={"comment_data", "persona_brief"},
        optional_vars={"product_name", "audience", "tone", "goal", "text"},
        output_schema=DraftFromCommentOutput,
        description="댓글데이터를 바탕으로 글 작성"
    ),
    PromptKey.COWORKER_CONTEXTUAL_WRITE: PromptMetadata(
        key=PromptKey.COWORKER_CONTEXTUAL_WRITE,
        required_vars={"text"},
        optional_vars={"persona_brief", "campaign_brief", "playbook_summary", "recent_publications", "tone", "goal"},
        output_schema=CoworkerContextualWriteOutput,
        description="컨텍스트(페르소나/캠페인/플레이북)를 반영한 카피 작성"
    ),
}

class LlmResult(BaseModel):
    """서비스 반환 표준 JSON (항상 JSON)"""
    data: Dict[str, Any]                   # 파싱된 본문(JSON)
    model: str                             # 실제 사용 모델
    tokens_prompt: Optional[int] = None
    tokens_completion: Optional[int] = None
    cost_usd: Optional[float] = None
    latency_ms: Optional[int] = None
    meta: Dict[str, Any] = Field(default_factory=dict)

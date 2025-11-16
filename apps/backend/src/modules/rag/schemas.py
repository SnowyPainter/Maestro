from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Set
from uuid import UUID

from pydantic import BaseModel, Field


RagSearchMode = Literal["default", "quickstart", "memory", "next_action"]


class RagPersonaContext(BaseModel):
    persona_id: Optional[int] = None
    persona_name: Optional[str] = None
    campaign_id: Optional[int] = None
    campaign_name: Optional[str] = None


class RagRelatedEdge(BaseModel):
    dst_node_id: UUID
    edge_type: str
    meta: Dict[str, Any] = Field(default_factory=dict)
    node_type: Optional[str] = None
    title: Optional[str] = None
    summary: Optional[str] = None
    node_meta: Dict[str, Any] = Field(default_factory=dict)


class RagSearchItem(BaseModel):
    node_id: UUID
    node_type: str
    title: Optional[str] = None
    summary: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)
    source_table: Optional[str] = None
    source_id: Optional[str] = None
    score: float
    chunks: List[str] = Field(default_factory=list)
    related: List[RagRelatedEdge] = Field(default_factory=list)

    def to_prompt_payload(self) -> Dict[str, Any]:
        return {
            "header": self.title or self.summary,
            "score": self.score,
            "summary": self.summary,
            "chunks": self.chunks,
            "metadata": self.meta,
            "node_type": self.node_type,
            "source_ref": {
                "table": self.source_table,
                "id": self.source_id,
            },
            "related": [edge.model_dump() for edge in self.related],
        }


class RagQuickstartTemplate(BaseModel):
    title: str
    query: str
    description: Optional[str] = None
    persona: Optional[RagPersonaContext] = None
    source_node_id: Optional[UUID] = None


class RagMemoryHighlight(BaseModel):
    playbook_id: Optional[int] = None
    persona: Optional[RagPersonaContext] = None
    node_id: Optional[UUID] = None
    title: Optional[str] = None
    summary: Optional[str] = None
    reuse_count: int = 0
    last_used_at: Optional[datetime] = None
    reasons: List[str] = Field(default_factory=list)


class RagNextActionProposal(BaseModel):
    playbook_id: Optional[int] = None
    persona: Optional[RagPersonaContext] = None
    title: str
    action: str
    confidence: float = 0.5
    suggested_at: Optional[datetime] = None
    meta: Dict[str, Any] = Field(default_factory=dict)


class RagValueInsight(BaseModel):
    persona: Optional[RagPersonaContext] = None
    memory_reuse_count: int = 0
    automated_decisions: int = 0
    saved_minutes: int = 0
    ai_intervention_rate: float = 0.0


class RagSearchResponse(BaseModel):
    items: List[RagSearchItem] = Field(default_factory=list)
    quickstart: List[RagQuickstartTemplate] = Field(default_factory=list)
    memory_highlights: List[RagMemoryHighlight] = Field(default_factory=list)
    next_actions: List[RagNextActionProposal] = Field(default_factory=list)
    roi: Optional[RagValueInsight] = None


class RagExpandResponse(BaseModel):
    items: List[RagRelatedEdge] = Field(default_factory=list)


class GraphRagActionCard(BaseModel):
    id: str
    category: str
    title: str
    description: Optional[str] = None
    persona: Optional[RagPersonaContext] = None
    cta_label: str = "Open"
    operator_key: Optional[str] = None
    operator_payload: Dict[str, Any] = Field(default_factory=dict)
    flow_path: Optional[str] = None
    source_node_id: Optional[UUID] = None
    priority: int = 0
    confidence: Optional[float] = None
    meta: Dict[str, Any] = Field(default_factory=dict)


class GraphRagActionList(BaseModel):
    cards: List[GraphRagActionCard] = Field(default_factory=list)


class GraphRagActionContext(BaseModel):
    owner_user_id: int
    persona_id: Optional[int] = None
    campaign_id: Optional[int] = None
    persona: Optional[RagPersonaContext] = None
    query: str
    mode: RagSearchMode
    sections: List[str] = Field(default_factory=list)
    limit: int = 6
    response: RagSearchResponse
    completed_node_ids: Set[str] = Field(default_factory=set)
    completed_playbook_ids: Set[int] = Field(default_factory=set)
    completed_action_signatures: Set[str] = Field(default_factory=set)


class GraphRagSuggestionResponse(BaseModel):
    persona: Optional[RagPersonaContext] = None
    cards: List[GraphRagActionCard] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    roi: Optional[RagValueInsight] = None


class GraphRagTrendActionCommand(BaseModel):
    persona_id: Optional[int] = None
    campaign_id: Optional[int] = None
    query: str
    title: str
    description: Optional[str] = None
    source_node_id: Optional[UUID] = None


class GraphRagNextActionCommand(BaseModel):
    persona_id: Optional[int] = None
    campaign_id: Optional[int] = None
    playbook_id: Optional[int] = None
    title: str
    action: str
    source_node_id: Optional[UUID] = None
    confidence: Optional[float] = None


class GraphRagPlaybookActionCommand(BaseModel):
    persona_id: Optional[int] = None
    campaign_id: Optional[int] = None
    playbook_id: Optional[int] = None
    title: Optional[str] = None
    summary: Optional[str] = None
    node_id: Optional[UUID] = None
    reuse_count: Optional[int] = None


GraphRagActionIntent = Literal[
    "trend_followup",
    "next_action",
    "playbook_reuse",
    "other",
]


class GraphRagActionAudit(BaseModel):
    llm_model: Optional[str] = None
    llm_usage_id: Optional[str] = None
    tokens_prompt: Optional[int] = None
    tokens_completion: Optional[int] = None
    cost_usd: Optional[float] = None
    latency_ms: Optional[int] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class GraphRagActionResult(BaseModel):
    status: str
    message: str
    meta: Dict[str, Any] = Field(default_factory=dict)
    intent: Optional[GraphRagActionIntent] = None
    action_key: Optional[str] = None
    inputs: Dict[str, Any] = Field(default_factory=dict)
    outputs: Dict[str, Any] = Field(default_factory=dict)
    reason: Optional[str] = None
    confidence: Optional[float] = None
    timing_ms: Optional[int] = None
    refresh: List[str] = Field(default_factory=list)
    audit: Optional[GraphRagActionAudit] = None
    dedupe_signature: Optional[str] = None

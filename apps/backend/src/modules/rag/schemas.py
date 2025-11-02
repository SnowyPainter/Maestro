from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class RagRelatedEdge(BaseModel):
    dst_node_id: UUID
    edge_type: str
    meta: Dict[str, Any] = Field(default_factory=dict)


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


class RagSearchResponse(BaseModel):
    items: List[RagSearchItem] = Field(default_factory=list)

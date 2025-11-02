from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping, Optional, Sequence


@dataclass(frozen=True, slots=True)
class NodeReference:
    node_type: str
    source_table: str
    source_id: str


@dataclass(frozen=True, slots=True)
class EdgeReference:
    src: NodeReference
    dst: NodeReference
    edge_type: str
    weight: Optional[float] = None
    meta: Optional[Mapping[str, Any]] = None


@dataclass(slots=True)
class CanonicalPayload:
    node_type: str
    source_table: str
    source_id: str
    title: Optional[str]
    summary: str
    body_sections: Sequence[str]
    meta: Mapping[str, Any]
    owner_user_id: Optional[int] = None
    persona_id: Optional[int] = None
    campaign_id: Optional[int] = None
    embedding_provider: str = "tei"
    embedding_model: str = "multilingual-e5-base"
    signature_extras: Mapping[str, Any] = field(default_factory=dict)
    edges: Sequence[EdgeReference] = field(default_factory=tuple)

    def texts_for_embedding(self) -> list[str]:
        texts: list[str] = []
        if self.summary:
            texts.append(self.summary)
        for section in self.body_sections:
            if section:
                texts.append(section)
        return texts

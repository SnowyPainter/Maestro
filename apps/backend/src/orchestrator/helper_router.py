"""Helper endpoints powering chat-level UX features."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from .slot_mentions import SlotHint, filter_slot_hints


router = APIRouter(prefix="/helpers", tags=["helpers"])


class SlotHintItem(BaseModel):
    name: str
    label: str
    description: str = ""
    value_type: str = "string"
    choices: List[str] = Field(default_factory=list)
    synonyms: List[str] = Field(default_factory=list)
    flows: List[str] = Field(default_factory=list)

    @classmethod
    def from_hint(cls, hint: SlotHint) -> "SlotHintItem":
        return cls(
            name=hint.name,
            label=hint.label,
            description=hint.description,
            value_type=hint.value_type,
            choices=list(hint.choices),
            synonyms=list(hint.synonyms),
            flows=list(hint.flows),
        )


@router.get("/slot-hints", response_model=List[SlotHintItem])
async def list_slot_hints(
    query: Optional[str] = Query(default=None, description="Filter hints by name or label"),
    flow: Optional[str] = Query(default=None, description="Filter hints relevant to a specific flow key"),
    limit: int = Query(default=10, ge=1, le=50, description="Maximum number of hints to return"),
) -> List[SlotHintItem]:
    hints = filter_slot_hints(query=query, flow=flow, limit=limit)
    return [SlotHintItem.from_hint(hint) for hint in hints]


__all__ = ["router"]

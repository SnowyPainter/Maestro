from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, Tuple, Iterable
from pydantic import BaseModel, Field, ConfigDict

class TimelineEvent(BaseModel):
    """Normalized representation for a single timeline datapoint."""

    model_config = ConfigDict(extra="allow")

    event_id: str
    persona_account_id: int
    source: str
    kind: str
    timestamp: datetime
    status: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    operators: Tuple[str, ...] = Field(default_factory=tuple)
    correlation_keys: Dict[str, str] = Field(default_factory=dict)
    origin_flow: Optional[str] = None


class TimelineEventCollection(BaseModel):
    """Container returned by source-specific timeline operators."""
    source: str
    events: List[TimelineEvent] = Field(default_factory=list)

    def extend(self, events: Sequence[TimelineEvent]) -> None:
        if not events:
            return
        self.events.extend(events)

    def merged(
        self,
        *others: Iterable[TimelineEvent],
        sort: bool = True,
        deduplicate: bool = True,
    ) -> "TimelineEventCollection":
        aggregated: List[TimelineEvent] = list(self.events)
        seen: set[str] = set()
        if deduplicate:
            seen = {event.event_id for event in aggregated}
        for other in others:
            if other is None:
                continue
            for event in other:
                if deduplicate and event.event_id in seen:
                    continue
                aggregated.append(event)
                if deduplicate:
                    seen.add(event.event_id)
        if sort:
            aggregated.sort(key=lambda item: (item.timestamp, item.event_id))
        return TimelineEventCollection(source=self.source, events=aggregated)

class TimelineQueryPayload(BaseModel):
    """Common payload for timeline BFF flows."""
    persona_account_id: int
    since: Optional[datetime] = None
    until: Optional[datetime] = None
    limit: Optional[int] = Field(default=200, ge=1, le=2000)
    events: Optional[TimelineEventCollection] = Field(default=None, exclude=False)

class TimelineEventCollectionOut(TimelineEventCollection):
    """Flow result that preserves payload info and emits merged events."""
    payload: Dict[str, Any] = Field(default_factory=dict)
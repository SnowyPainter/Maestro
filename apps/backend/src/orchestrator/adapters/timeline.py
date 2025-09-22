"""Timeline-related adapters for flow chaining."""

from typing import Any, Dict, Iterable, List, Mapping

from apps.backend.src.orchestrator.adapters.utils import _coerce_timeline_collection

from apps.backend.src.modules.timeline.schemas import (
    TimelineEvent,
    TimelineEventCollection,
    TimelineQueryPayload,
    TimelineEventCollectionOut
)

def normalize_timeline_collection(value: Any) -> TimelineEventCollection:
    return _coerce_timeline_collection(value)


def ensure_timeline_result(value: Any) -> TimelineEventCollectionOut:
    if isinstance(value, TimelineEventCollectionOut):
        return value
    if isinstance(value, Mapping):
        return TimelineEventCollectionOut.model_validate(value)
    raise TypeError("Unsupported timeline result payload type")


def compose_timeline_collections(
    pieces: Iterable[Any],
    *,
    sort: bool = True,
    deduplicate: bool = True,
    source: str = "composed",
) -> TimelineEventCollection:
    collected: List[TimelineEvent] = []
    seen: set[str] = set()
    for piece in pieces:
        collection = _coerce_timeline_collection(piece)
        for event in collection.events:
            if deduplicate and event.event_id in seen:
                continue
            collected.append(event)
            if deduplicate:
                seen.add(event.event_id)
    if sort:
        collected.sort(key=lambda item: (item.timestamp, item.event_id))
    return TimelineEventCollection(source=source, events=collected)


def timeline_result_adapter(source: Any, base_payload: Dict[str, Any]) -> Dict[str, Any]:
    """Adapt TimelineEventCollectionOut results into TimelineQueryPayload for chaining.

    This adapter enables chaining multiple timeline sources by accumulating
    TimelineEventCollectionOut results back into TimelineQueryPayload format.
    Each adapter call merges new timeline events with existing ones.

    Flow pattern:
    TimelineQueryPayload -> Timeline Source -> TimelineEventCollectionOut
    -> Adapter -> TimelineQueryPayload -> Next Timeline Source -> ...
    """
    result = ensure_timeline_result(source)
    payload = dict(base_payload)

    # Merge result payload fields (excluding events which are handled separately)
    for key, value in result.payload.items():
        payload.setdefault(key, value)

    # Accumulate timeline events from previous and current results
    existing_events = payload.get("events")
    combined = compose_timeline_collections([existing_events, result.events])
    payload["events"] = combined
    
    # Validate and return the accumulated TimelineQueryPayload
    validated_payload = TimelineQueryPayload.model_validate(payload)
    return validated_payload.model_dump()


__all__ = [
    "normalize_timeline_collection",
    "ensure_timeline_result",
    "compose_timeline_collections",
    "timeline_result_adapter",
]

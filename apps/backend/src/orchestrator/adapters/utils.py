"""Utility functions for adapters."""

from typing import Any, Iterable, Mapping, Sequence
from pydantic import ValidationError

from apps.backend.src.modules.trends.schemas import TrendsListResponse
from apps.backend.src.modules.timeline.schemas import (
    TimelineEvent,
    TimelineEventCollection,
    TimelineEventCollectionOut,
)

def _ensure_timeline_model(value: Any) -> TimelineEventCollectionOut:
    if isinstance(value, TimelineEventCollectionOut):
        return value
    if isinstance(value, Mapping):
        return TimelineEventCollectionOut.model_validate(value)
    raise TypeError("Unsupported timeline payload type")

def _ensure_trends_model(value: Any) -> TrendsListResponse:
    if isinstance(value, TrendsListResponse):
        return value
    if hasattr(value, "model_dump"):
        return TrendsListResponse.model_validate(value.model_dump())
    if isinstance(value, Mapping):
        return TrendsListResponse.model_validate(value)
    raise TypeError("Unsupported adapter payload type")


def _coerce_timeline_event(value: Any) -> TimelineEvent:
    if isinstance(value, TimelineEvent):
        return value
    if isinstance(value, Mapping):
        return TimelineEvent.model_validate(value)
    raise TypeError("Unsupported timeline event payload type")


def _coerce_timeline_collection(value: Any) -> TimelineEventCollection:
    if value is None:
        return TimelineEventCollection(source="empty")
    if isinstance(value, TimelineEventCollection):
        return value
    if isinstance(value, TimelineEvent):
        return TimelineEventCollection(source="single_event", events=[value])
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return TimelineEventCollection(source="sequence", events=[_coerce_timeline_event(item) for item in value])
    if isinstance(value, Mapping):
        try:
            return TimelineEventCollectionOut.model_validate(value)
        except ValidationError:
            try:
                return TimelineEventCollection.model_validate(value)
            except ValidationError as err:
                raise TypeError("Unsupported timeline events container") from err
        else:
            return result
    raise TypeError("Unsupported timeline events container")


__all__ = [
    "_ensure_trends_model",
    "_coerce_timeline_event",
    "_coerce_timeline_collection",
]

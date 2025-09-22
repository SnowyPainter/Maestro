"""Utility functions for adapters."""

from typing import Any, Iterable, Mapping, Sequence, Optional
from datetime import datetime, date, timezone, timedelta
from pydantic import ValidationError

from apps.backend.src.modules.trends.schemas import TrendsListResponse
from apps.backend.src.modules.timeline.schemas import (
    TimelineEvent,
    TimelineEventCollection,
    TimelineEventCollectionOut,
)


def safe_datetime_to_date(dt: Optional[datetime]) -> Optional[date]:
    """Convert datetime to date, handling both timezone-aware and timezone-naive datetimes.

    Args:
        dt: Datetime to convert, can be None, timezone-aware, or timezone-naive

    Returns:
        Date representation, or None if input is None
    """
    if dt is None:
        return None

    # If timezone-aware, convert to UTC then get date
    if dt.tzinfo is not None:
        return dt.astimezone().date()
    else:
        # Timezone-naive, get date directly
        return dt.date()

def to_aware_utc(v: datetime | date | None) -> datetime | None:
    if v is None:
        return None
    if isinstance(v, date) and not isinstance(v, datetime):
        # 날짜만 온 경우, 자정(00:00:00) UTC로 승격
        return datetime(v.year, v.month, v.day, tzinfo=timezone.utc)
    assert isinstance(v, datetime)
    # naive → UTC 고정, aware → UTC로 변환
    return v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v.astimezone(timezone.utc)

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

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)

__all__ = [
    "safe_datetime_to_date",    
    "to_aware_utc",
    "_utcnow",
    "_ensure_trends_model",
    "_coerce_timeline_event",
    "_coerce_timeline_collection",
]

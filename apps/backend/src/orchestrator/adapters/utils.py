"""Utility functions for adapters."""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timezone
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.core.db import SessionLocal as AsyncSessionLocal
from apps.backend.src.modules.accounts.models import Persona, PersonaAccount
from apps.backend.src.modules.drafts.schemas import DraftIR
from apps.backend.src.modules.insights.schemas import InsightCommentList
from apps.backend.src.modules.timeline.schemas import (
    TimelineEvent,
    TimelineEventCollection,
    TimelineEventCollectionOut,
)
from apps.backend.src.modules.trends.schemas import TrendItem, TrendsListResponse

logger = logging.getLogger(__name__)


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

def _ensure_draft_ir_props(value: DraftIR) -> DraftIR:
    # Normalize props for each block
    for block in value.blocks:
        if block.type == "text" and hasattr(block, "props") and isinstance(block.props, dict):
            # If any key like "text", replace with "markdown"
            keys_to_replace = [k for k in block.props if k == "text"]
            for k in keys_to_replace:
                block.props["markdown"] = block.props[k]
                del block.props[k]
            # Remove any keys with None value
            block.props = {k: v for k, v in block.props.items() if v is not None}
    return value


def _coerce_int(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _persona_to_brief(persona: Optional[Persona]) -> Optional[Dict[str, Any]]:
    if persona is None:
        return None
    return {
        "id": persona.id,
        "name": persona.name,
        "language": persona.language,
        "tone": persona.tone,
        "style_guide": persona.style_guide,
        "pillars": persona.pillars,
        "banned_words": persona.banned_words,
        "default_hashtags": persona.default_hashtags,
        "hashtag_rules": persona.hashtag_rules,
        "link_policy": persona.link_policy,
        "media_preferences": persona.media_prefs,
        "posting_windows": persona.posting_windows,
        "bio": persona.bio,
    }


async def _load_persona(
    session: AsyncSession,
    persona_id: Optional[int],
    persona_account_id: Optional[int],
) -> Optional[Persona]:
    persona: Optional[Persona] = None
    if persona_id is not None:
        persona = await session.get(Persona, persona_id)
        if persona is not None:
            return persona

    if persona_account_id is None:
        return None

    persona_account = await session.get(PersonaAccount, persona_account_id)
    if persona_account is None:
        return None
    return await session.get(Persona, persona_account.persona_id)


def _extract_persona_account_id(
    payload: Mapping[str, Any],
    comment_list: Optional[InsightCommentList] = None,
) -> Optional[int]:
    for key in ("persona_account_id", "account_persona_id"):
        value = _coerce_int(payload.get(key))
        if value is not None:
            return value

    if comment_list is None:
        return None

    for comment in getattr(comment_list, "comments", []) or []:
        value = _coerce_int(getattr(comment, "account_persona_id", None))
        if value is not None:
            return value
    return None


async def build_persona_brief(
    payload: Mapping[str, Any],
    comment_list: Optional[InsightCommentList] = None,
) -> Dict[str, Any]:
    existing = payload.get("persona_brief")
    if isinstance(existing, dict):
        return existing

    persona_account_id = _extract_persona_account_id(payload, comment_list)
    persona_id = _coerce_int(payload.get("persona_id"))

    if persona_account_id is None and persona_id is None:
        return {}

    try:
        async with AsyncSessionLocal() as session:
            persona = await _load_persona(session, persona_id, persona_account_id)
    except Exception:
        logger.exception(
            "failed to load persona brief",
            extra={"persona_id": persona_id, "persona_account_id": persona_account_id},
        )
        return {}

    return _persona_to_brief(persona) or {}


def _flatten_persona_values(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, Mapping):
        flattened: List[str] = []
        for item in value.values():
            flattened.extend(_flatten_persona_values(item))
        return flattened
    if isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray, str)):
        flattened: List[str] = []
        for item in value:
            flattened.extend(_flatten_persona_values(item))
        return flattened
    return [str(value)]


def _tokenize_keywords(text: str) -> List[str]:
    return [token.lower() for token in re.findall(r"[0-9A-Za-z가-힣]+", text) if len(token) > 2]


def _extract_persona_keywords(persona_brief: Mapping[str, Any]) -> List[str]:
    keyword_fields = (
        "pillars",
        "default_hashtags",
        "tone",
        "style_guide",
        "bio",
        "name",
    )
    values: List[str] = []
    for field in keyword_fields:
        values.extend(_flatten_persona_values(persona_brief.get(field)))

    keywords = []
    for value in values:
        keywords.extend(_tokenize_keywords(value))
    # Deduplicate while preserving order
    seen: set[str] = set()
    unique_keywords: List[str] = []
    for keyword in keywords:
        if keyword not in seen:
            seen.add(keyword)
            unique_keywords.append(keyword)
    return unique_keywords


def _trend_text_blob(trend: TrendItem) -> str:
    parts = [trend.title or ""]
    description = getattr(trend, "description", None)
    if isinstance(description, str):
        parts.append(description)

    for news in trend.news_items or []:
        if news.news_item_title:
            parts.append(news.news_item_title)
        if news.news_item_source:
            parts.append(news.news_item_source)

    return " ".join(part for part in parts if part).lower()


def _parse_approx_traffic(traffic: Optional[str]) -> float:
    if not traffic:
        return 0.0
    digits = "".join(ch for ch in traffic if ch.isdigit())
    if not digits:
        return 0.0
    try:
        return float(digits)
    except ValueError:
        return 0.0


def _score_trend_for_persona(trend: TrendItem, persona_keywords: List[str]) -> float:
    text_blob = _trend_text_blob(trend)
    keyword_score = 0.0
    if persona_keywords:
        matches = sum(1 for keyword in persona_keywords if keyword in text_blob)
        keyword_score = matches * 50.0

    rank_bonus = max(0.0, 150.0 - float(getattr(trend, "rank", 100)))
    traffic_bonus = _parse_approx_traffic(trend.approx_traffic) / 10.0
    return keyword_score + rank_bonus + traffic_bonus


def select_persona_aligned_trend(
    trends: Sequence[TrendItem],
    persona_brief: Optional[Mapping[str, Any]] = None,
) -> TrendItem:
    trend_list = list(trends)
    if not trend_list:
        raise ValueError("No trend items available to select")

    persona_keywords = _extract_persona_keywords(persona_brief or {})

    def _sort_key(trend: TrendItem) -> tuple[float, float]:
        score = _score_trend_for_persona(trend, persona_keywords)
        rank = getattr(trend, "rank", 1000) or 1000
        return (score, -float(rank))

    selected = max(trend_list, key=_sort_key)
    logger.debug(
        "selected persona-aligned trend",
        extra={
            "trend_title": selected.title,
            "trend_rank": getattr(selected, "rank", None),
            "persona_keywords": persona_keywords,
        },
    )
    return selected


__all__ = [
    "safe_datetime_to_date",
    "to_aware_utc",
    "_utcnow",
    "_ensure_trends_model",
    "_coerce_timeline_event",
    "_coerce_timeline_collection",
    "_ensure_draft_ir_props",
    "build_persona_brief",
    "select_persona_aligned_trend",
]

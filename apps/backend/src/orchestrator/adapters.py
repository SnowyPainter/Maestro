"""Adapters that bridge outputs from one flow to the payload of another."""

from __future__ import annotations

from typing import Any, Callable, Dict, Mapping, Tuple

from apps.backend.src.modules.drafts.schemas import DraftSaveRequest
from apps.backend.src.modules.trends.schemas import TrendItem, TrendsListResponse


def _ensure_trends_model(value: Any) -> TrendsListResponse:
    if isinstance(value, TrendsListResponse):
        return value
    if hasattr(value, "model_dump"):
        return TrendsListResponse.model_validate(value.model_dump())
    if isinstance(value, Mapping):
        return TrendsListResponse.model_validate(value)
    raise TypeError("Unsupported adapter payload type")


def trends_to_draft_adapter(source: Any, base_payload: Dict[str, Any]) -> DraftSaveRequest:
    """Convert trend research output into a draft payload."""

    trends = _ensure_trends_model(source)

    items = list(trends.items or [])[:5]
    if not items:
        raise ValueError("No trend items available to build draft content")

    lines = ["## Trend Highlights"]
    for idx, item in enumerate(items, start=1):
        lines.extend(_format_trend_line(idx, item))

    markdown = "\n".join(lines)
    payload = dict(base_payload)
    payload.setdefault("title", f"{trends.country} trend recap")
    payload["ir"] = {
        "blocks": [
            {
                "type": "text",
                "props": {
                    "markdown": markdown,
                },
            }
        ],
        "options": {},
    }

    # Validate payload through the target schema to ensure shape correctness.
    DraftSaveRequest.model_validate(payload)
    return payload


def _format_trend_line(idx: int, trend: TrendItem) -> list[str]:
    line = f"{idx}. **{trend.title}**"
    details = []
    if trend.approx_traffic:
        details.append(f"traffic {trend.approx_traffic}")
    if trend.pubDate:
        details.append(f"updated {trend.pubDate}")
    if details:
        line += f" ({', '.join(details)})"

    extra_lines = [line]
    news = trend.news_items or []
    if news:
        headline = news[0].news_item_title or news[0].news_item_source or "Related story"
        extra_lines.append(f"   - {headline}")
    return extra_lines


PayloadAdapter = Callable[[Any, Dict[str, Any]], Dict[str, Any]]


FLOW_ADAPTERS: Dict[Tuple[str, str], PayloadAdapter] = {
    ("bff.trends.list_trends", "drafts.create"): trends_to_draft_adapter,
}


__all__ = ["FLOW_ADAPTERS", "PayloadAdapter", "trends_to_draft_adapter"]

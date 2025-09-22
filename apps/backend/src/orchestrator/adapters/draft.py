"""Draft-related adapters for flow chaining."""

from typing import Any, Dict, List

from apps.backend.src.modules.drafts.schemas import DraftSaveRequest
from apps.backend.src.modules.trends.schemas import TrendItem, TrendsListResponse
from apps.backend.src.orchestrator.adapters.utils import _ensure_trends_model


def trends_to_draft_adapter(source: Any, base_payload: Dict[str, Any]) -> DraftSaveRequest:
    """Convert trend research output into a draft payload."""

    trends: TrendsListResponse = _ensure_trends_model(source)

    items = list(trends.items or [])[:5]
    if not items:
        raise ValueError("No trend items available to build draft content")

    payload = dict(base_payload)
    payload["title"] = f"{trends.country} trend recap"

    blocks = []

    # 각 트렌드 아이템에 대해 블록 생성
    for idx, trend in enumerate(items, 1):
        # 트렌드 텍스트 블록 추가
        trend_lines = _format_trend_line(idx, trend)
        markdown = "\n".join(trend_lines)
        blocks.append({
            "type": "text",
            "props": {
                "markdown": markdown,
            },
        })

        # 트렌드에 대표 이미지가 있으면 이미지 블록 추가
        if trend.picture:
            blocks.append({
                "type": "image",
                "props": {
                    "url": trend.picture,
                    "alt": f"{trend.title} trend image",
                },
            })

        # 뉴스 아이템이 있고 이미지가 있으면 추가 이미지 블록
        news_items = trend.news_items or []
        for news in news_items[:1]:  # 최대 1개의 뉴스 이미지만
            if news.news_item_picture:
                blocks.append({
                    "type": "image",
                    "props": {
                        "url": news.news_item_picture,
                        "alt": news.news_item_title or f"News image for {trend.title}",
                    },
                })

    payload["ir"] = {
        "blocks": blocks,
        "options": {},
    }

    # Validate payload through the target schema to ensure shape correctness.
    DraftSaveRequest.model_validate(payload)
    return payload


def _format_trend_line(idx: int, trend: TrendItem) -> list[str]:
    line = f"{idx}. {trend.title}"
    details = []
    if trend.approx_traffic:
        details.append(f"traffic {trend.approx_traffic}")
    if trend.pub_date:
        details.append(f"updated {trend.pub_date}")
    if details:
        line += f" ({', '.join(details)})"

    extra_lines = [line]
    news = trend.news_items or []
    if news:
        headline = news[0].news_item_title or news[0].news_item_source or "Related story"
        extra_lines.append(f"   - {headline}")
    return extra_lines


__all__ = ["trends_to_draft_adapter"]

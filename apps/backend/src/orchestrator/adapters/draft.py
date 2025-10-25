"""Draft-related adapters for flow chaining."""

from __future__ import annotations

from typing import Any, Dict, Mapping, Optional

from apps.backend.src.modules.drafts.schemas import DraftIR, DraftSaveRequest
from apps.backend.src.modules.llm.schemas import DraftFromTrendOutput, LlmResult, PromptKey, PromptVars
from apps.backend.src.modules.llm.service import LLMService
from apps.backend.src.modules.trends.schemas import TrendItem, TrendsListResponse
from apps.backend.src.orchestrator.adapters.utils import (
    _ensure_draft_ir_props,
    _ensure_trends_model,
    build_persona_brief,
    select_persona_aligned_trend,
)

from apps.backend.src.core.logging import setup_logging
setup_logging()
import logging
logger = logging.getLogger(__name__)

def trends_to_draft_adapter(source: Any, base_payload: Dict[str, Any]) -> Any:
    """Convert trend research output into a draft payload, leveraging LLM when possible."""

    trends: TrendsListResponse = _ensure_trends_model(source)
    payload = _normalize_payload(base_payload)
    use_llm = payload.pop("_use_llm", True)

    logger.info(f"use_llm: {use_llm}")

    if use_llm:
        async def _invoke() -> DraftSaveRequest:
            llm_payload = await _draft_from_trends_llm(trends, payload)
            if llm_payload is not None:
                return llm_payload
            return _draft_from_trends_static(trends, payload)

        return _invoke()

    return _draft_from_trends_static(trends, payload)


def _normalize_payload(base_payload: Any) -> Dict[str, Any]:
    if base_payload is None:
        return {}
    if isinstance(base_payload, Mapping):
        return dict(base_payload)
    if hasattr(base_payload, "model_dump"):
        return base_payload.model_dump()  # type: ignore[attr-defined]
    if hasattr(base_payload, "dict"):
        return base_payload.dict()  # type: ignore[attr-defined]
    return dict(base_payload)


async def _draft_from_trends_llm(trends: TrendsListResponse, payload: Dict[str, Any]) -> Optional[DraftSaveRequest]:
    items = list(trends.items or [])
    if not items:
        return None

    persona_brief = await build_persona_brief(payload)
    try:
        selected_trend = select_persona_aligned_trend(items, persona_brief)
    except ValueError:
        return None

    logger.info(
        "selected trend for persona-aligned draft",
        extra={
            "trend_title": selected_trend.title,
            "trend_rank": getattr(selected_trend, "rank", None),
            "persona_id": payload.get("persona_id"),
        },
    )

    prompt_vars = PromptVars(
        trend_data=[selected_trend],
        product_name=payload.get("product_name", "not specified"),
        audience=payload.get("audience", "general"),
        tone=payload.get("tone", "casual"),
        goal=payload.get("goal", "social"),
        text=payload.get(
            "text",
            "Deliver a rich, story-driven draft that compares this trend to the persona's own hobbies or passions while staying practical.",
        ),
        persona_brief=persona_brief or {},
    )

    try:
        result_dict = await LLMService.instance().ainvoke(PromptKey.DRAFT_FROM_TREND, prompt_vars)
    except Exception as e:
        logger.info(f"Exception: {e}")
        return None

    if isinstance(result_dict, dict) and result_dict.get("error"):
        return None
    
    try:
        llm_result = LlmResult.model_validate(result_dict)
        logger.info(f"llm_result: {llm_result}")
        output = DraftFromTrendOutput.model_validate(llm_result.data)
        output.draft_ir = _ensure_draft_ir_props(output.draft_ir)
    except Exception as e:
        logger.info(f"Exception: {e}")
        return None

    logger.info(f"output: {output}")

    draft_ir = output.draft_ir
    final_payload: Dict[str, Any] = {}
    for key in ("campaign_id", "title", "tags", "goal"):
        if key in payload:
            final_payload[key] = payload[key]

    if not final_payload.get("title"):
        final_payload["title"] = _default_trend_title(trends)

    final_payload["ir"] = draft_ir.model_dump(mode="json")
    return DraftSaveRequest.model_validate(final_payload)


def _draft_from_trends_static(trends: TrendsListResponse, payload: Dict[str, Any]) -> DraftSaveRequest:
    items = list(trends.items or [])[:5]
    if not items:
        raise ValueError("No trend items available to build draft content")

    final_payload: Dict[str, Any] = {}
    for key in ("campaign_id", "title", "tags", "goal"):
        if key in payload:
            final_payload[key] = payload[key]

    final_payload["title"] = final_payload.get("title") or _default_trend_title(trends)

    blocks = []
    for idx, trend in enumerate(items, 1):
        trend_lines = _format_trend_line(idx, trend)
        blocks.append(
            {
                "type": "text",
                "props": {"markdown": "\n".join(trend_lines)},
            }
        )

        if trend.picture:
            blocks.append(
                {
                    "type": "image",
                    "props": {
                        "url": trend.picture,
                        "alt": f"{trend.title} trend image",
                    },
                }
            )

        news_items = trend.news_items or []
        for news in news_items[:1]:
            if news.news_item_picture:
                blocks.append(
                    {
                        "type": "image",
                        "props": {
                            "url": news.news_item_picture,
                            "alt": news.news_item_title or f"News image for {trend.title}",
                        },
                    }
                )

    final_payload["ir"] = DraftIR(blocks=blocks, options={}).model_dump(mode="json")
    return DraftSaveRequest.model_validate(final_payload)


def _default_trend_title(trends: TrendsListResponse) -> str:
    suffix = trends.country.upper() if trends.country else "global"
    return f"{suffix} trend recap"


def _format_trend_line(idx: int, trend: TrendItem) -> list[str]:
    line = f"{idx}. {trend.title}"
    details: list[str] = []
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

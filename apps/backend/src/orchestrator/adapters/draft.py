"""Draft-related adapters for flow chaining."""

from typing import Any, Dict, List, Mapping

from apps.backend.src.modules.drafts.schemas import DraftSaveRequest
from apps.backend.src.modules.trends.schemas import TrendItem, TrendsListResponse
from apps.backend.src.modules.llm.schemas import LlmInvokeContext, LlmResult, PromptKey, PromptVars
from apps.backend.src.orchestrator.adapters.utils import _ensure_trends_model
from apps.backend.src.orchestrator.flows.internal.llm import LlmInvokePayload


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


def _ensure_llm_result(value: Any) -> LlmResult:
    if isinstance(value, LlmResult):
        return value
    if isinstance(value, Mapping):
        return LlmResult.model_validate(value)
    raise TypeError("Unsupported LLM result payload")


def llm_result_to_draft_adapter(source: Any, base_payload: Dict[str, Any]) -> DraftSaveRequest:
    """Convert an LLM response into a draft creation payload."""

    result = _ensure_llm_result(source)
    draft_data = result.data.get("draft_ir") if isinstance(result.data, dict) else None
    if not draft_data:
        raise ValueError("LLM 응답에 draft_ir 데이터가 포함되어 있지 않습니다.")

    payload = dict(base_payload or {})
    payload["ir"] = draft_data
    return DraftSaveRequest.model_validate(payload)


__all__.append("llm_result_to_draft_adapter")


def _coerce_prompt_key(value: Any, *, default: PromptKey) -> PromptKey:
    if isinstance(value, PromptKey):
        return value
    if isinstance(value, str):
        try:
            return PromptKey(value)
        except ValueError as exc:
            raise ValueError(f"Unsupported prompt key '{value}'") from exc
    return default


def _prepare_trend_data(trends: TrendsListResponse) -> list[dict]:
    prepared: list[dict] = []
    for item in trends.items or []:
        prepared.append(item.model_dump(mode="json"))
    return prepared


def trends_to_prompt_adapter(source: Any, base_payload: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a trend listing into an LLM invoke payload."""

    trends: TrendsListResponse = _ensure_trends_model(source)
    if not trends.items:
        raise ValueError("트렌드 데이터가 비어 있어 LLM 입력을 생성할 수 없습니다.")

    payload = dict(base_payload or {})
    prompt_key = _coerce_prompt_key(payload.get("prompt_key"), default=PromptKey.DRAFT_FROM_TREND)

    vars_payload = dict(payload.get("vars") or {})
    if "trend_data" not in vars_payload:
        vars_payload["trend_data"] = _prepare_trend_data(trends)

    for key in ("product_name", "audience", "tone", "goal", "text"):
        if key not in vars_payload and key in payload:
            vars_payload[key] = payload[key]

    prompt_vars = PromptVars.model_validate(vars_payload)

    context_payload = payload.get("context")
    invoke_context = None
    if context_payload:
        invoke_context = (
            context_payload
            if isinstance(context_payload, LlmInvokeContext)
            else LlmInvokeContext.model_validate(context_payload)
        )

    invoke_payload = LlmInvokePayload(
        prompt_key=prompt_key,
        vars=prompt_vars,
        version=payload.get("version"),
        context=invoke_context,
    )
    return invoke_payload.model_dump(exclude_none=True)


__all__.append("trends_to_prompt_adapter")

"""Adapters for transforming insight comments directly into draft payloads."""

from __future__ import annotations

from typing import Any, Dict, Mapping, Optional

from apps.backend.src.modules.drafts.schemas import DraftIR, DraftSaveRequest
from apps.backend.src.modules.insights.schemas import InsightCommentList
from apps.backend.src.modules.llm.schemas import DraftFromCommentOutput, LlmResult, PromptKey, PromptVars
from apps.backend.src.modules.llm.service import LLMService
from apps.backend.src.orchestrator.adapters.utils import _ensure_draft_ir_props
from apps.backend.src.core.logging import setup_logging
setup_logging()
import logging
logger = logging.getLogger(__name__)


def comments_to_draft_adapter(source: Any, base_payload: Dict[str, Any]) -> Any:
    comment_list = _ensure_comment_list(source)
    payload = _normalize_payload(base_payload)
    use_llm = payload.pop("_use_llm", True)
    if not comment_list.comments or not use_llm:
        return _draft_from_comments_fallback(comment_list, payload)

    async def _invoke() -> DraftSaveRequest:
        llm_payload = await _draft_from_comments_llm(comment_list, payload)
        if llm_payload is not None:
            return llm_payload
        return _draft_from_comments_fallback(comment_list, payload)

    return _invoke()


def _ensure_comment_list(value: Any) -> InsightCommentList:
    if isinstance(value, InsightCommentList):
        return value
    if isinstance(value, Mapping):
        return InsightCommentList.model_validate(value)
    raise TypeError("Unsupported comment payload type")


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


async def _draft_from_comments_llm(
    comment_list: InsightCommentList,
    payload: Dict[str, Any],
) -> Optional[DraftSaveRequest]:
    prompt_vars = PromptVars(
        comment_data=comment_list.comments,
        product_name=payload.get("product_name", "not specified"),
        audience=payload.get("audience", "general"),
        tone=payload.get("tone", "casual"),
        goal=payload.get("goal", "social"),
        text=payload.get("text", "think hard about the best way to write this content"),
    )

    try:
        result_dict = await LLMService.instance().ainvoke(PromptKey.DRAFT_FROM_COMMENT, prompt_vars)
    except Exception as e:
        logger.info(f"Exception: {e}")
        return None

    if isinstance(result_dict, dict) and result_dict.get("error"):
        return None

    try:
        llm_result = LlmResult.model_validate(result_dict)
        output = DraftFromCommentOutput.model_validate(llm_result.data)
        output.draft_ir = _ensure_draft_ir_props(output.draft_ir)
    except Exception as e:
        logger.info(f"Exception: {e}")
        return None

    final_payload: Dict[str, Any] = {}
    for key in ("campaign_id", "title", "tags", "goal"):
        if key in payload:
            final_payload[key] = payload[key]

    final_payload.setdefault("title", _default_comment_title(comment_list))
    final_payload["ir"] = output.draft_ir.model_dump(mode="json")
    return DraftSaveRequest.model_validate(final_payload)


def _draft_from_comments_fallback(
    comment_list: InsightCommentList,
    payload: Dict[str, Any],
) -> DraftSaveRequest:
    comments = comment_list.comments
    text_lines = []
    for comment in comments[:3]:
        author = comment.author_username or "user"
        excerpt = (comment.text or "").strip()
        if excerpt:
            text_lines.append(f"- @{author}: {excerpt}")

    markdown = "Top community reactions:\n" + "\n".join(text_lines or ["(no comments available)"])
    ir = DraftIR(
        blocks=[
            {
                "type": "text",
                "props": {"markdown": markdown},
            }
        ],
        options={},
    )

    final_payload: Dict[str, Any] = {}
    for key in ("campaign_id", "title", "tags", "goal"):
        if key in payload:
            final_payload[key] = payload[key]

    final_payload.setdefault("title", _default_comment_title(comment_list))
    final_payload["ir"] = ir.model_dump(mode="json")
    return DraftSaveRequest.model_validate(final_payload)


def _default_comment_title(comment_list: InsightCommentList) -> str:
    total = len(comment_list.comments)
    return f"Community insights ({total} comments)" if total else "Community insights"


__all__ = ["comments_to_draft_adapter"]

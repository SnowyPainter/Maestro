"""Adapters for transforming insight comments directly into draft payloads."""

from __future__ import annotations

from typing import Any, Dict, Mapping, Optional

from apps.backend.src.modules.drafts.schemas import DraftIR, DraftSaveRequest
from apps.backend.src.modules.insights.schemas import InsightCommentList
from apps.backend.src.modules.llm.schemas import (
    DraftFromCommentOutput,
    LlmResult,
    PromptKey,
    PromptVars,
    ReactionTemplateFromCommentOutput,
)
from apps.backend.src.modules.llm.service import LLMService
from apps.backend.src.orchestrator.adapters.utils import build_persona_brief, _ensure_draft_ir_props
from apps.backend.src.core.logging import setup_logging
from apps.backend.src.orchestrator.flows.action.reactive import ReactionMessageTemplateCreateCommand
from apps.backend.src.modules.common.enums import ReactionActionType

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

def comments_to_reaction_message_template_adapter(source: Any, base_payload: Dict[str, Any]) -> Any:
    comment_list = _ensure_comment_list(source)
    payload = _normalize_payload(base_payload)

    use_llm = payload.pop("_use_llm", True)

    if not comment_list.comments or not use_llm:
        return _message_template_from_comments_fallback(comment_list, payload)

    async def _invoke() -> ReactionMessageTemplateCreateCommand:
        llm_payload = await _message_template_from_comments_llm(comment_list, payload)
        if llm_payload is not None:
            return llm_payload
        return _message_template_from_comments_fallback(comment_list, payload)

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
    persona_brief = await build_persona_brief(payload, comment_list=comment_list)
    prompt_vars = PromptVars(
        comment_data=comment_list.comments,
        product_name=payload.get("product_name", "not specified"),
        audience=payload.get("audience", "general"),
        tone=payload.get("tone", "casual"),
        goal=payload.get("goal", "social"),
        text=payload.get("text", "think hard about the best way to write this content"),
        persona_brief=persona_brief or {},
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

async def _message_template_from_comments_llm(
    comment_list: InsightCommentList,
    payload: Dict[str, Any],
) -> Optional[ReactionMessageTemplateCreateCommand]:
    persona_brief = await build_persona_brief(payload, comment_list=comment_list)
    prompt_vars = PromptVars(
        comment_data=comment_list.comments,
        product_name=payload.get("product_name", "not specified"),
        audience=payload.get("audience", "general"),
        tone=payload.get("tone", "casual"),
        goal=payload.get("goal", "social"),
        text=payload.get("text", "think hard about the best way to write this content"),
        persona_brief=persona_brief or {},
        template_type_hint=_normalize_template_type_hint(payload.get("template_type")),
        tag_key_hint=payload.get("tag_key"),
        title_hint=payload.get("title"),
    )

    try:
        result_dict = await LLMService.instance().ainvoke(
            PromptKey.REACTION_TEMPLATE_FROM_COMMENT,
            prompt_vars,
        )
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.info("LLM exception while generating reaction template: %s", exc)
        return None

    if isinstance(result_dict, dict) and result_dict.get("error"):
        return None

    try:
        llm_result = LlmResult.model_validate(result_dict)
        output = ReactionTemplateFromCommentOutput.model_validate(llm_result.data)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.info("Failed to parse LLM response for reaction template: %s", exc)
        return None

    final_payload = _assemble_message_template_payload(
        comment_list,
        payload,
        template_type=_resolve_template_type(payload, output.template_type, comment_list),
        tag_key=output.tag_key,
        title=output.title,
        body=output.body,
    )
    return ReactionMessageTemplateCreateCommand.model_validate(final_payload)


def _message_template_from_comments_fallback(
    comment_list: InsightCommentList,
    payload: Dict[str, Any],
) -> ReactionMessageTemplateCreateCommand:
    template_type = _resolve_template_type(payload, None, comment_list)
    body = _build_fallback_body(comment_list)
    title = payload.get("title") or _default_template_title(comment_list)
    final_payload = _assemble_message_template_payload(
        comment_list,
        payload,
        template_type=template_type,
        tag_key=None,
        title=title,
        body=body,
    )
    return ReactionMessageTemplateCreateCommand.model_validate(final_payload)


def _assemble_message_template_payload(
    comment_list: InsightCommentList,
    payload: Dict[str, Any],
    *,
    template_type: ReactionActionType,
    tag_key: Optional[str],
    title: Optional[str],
    body: str,
) -> Dict[str, Any]:
    final_payload: Dict[str, Any] = {}

    for optional_key in ("persona_account_id",):
        if optional_key in payload:
            final_payload[optional_key] = payload[optional_key]

    final_payload["template_type"] = template_type

    if payload.get("tag_key") is not None:
        final_payload["tag_key"] = payload.get("tag_key")
    else:
        final_payload["tag_key"] = tag_key

    resolved_title = payload.get("title") or title or _default_template_title(comment_list)
    final_payload["title"] = resolved_title

    final_payload["body"] = payload.get("body") or body
    final_payload["language"] = "en"
    final_payload["metadata"] = payload.get("metadata")
    final_payload["is_active"] = payload.get("is_active", True)

    return final_payload


def _resolve_template_type(
    payload: Dict[str, Any],
    llm_template_type: Optional[ReactionActionType],
    comment_list: InsightCommentList,
) -> ReactionActionType:
    user_value = payload.get("template_type")
    if user_value:
        try:
            return user_value if isinstance(user_value, ReactionActionType) else ReactionActionType(user_value)
        except ValueError:
            logger.info("Unknown template_type provided in payload: %s", user_value)
    if llm_template_type is not None:
        return llm_template_type
    return _infer_template_type_from_comments(comment_list)


def _normalize_template_type_hint(value: Optional[Any]) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, ReactionActionType):
        return value.value
    try:
        return ReactionActionType(str(value)).value
    except ValueError:
        return str(value)


def _infer_template_type_from_comments(comment_list: InsightCommentList) -> ReactionActionType:
    urgent_keywords = ("refund", "support", "problem", "issue", "dm", "message", "help", "contact")
    for comment in comment_list.comments:
        text = (comment.text or "").lower()
        if any(keyword in text for keyword in urgent_keywords):
            return ReactionActionType.DM
    return ReactionActionType.REPLY


def _build_fallback_body(comment_list: InsightCommentList) -> str:
    comments = comment_list.comments
    if not comments:
        return "Thanks for staying engaged with us! We appreciate your support."

    top_comment = comments[0]
    author = top_comment.author_username or "there"
    excerpt = (top_comment.text or "").strip()

    highlight_author = f"@{author}" if author else "there"
    highlight_text = excerpt[:200] if excerpt else "your feedback"

    additional_signal = ""
    if len(comments) > 1:
        additional_signal = " We have seen similar thoughts from others, and we are taking every note seriously."
    body = (
        f"Hi {highlight_author}, thanks for sharing this with us. "
        f"We really appreciate the perspective you brought: {highlight_text}. "
        "Our team is already reviewing the situation so we can follow up with the right next step."
    )
    if additional_signal:
        body += additional_signal
    body += " Please keep the ideas coming—your voice helps us build a better experience."
    return body


def _default_template_title(comment_list: InsightCommentList) -> str:
    total = len(comment_list.comments)
    if total == 0:
        return "Community response template"
    if total == 1:
        return "Reply to highlighted comment"
    return f"Reply to top {total} comments"

def _default_comment_title(comment_list: InsightCommentList) -> str:
    total = len(comment_list.comments)
    return f"Community insights ({total} comments)" if total else "Community insights"


__all__ = ["comments_to_draft_adapter", "comments_to_reaction_message_template_adapter"]

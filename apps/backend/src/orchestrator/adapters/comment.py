"""Adapters for transforming insight comments directly into draft payloads."""

from __future__ import annotations

from typing import Any, Dict, Mapping, Optional

from apps.backend.src.core.db import SessionLocal as AsyncSessionLocal
from apps.backend.src.modules.accounts.models import Persona, PersonaAccount
from apps.backend.src.modules.drafts.schemas import DraftIR, DraftSaveRequest
from apps.backend.src.modules.insights.schemas import InsightCommentList
from apps.backend.src.modules.llm.schemas import DraftFromCommentOutput, LlmResult, PromptKey, PromptVars
from apps.backend.src.modules.llm.service import LLMService
from apps.backend.src.orchestrator.adapters.utils import _ensure_draft_ir_props
from apps.backend.src.core.logging import setup_logging
from sqlalchemy.ext.asyncio import AsyncSession

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
    persona_brief = await _build_persona_brief(comment_list, payload)
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


def _default_comment_title(comment_list: InsightCommentList) -> str:
    total = len(comment_list.comments)
    return f"Community insights ({total} comments)" if total else "Community insights"


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


async def _build_persona_brief(
    comment_list: InsightCommentList,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    existing = payload.get("persona_brief")
    if isinstance(existing, dict):
        return existing

    persona_account_id = _extract_persona_account_id(comment_list, payload)
    persona_id = _coerce_int(payload.get("persona_id"))

    if persona_account_id is None and persona_id is None:
        return {}

    try:
        async with AsyncSessionLocal() as session:
            persona = await _load_persona(session, persona_id, persona_account_id)
    except Exception:
        logger.exception(
            "failed to load persona brief for comment draft adapter",
            extra={"persona_id": persona_id, "persona_account_id": persona_account_id},
        )
        return {}

    return _persona_to_brief(persona) or {}


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
    comment_list: InsightCommentList,
    payload: Dict[str, Any],
) -> Optional[int]:
    for key in ("persona_account_id", "account_persona_id"):
        value = _coerce_int(payload.get(key))
        if value is not None:
            return value

    for comment in comment_list.comments:
        value = _coerce_int(getattr(comment, "account_persona_id", None))
        if value is not None:
            return value
    return None


__all__ = ["comments_to_draft_adapter"]

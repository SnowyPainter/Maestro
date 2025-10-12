"""Adapters for transforming insight comments into LLM prompt payloads."""

from __future__ import annotations

from typing import Any, Dict, Iterable, Mapping

from apps.backend.src.modules.insights.schemas import InsightCommentList, InsightCommentOut
from apps.backend.src.modules.llm.schemas import LlmInvokeContext, PromptKey, PromptVars
from apps.backend.src.orchestrator.flows.internal.llm import LlmInvokePayload


def _ensure_comment_list(value: Any) -> InsightCommentList:
    if isinstance(value, InsightCommentList):
        return value
    if isinstance(value, Mapping):
        return InsightCommentList.model_validate(value)
    raise TypeError("Unsupported comment payload type")


def _coerce_prompt_key(value: Any) -> PromptKey:
    if isinstance(value, PromptKey):
        return value
    if isinstance(value, str):
        try:
            return PromptKey(value)
        except ValueError as exc:
            raise ValueError(f"Unsupported prompt key '{value}'") from exc
    return PromptKey.DRAFT_FROM_COMMENT


def _prepare_comment_data(comments: Iterable[InsightCommentOut]) -> list[dict]:
    data: list[dict] = []
    for comment in comments:
        model = comment if isinstance(comment, InsightCommentOut) else InsightCommentOut.model_validate(comment)
        data.append(model.model_dump(mode="json"))
    return data


def comments_to_prompt_adapter(source: Any, base_payload: Dict[str, Any]) -> Dict[str, Any]:
    """Convert stored insight comments into an LLM invoke payload."""

    comment_list = _ensure_comment_list(source)
    if not comment_list.comments:
        raise ValueError("댓글 데이터가 비어 있어 LLM 입력을 생성할 수 없습니다.")

    payload = dict(base_payload or {})
    prompt_key = _coerce_prompt_key(payload.get("prompt_key"))

    vars_payload = dict(payload.get("vars") or {})

    # Inject comment dataset if not supplied.
    if "comment_data" not in vars_payload:
        vars_payload["comment_data"] = _prepare_comment_data(comment_list.comments)

    # Lift common optional prompt variables from the base payload for convenience.
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


__all__ = ["comments_to_prompt_adapter"]

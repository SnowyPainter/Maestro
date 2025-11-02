from __future__ import annotations

import json
import logging
from typing import Any, Iterable, Mapping, Sequence
from apps.backend.src.core.config import settings
from apps.backend.src.services.http_clients import SLACK_CLIENT
import httpx


logger = logging.getLogger(__name__)


def _truncate(value: str, limit: int = 400) -> str:
    if len(value) <= limit:
        return value
    return f"{value[: limit - 1]}…"


def send_message(*, text: str, blocks: Sequence[dict[str, Any]] | None = None) -> bool:
    """
    Send a message to Slack via incoming webhook.
    """
    webhook = settings.SLACK_ALERT_WEBHOOK_URL
    if not webhook:
        logger.debug("Slack webhook not configured; skipping alert: %s", text)
        return False

    payload: dict[str, Any] = {"text": text}
    if blocks:
        payload["blocks"] = list(blocks)

    try:
        response = SLACK_CLIENT.post(webhook, json=payload)
        response.raise_for_status()
        return True
    except httpx.HTTPError as exc:
        logger.warning("Failed to post Slack alert: %s", exc)
        return False


def notify_failure(
    *,
    queue: str | None,
    task_name: str,
    task_id: str | None,
    exception: BaseException | None,
    retries: int | None,
    args: Sequence[Any] | None,
    kwargs: Mapping[str, Any] | None,
) -> bool:
    """
    Format and send a Slack notification for a Celery task failure.
    """

    base_text = (
        ":rotating_light: 사이드카 태스크 실패 감지"
        if queue == "graph_rag"
        else ":warning: Celery 태스크 실패 감지"
    )
    summary = f"{base_text} – `{task_name}`"

    exc_text = _truncate(repr(exception) if exception else "unknown error")
    fields: list[dict[str, str]] = [
        {"type": "mrkdwn", "text": f"*Queue*: `{queue or 'unknown'}`"},
        {"type": "mrkdwn", "text": f"*Task ID*: `{task_id or 'n/a'}`"},
    ]

    if retries is not None:
        fields.append({"type": "mrkdwn", "text": f"*Retry count*: `{retries}`"})

    blocks: list[dict[str, Any]] = [
        {"type": "section", "text": {"type": "mrkdwn", "text": summary}},
        {"type": "section", "fields": fields},
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*Exception*\n```{exc_text}```"},
        },
    ]

    if args:
        args_text = _truncate(json.dumps(list(_safe_iter(args)), ensure_ascii=False))
        blocks.append(
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Args*\n```{args_text}```"},
            }
        )

    if kwargs:
        kwargs_text = _truncate(json.dumps(dict(_safe_items(kwargs)), ensure_ascii=False))
        blocks.append(
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Kwargs*\n```{kwargs_text}```"},
            }
        )

    return send_message(text=summary, blocks=blocks)


def _safe_iter(values: Iterable[Any]) -> Iterable[Any]:
    for value in values:
        yield _safe_value(value)


def _safe_items(mapping: Mapping[str, Any]) -> Iterable[tuple[str, Any]]:
    for key, value in mapping.items():
        yield key, _safe_value(value)


def _safe_value(value: Any) -> Any:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    try:
        json.dumps(value)
        return value
    except (TypeError, ValueError):
        return repr(value)

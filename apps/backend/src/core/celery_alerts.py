from __future__ import annotations

import logging
from typing import Any, Mapping, Sequence

from celery import signals

from apps.backend.src.core.config import settings
from apps.backend.src.services.alerts.slack import notify_failure

logger = logging.getLogger(__name__)

WATCHED_QUEUES = {"graph_rag"}


@signals.task_failure.connect
def forward_task_failure(
    sender=None,
    task_id: str | None = None,
    exception: BaseException | None = None,
    args: Sequence[Any] | None = None,
    kwargs: Mapping[str, Any] | None = None,
    einfo: Any | None = None,
    **extra: Any,
) -> None:
    if not settings.SLACK_ALERT_WEBHOOK_URL:
        return

    request = extra.get("request")
    queue: str | None = None
    retries: int | None = None

    if request is not None:
        delivery_info = getattr(request, "delivery_info", None) or {}
        queue = delivery_info.get("routing_key") or delivery_info.get("queue")
        retries = getattr(request, "retries", None)

    if queue not in WATCHED_QUEUES:
        return

    task_name = getattr(sender, "name", "unknown-task")

    try:
        sent = notify_failure(
            queue=queue,
            task_name=task_name,
            task_id=task_id,
            exception=exception,
            retries=retries,
            args=args or (),
            kwargs=kwargs or {},
        )
        if not sent:
            logger.debug(
                "Slack notification skipped for task failure queue=%s task=%s", queue, task_name
            )
    except Exception as exc:  # pragma: no cover - defensive alert path
        logger.warning(
            "Failed to forward task failure alert to Slack queue=%s task=%s: %s",
            queue,
            task_name,
            exc,
        )

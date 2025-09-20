from __future__ import annotations

from typing import Any, Dict, Optional

from celery import signals

from apps.backend.src.core.context import apply_context, capture_context

_CONTEXT_HEADER = "maestro-context"


def _extract_headers(request: Any) -> Dict[str, Any]:
    headers = getattr(request, "headers", None)
    if isinstance(headers, dict):
        return headers
    # Celery 5 may hand us kombu's CaseInsensitiveDict; treat generically
    return dict(headers or {})


@signals.before_task_publish.connect
def inject_context_into_headers(sender=None, headers=None, body=None, **kwargs):
    if headers is None:
        return

    snapshot = capture_context()
    if snapshot:
        headers[_CONTEXT_HEADER] = snapshot
    else:
        headers.pop(_CONTEXT_HEADER, None)


@signals.task_prerun.connect
def restore_context_before_task(sender=None, task=None, **kwargs):
    if task is None:
        return

    request = getattr(task, "request", None)
    if request is None:
        return

    snapshot: Optional[Dict[str, Optional[str]]] = None

    headers = _extract_headers(request)
    if _CONTEXT_HEADER in headers:
        snapshot = headers.get(_CONTEXT_HEADER)
    else:
        # Fallback if Celery stored the header directly on the request namespace
        snapshot = getattr(request, _CONTEXT_HEADER, None)

    apply_context(snapshot)

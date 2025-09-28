"""Runtime helpers for schedule orchestration workers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Optional


def _json_safe(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    return value


@dataclass
class ScheduleDirective:
    """Directive returned by flows to control future scheduling."""

    resume_at: Optional[datetime] = None
    delay: Optional[timedelta] = None
    payload: Optional[dict[str, Any]] = None
    context: Optional[dict[str, Any]] = None
    status: str = "pending"

    def effective_resume_at(self) -> datetime:
        if self.resume_at is not None:
            return self.resume_at
        if self.delay is None:
            raise ValueError("Either resume_at or delay must be provided")
        return datetime.utcnow() + self.delay


class ScheduleReschedule(Exception):
    """Raised to signal that the current schedule should be rescheduled."""

    def __init__(self, directive: ScheduleDirective):
        super().__init__("schedule rescheduled")
        self.directive = directive


def request_reschedule(
    *,
    delay: Optional[timedelta] = None,
    resume_at: Optional[datetime] = None,
    payload: Optional[dict[str, Any]] = None,
    context: Optional[dict[str, Any]] = None,
    status: str = "pending",
) -> ScheduleReschedule:
    """Helper to raise a reschedule directive from inside a flow operator."""
    directive = ScheduleDirective(
        delay=delay,
        resume_at=resume_at,
        payload=_json_safe(payload) if payload is not None else None,
        context=_json_safe(context) if context is not None else None,
        status=status,
    )
    if directive.resume_at is None and directive.delay is None:
        raise ValueError("delay or resume_at must be provided for reschedule")
    return ScheduleReschedule(directive)


__all__ = [
    "ScheduleDirective",
    "ScheduleReschedule",
    "request_reschedule",
]

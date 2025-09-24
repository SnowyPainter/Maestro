# apps/backend/src/workers/CoWorker/dispatcher.py
from typing import Any, Dict
from apps.backend.src.modules.scheduler.models import Schedule
from apps.backend.src.workers.CoWorker.runners.draft_composer import run_draft_composer
from apps.backend.src.modules.scheduler.models import ScheduleKind

def run_schedule(sch: Schedule) -> Dict[str, Any]:
    kind = sch.kind
    if kind == ScheduleKind.MAIL:
        return run_draft_composer(sch)
    return {"ok": False, "reason": "unknown_kind"}
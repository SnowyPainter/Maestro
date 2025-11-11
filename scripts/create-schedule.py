#!/usr/bin/env python3
"""Utility to create Schedule rows directly from templates or raw DAG specs.

Examples:
  - From template (single run):
      python scripts/create-schedule.py template \
        --persona-id 1 --persona-account-id 1 \
        --email-to you@example.com --country US --limit 20 \
        --run-at 2025-09-28T00:06:12+09:00 --queue coworker

  - From raw dag_spec.json:
      python scripts/create-schedule.py raw \
        --persona-account-id 1 --dag-spec /path/to/dag_spec.json \
        --run-at 2025-09-28T00:06:12Z --queue coworker
"""

from __future__ import annotations

import argparse
import asyncio
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
import sys
from uuid import uuid4

# Ensure repository root is on sys.path so `apps` package is importable
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def _parse_dt(value: Optional[str]) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    # Try ISO8601 parsing with timezone if present
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        raise SystemExit(f"Invalid datetime: {value}. Use ISO8601, e.g. 2025-09-28T00:06:12Z")
    return dt


def _select_run_at(run_at_str: Optional[str], in_minutes: Optional[int]) -> datetime:
    if in_minutes is not None:
        base = datetime.now(timezone.utc)
        return base + timedelta(minutes=max(0, int(in_minutes)))
    return _parse_dt(run_at_str)


async def _create_from_dag_spec(
    *,
    dag_spec_payload: Dict[str, Any],
    persona_account_id: int,
    run_at: datetime,
    repeats: int,
    repeat_interval_minutes: int,
    queue: Optional[str],
) -> List[int]:
    from apps.backend.src.core.db import SessionLocal as AsyncSessionLocal
    from apps.backend.src.modules.accounts.models import PersonaAccount
    from apps.backend.src.modules.scheduler.models import Schedule, ScheduleStatus
    from apps.backend.src.modules.scheduler.planner import normalize_due_at

    schedule_ids: List[int] = []

    test_context = {
        "template": "mail.trends_with_reply",
        "plan_timezone": "Asia/Seoul",
        "plan_title": "auto-created-schedule",
        "user_id": 1,
        "plan_segment": "default",
        "schedule_index": 1
    }

    # Persist schedules
    async with AsyncSessionLocal() as db:  # type: ignore
        interval = timedelta(minutes=max(0, int(repeat_interval_minutes)))
        due_at = normalize_due_at(run_at)

        for _ in range(max(1, int(repeats))):
            schedule = Schedule(
                persona_account_id=persona_account_id,
                dag_spec=dag_spec_payload,
                payload=dag_spec_payload.get("payload"),
                context=test_context,
                status=ScheduleStatus.PENDING.value,
                due_at=due_at,
                queue=queue or "coworker",
                idempotency_key=uuid4().hex,
            )
            db.add(schedule)
            await db.flush()
            schedule_ids.append(schedule.id)  # type: ignore[attr-defined]
            due_at = normalize_due_at(due_at + interval) if interval else due_at

        await db.commit()

    return schedule_ids


async def cmd_template(args: argparse.Namespace) -> None:
    from apps.backend.src.modules.scheduler.registry import (
        compile_schedule_template,
        ScheduleTemplateKey,
    )
    from apps.backend.src.modules.scheduler.schemas import (
        ScheduleCompileRequest,
        SlackScheduleTemplateParams,
    )

    # Build compile request
    slack_params = SlackScheduleTemplateParams(
        persona_id=args.persona_id,
        persona_account_id=args.persona_account_id,
        slack_channel=args.slack_channel,
        slack_user_id=args.slack_user_id,
        country=args.country,
        limit=args.limit,
        wait_timeout_s=args.wait_timeout_s,
        pipeline_id=args.pipeline_id,
    )
    request = ScheduleCompileRequest(
        template=ScheduleTemplateKey.SLACK_TRENDS_WITH_REPLY,
        slack=slack_params,
    )
    compiled = compile_schedule_template(request)
    dag_spec_model = compiled.dag_spec
    dag_spec_payload: Dict[str, Any] = dag_spec_model.model_dump(by_alias=True, exclude_none=True)  # type: ignore[attr-defined]

    schedule_ids = await _create_from_dag_spec(
        dag_spec_payload=dag_spec_payload,
        persona_account_id=args.persona_account_id,
        run_at=_select_run_at(args.run_at, args.in_minutes),
        repeats=args.repeats,
        repeat_interval_minutes=args.repeat_interval_minutes,
        queue=args.queue,
    )
    print(json.dumps({"created": schedule_ids}, ensure_ascii=False))


async def cmd_raw(args: argparse.Namespace) -> None:
    from apps.backend.src.modules.scheduler.schemas import ScheduleDagSpec

    dag_path = Path(args.dag_spec)
    if not dag_path.exists():
        raise SystemExit(f"dag_spec file not found: {dag_path}")
    try:
        raw = json.loads(dag_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise SystemExit(f"Failed to read dag_spec JSON: {exc}")

    # Validate with pydantic model so shapes match executor expectations
    model = ScheduleDagSpec.model_validate(raw)  # type: ignore[attr-defined]
    dag_spec_payload: Dict[str, Any] = model.model_dump(by_alias=True, exclude_none=True)  # type: ignore[attr-defined]

    # Optional meta merge
    if args.meta:
        try:
            meta_update = json.loads(args.meta)
            if isinstance(meta_update, dict):
                base_meta = dict(dag_spec_payload.get("meta") or {})
                base_meta.update(meta_update)
                dag_spec_payload["meta"] = base_meta
        except Exception as exc:
            raise SystemExit(f"Invalid --meta JSON: {exc}")

    schedule_ids = await _create_from_dag_spec(
        dag_spec_payload=dag_spec_payload,
        persona_account_id=args.persona_account_id,
        run_at=_select_run_at(args.run_at, args.in_minutes),
        repeats=args.repeats,
        repeat_interval_minutes=args.repeat_interval_minutes,
        queue=args.queue,
    )
    print(json.dumps({"created": schedule_ids}, ensure_ascii=False))


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Create schedules from template or raw dag spec")
    sub = p.add_subparsers(dest="cmd", required=True)

    # Template: SLACK_TRENDS_WITH_REPLY (single or repeated)
    t = sub.add_parser("template", help="Create schedule(s) from SLACK_TRENDS_WITH_REPLY template")
    t.add_argument("--persona-id", type=int, required=True)
    t.add_argument("--persona-account-id", type=int, required=True)
    t.add_argument("--slack-channel", type=str, required=True, help="Channel ID or DM conversation to post")
    t.add_argument("--slack-user-id", type=str, default=None, help="Optional Slack user id for attribution")
    t.add_argument("--country", type=str, default="US")
    t.add_argument("--limit", type=int, default=20)
    t.add_argument("--wait-timeout-s", type=int, default=7 * 24 * 3600)
    t.add_argument("--pipeline-id", type=str, default=None)
    t.add_argument("--run-at", type=str, default=None, help="ISO8601 time; defaults to now")
    t.add_argument("--in-minutes", type=int, default=None, help="Run N minutes from now (overrides --run-at)")
    t.add_argument("--repeats", type=int, default=1)
    t.add_argument("--repeat-interval-minutes", type=int, default=0)
    t.add_argument("--queue", type=str, default="coworker")
    t.set_defaults(func=lambda a: asyncio.run(cmd_template(a)))

    # Raw dag_spec
    r = sub.add_parser("raw", help="Create schedule(s) from a dag_spec JSON file")
    r.add_argument("--persona-account-id", type=int, required=True)
    r.add_argument("--dag-spec", type=str, required=True, help="Path to ScheduleDagSpec JSON file")
    r.add_argument("--meta", type=str, default=None, help="Optional JSON object to merge into dag_spec.meta")
    r.add_argument("--run-at", type=str, default=None, help="ISO8601 time; defaults to now")
    r.add_argument("--in-minutes", type=int, default=None, help="Run N minutes from now (overrides --run-at)")
    r.add_argument("--repeats", type=int, default=1)
    r.add_argument("--repeat-interval-minutes", type=int, default=0)
    r.add_argument("--queue", type=str, default="coworker")
    r.set_defaults(func=lambda a: asyncio.run(cmd_raw(a)))

    return p


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()


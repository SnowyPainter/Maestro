#!/usr/bin/env python3
"""Insert test schedules for registry templates without running pytest.

This helper compiles one of the built-in schedule templates and persists a row in
`schedules`. It is useful when you want to exercise Celery workers or inspect the
stored DAG payloads manually.

Examples
--------
Create a mail trends schedule due now (persona/account IDs must exist):
    scripts/create_schedule_entry.py mail \
        --persona-id 1 \
        --persona-account-id 4 \
        --email-to snowypainter@gmail.com

Create a post publish schedule due in 10 minutes:
    scripts/create_schedule_entry.py post \
        --post-publication-id 500 \
        --persona-account-id 600 \
        --variant-id 700 \
        --draft-id 800 \
        --platform instagram \
        --due-in-minutes 10
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from uuid import uuid4

from sqlalchemy.exc import IntegrityError

from apps.backend.src.core.db import SessionLocal
from apps.backend.src.modules.common.enums import PlatformKind, ScheduleStatus
from apps.backend.src.modules.accounts.models import PersonaAccount
from apps.backend.src.modules.scheduler.models import Schedule
from apps.backend.src.modules.scheduler.planner import normalize_due_at
from apps.backend.src.modules.scheduler.registry import (
    ScheduleTemplateKey,
    compile_schedule_template,
)
from apps.backend.src.modules.scheduler.schemas import (
    MailScheduleTemplateParams,
    PostPublishTemplateParams,
    ScheduleCompileRequest,
)


def _choices(enum_cls) -> list[str]:
    return [item.value for item in enum_cls]


def _compute_due_at(due_in_minutes: int) -> datetime:
    base = datetime.now(timezone.utc) + timedelta(minutes=due_in_minutes)
    return normalize_due_at(base)


def _dump_spec(model) -> Dict[str, Any]:
    return model.model_dump(by_alias=True, exclude_none=True)


async def _insert_schedule(
    *,
    payload: Dict[str, Any],
    dag_spec: Dict[str, Any],
    persona_account_id: int,
    due_at: datetime,
    queue: str,
) -> int:
    async with SessionLocal() as session:
        schedule = Schedule(
            persona_account_id=persona_account_id,
            dag_spec=dag_spec,
            payload=payload,
            context={
                "template": "mail.trends_with_reply",
                "plan_timezone": "Asia/Seoul",
                "user_id": 1,
                "plan_segment": "default",
                "plan_local_due": "2025-09-27T09:00:00+09:00",
                "schedule_index": 0
            },
            status=ScheduleStatus.PENDING.value,
            due_at=due_at,
            queue=queue,
            idempotency_key=uuid4().hex,
        )

        try:
            async with session.begin():
                session.add(schedule)
                await session.flush()
                schedule_id = schedule.id
        except IntegrityError as exc:
            await session.rollback()
            raise RuntimeError(f"Failed to insert schedule: {exc}") from exc

    return schedule_id


async def _create_mail_schedule(args: argparse.Namespace) -> int:
    request = ScheduleCompileRequest(
        template=ScheduleTemplateKey.MAIL_TRENDS_WITH_REPLY,
        mail=MailScheduleTemplateParams(
            persona_id=args.persona_id,
            persona_account_id=args.persona_account_id,
            email_to=args.email_to,
            country=args.country,
            limit=args.limit,
            wait_timeout_s=args.wait_timeout_s,
            pipeline_id=args.pipeline_id,
        ),
    )
    result = compile_schedule_template(request)
    dag_spec = _dump_spec(result.dag_spec)

    due_at = _compute_due_at(args.due_in_minutes)
    dag_spec.setdefault("meta", {})["due_at"] = due_at.isoformat()

    return await _insert_schedule(
        payload=dag_spec.get("payload", {}),
        dag_spec=dag_spec,
        persona_account_id=args.persona_account_id,
        due_at=due_at,
        queue="coworker",
    )


async def _create_post_publish_schedule(args: argparse.Namespace) -> int:
    request = ScheduleCompileRequest(
        template=ScheduleTemplateKey.POST_PUBLISH,
        post_publish=PostPublishTemplateParams(
            post_publication_id=args.post_publication_id,
            persona_account_id=args.persona_account_id,
            variant_id=args.variant_id,
            draft_id=args.draft_id,
            platform=PlatformKind(args.platform),
        ),
    )
    result = compile_schedule_template(request)
    dag_spec = _dump_spec(result.dag_spec)

    due_at = _compute_due_at(args.due_in_minutes)
    dag_spec.setdefault("meta", {})["due_at"] = due_at.isoformat()

    return await _insert_schedule(
        payload=dag_spec.get("payload", {}),
        dag_spec=dag_spec,
        persona_account_id=args.persona_account_id,
        due_at=due_at,
        queue="coworker",
    )


async def _cleanup(schedule_id: int) -> None:
    async with SessionLocal() as session:
        async with session.begin():
            schedule = await session.get(Schedule, schedule_id)
            if schedule is None:
                return
            await session.delete(schedule)


async def _main(args: argparse.Namespace) -> None:
    if args.template == "mail":
        schedule_id = await _create_mail_schedule(args)
    else:
        schedule_id = await _create_post_publish_schedule(args)

    print(f"Inserted schedule #{schedule_id} for template '{args.template}'")

    if args.cleanup:
        await _cleanup(schedule_id)
        print(f"Cleanup complete for schedule #{schedule_id}")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Insert a schedule row for testing Celery workers.")
    subparsers = parser.add_subparsers(dest="template", required=True)

    mail_parser = subparsers.add_parser("mail", help="Schedule MAIL_TRENDS_WITH_REPLY")
    mail_parser.add_argument("--persona-id", type=int, required=True)
    mail_parser.add_argument("--persona-account-id", type=int, required=True)
    mail_parser.add_argument("--email-to", required=True)
    mail_parser.add_argument("--country", default="US")
    mail_parser.add_argument("--limit", type=int, default=20)
    mail_parser.add_argument("--wait-timeout-s", type=int, default=7 * 24 * 3600)
    mail_parser.add_argument("--pipeline-id", default=None)
    mail_parser.add_argument("--due-in-minutes", type=int, default=0)
    mail_parser.add_argument("--cleanup", action="store_true")

    post_parser = subparsers.add_parser("post", help="Schedule POST_PUBLISH")
    post_parser.add_argument("--post-publication-id", type=int, required=True)
    post_parser.add_argument("--persona-account-id", type=int, required=True)
    post_parser.add_argument("--variant-id", type=int, required=True)
    post_parser.add_argument("--draft-id", type=int, required=True)
    post_parser.add_argument("--platform", choices=_choices(PlatformKind), required=True)
    post_parser.add_argument("--due-in-minutes", type=int, default=0)
    post_parser.add_argument("--cleanup", action="store_true")

    return parser


if __name__ == "__main__":
    parser = _build_parser()
    arguments = parser.parse_args()
    asyncio.run(_main(arguments))

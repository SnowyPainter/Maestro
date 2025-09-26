"""BFF flow for inspecting CoWorker lease status."""

from __future__ import annotations

from typing import Any, Iterable, Optional

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.accounts.models import Persona, PersonaAccount, PlatformAccount
from apps.backend.src.modules.scheduler import repository as scheduler_repo
from apps.backend.src.modules.users.models import User

from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator
from apps.backend.src.workers.CoWorker.execute_due_schedules import execute_due_schedules


class CoworkerLeasePayload(BaseModel):
    """Empty payload for CoWorker lease inspection."""


class CoworkerPersonaSummary(BaseModel):
    persona_account_id: int
    persona_id: int
    persona_name: Optional[str]
    platform: Optional[str]
    handle: Optional[str]
    avatar_url: Optional[str]


class CoworkerTaskInfo(BaseModel):
    id: str
    state: str
    info: Optional[dict[str, Any]] = None


class CoworkerLeaseState(BaseModel):
    has_lease: bool
    active: bool
    interval_seconds: int | None = None
    persona_account_ids: list[int]
    persona_accounts: list[CoworkerPersonaSummary]
    task_id: str | None = None
    current_task: Optional[CoworkerTaskInfo] = None


async def _load_persona_summaries(
    db: AsyncSession,
    *,
    owner_user_id: int,
    persona_account_ids: Iterable[int],
) -> list[CoworkerPersonaSummary]:
    ids = {int(pid) for pid in persona_account_ids}
    if not ids:
        return []
    stmt = (
        select(
            PersonaAccount.id,
            Persona.id,
            Persona.name,
            PlatformAccount.platform,
            PlatformAccount.handle,
            PlatformAccount.avatar_url,
        )
        .join(Persona, PersonaAccount.persona_id == Persona.id)
        .join(PlatformAccount, PersonaAccount.account_id == PlatformAccount.id)
        .where(
            Persona.owner_user_id == owner_user_id,
            PersonaAccount.id.in_(ids),
        )
    )
    rows = await db.execute(stmt)
    summaries: list[CoworkerPersonaSummary] = []
    for persona_account_id, persona_id, persona_name, platform, handle, avatar_url in rows.all():
        summaries.append(
            CoworkerPersonaSummary(
                persona_account_id=persona_account_id,
                persona_id=persona_id,
                persona_name=persona_name,
                platform=platform.value if platform is not None else None,
                handle=handle,
                avatar_url=avatar_url,
            )
        )
    summaries.sort(key=lambda item: item.persona_account_id)
    return summaries


def _summarize_task(task_id: Optional[str]) -> Optional[CoworkerTaskInfo]:
    if not task_id:
        return None
    try:
        result = execute_due_schedules.AsyncResult(task_id)
        state = result.state
        info_payload: Optional[dict[str, Any]] = None
        info = result.info
        if isinstance(info, dict):
            keys = {"processed", "rescheduled", "reason"}
            summary = {k: info[k] for k in info if k in keys}
            info_payload = summary or None
        elif isinstance(info, BaseException):  # pragma: no cover - defensive
            info_payload = {"error": str(info)}
        return CoworkerTaskInfo(id=task_id, state=state, info=info_payload)
    except Exception as exc:  # pragma: no cover - backend availability issues shouldn't crash API
        return CoworkerTaskInfo(id=task_id, state="unknown", info={"error": str(exc)})


async def _serialize_lease(
    db: AsyncSession,
    *,
    owner_user_id: int,
) -> CoworkerLeaseState:
    lease = await scheduler_repo.get_coworker_lease(db, owner_user_id=owner_user_id)
    if lease is None:
        return CoworkerLeaseState(
            has_lease=False,
            active=False,
            interval_seconds=None,
            persona_account_ids=[],
            persona_accounts=[],
            task_id=None,
            current_task=None,
        )
    persona_summaries = await _load_persona_summaries(
        db,
        owner_user_id=owner_user_id,
        persona_account_ids=lease.persona_account_ids,
    )
    task_info = _summarize_task(lease.task_id)
    return CoworkerLeaseState(
        has_lease=True,
        active=lease.active,
        interval_seconds=lease.interval_seconds,
        persona_account_ids=list(lease.persona_account_ids),
        persona_accounts=persona_summaries,
        task_id=lease.task_id,
        current_task=task_info,
    )


@operator(
    key="bff.coworker.read_lease",
    title="Read CoWorker Lease",
    side_effect="read",
)
async def op_read_coworker_lease(
    payload: CoworkerLeasePayload,
    ctx: TaskContext,
) -> CoworkerLeaseState:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    return await _serialize_lease(db, owner_user_id=user.id)


@FLOWS.flow(
    key="bff.coworker.read_lease",
    title="Get CoWorker Lease State",
    description="Retrieve the current CoWorker lease configuration for the authenticated user.",
    input_model=CoworkerLeasePayload,
    output_model=CoworkerLeaseState,
    method="get",
    path="/coworker/lease",
    tags=("bff", "coworker", "lease", "status"),
)
def _flow_bff_read_coworker_lease(builder: FlowBuilder):
    task = builder.task("read_lease", "bff.coworker.read_lease")
    builder.expect_terminal(task)


__all__ = []

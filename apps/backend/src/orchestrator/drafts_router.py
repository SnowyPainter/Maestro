"""Draft orchestration flows."""

from __future__ import annotations

from typing import List, Optional

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.drafts.models import Draft
from apps.backend.src.modules.drafts.schemas import DraftIR, DraftOut, DraftSaveRequest
from apps.backend.src.modules.drafts.service import create_draft, update_draft_ir
from apps.backend.src.modules.users.models import User

from .dispatch import TaskContext, orchestrate_flow, runtime_dependency
from .registry import FLOWS, FlowBuilder, operator


class DraftUpdateCommand(BaseModel):
    draft_id: Optional[int] = None
    ir: DraftIR
    title: Optional[str] = None
    tags: Optional[List[str]] = None
    goal: Optional[str] = None
    campaign_id: Optional[int] = None


def _require_identifier(value: Optional[int], name: str) -> int:
    if value is None:
        raise HTTPException(status_code=422, detail=f"{name} is required")
    return value


async def _load_owned_draft(
    db: AsyncSession,
    *,
    draft_id: int,
    owner_user_id: int,
) -> Draft:
    draft = await db.get(Draft, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.user_id != owner_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return draft


@operator(
    key="drafts.create",
    title="Create draft",
    side_effect="write",
)
async def op_create_draft(payload: DraftSaveRequest, ctx: TaskContext) -> DraftOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    draft = await create_draft(
        db,
        user_id=user.id,
        created_by=user.id,
        payload=payload,
    )
    return DraftOut.model_validate(draft)


@operator(
    key="drafts.update_ir",
    title="Update draft content",
    side_effect="write",
)
async def op_update_draft(payload: DraftUpdateCommand, ctx: TaskContext) -> DraftOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    draft_id = _require_identifier(payload.draft_id, "draft_id")
    await _load_owned_draft(db, draft_id=draft_id, owner_user_id=user.id)
    updated = await update_draft_ir(
        db,
        draft_id=draft_id,
        ir=payload.ir,
        title=payload.title,
        tags=payload.tags,
        goal=payload.goal,
        campaign_id=payload.campaign_id,
    )
    return DraftOut.model_validate(updated)


@FLOWS.flow(
    key="drafts.create",
    title="Create Draft",
    input_model=DraftSaveRequest,
    output_model=DraftOut,
    method="post",
    path="/drafts",
    tags=("drafts",),
)
def _flow_create_draft(builder: FlowBuilder):
    task = builder.task("create_draft", "drafts.create")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="drafts.update_ir",
    title="Update Draft",
    input_model=DraftUpdateCommand,
    output_model=DraftOut,
    method="put",
    path="/drafts/{draft_id}/ir",
    tags=("drafts",),
)
def _flow_update_draft(builder: FlowBuilder):
    task = builder.task("update_draft", "drafts.update_ir")
    builder.expect_terminal(task)


router = FLOWS.build_router(
    orchestrate_flow,
    prefix="",
    tags=["drafts"],
    runtime_dependency=runtime_dependency,
    flow_filter=lambda flow: "drafts" in flow.tags,
)


__all__ = ["router"]


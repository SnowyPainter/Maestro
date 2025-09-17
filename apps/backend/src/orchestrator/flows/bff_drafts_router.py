"""BFF read flows for drafts resources."""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException
from pydantic import BaseModel, RootModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.drafts.models import Draft, DraftVariant
from apps.backend.src.modules.drafts.schemas import DraftOut, DraftVariantOut
from apps.backend.src.modules.users.models import User

from apps.backend.src.orchestrator.dispatch import (
    TaskContext,
    orchestrate_flow,
    runtime_dependency,
)
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


class DraftReadPayload(BaseModel):
    draft_id: int


class DraftListPayload(BaseModel):
    campaign_id: Optional[int] = None
    limit: int = 20
    offset: int = 0


class DraftVariantsPayload(BaseModel):
    draft_id: int


class DraftList(RootModel[list[DraftOut]]):
    pass


class DraftVariantList(RootModel[list[DraftVariantOut]]):
    pass


@operator(
    key="bff.drafts.read_draft",
    title="BFF Read Draft",
    side_effect="read",
)
async def op_read_draft(payload: DraftReadPayload, ctx: TaskContext) -> DraftOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    draft = await db.get(Draft, payload.draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return DraftOut.model_validate(draft)


@operator(
    key="bff.drafts.list_drafts",
    title="BFF List Drafts",
    side_effect="read",
)
async def op_list_drafts(payload: DraftListPayload, ctx: TaskContext) -> DraftList:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    stmt = select(Draft).where(Draft.user_id == user.id)
    if payload.campaign_id:
        stmt = stmt.where(Draft.campaign_id == payload.campaign_id)
    stmt = stmt.order_by(Draft.updated_at.desc()).limit(payload.limit).offset(payload.offset)
    drafts = (await db.execute(stmt)).scalars().all()
    items = [DraftOut.model_validate(draft) for draft in drafts]
    return DraftList(root=items)


@operator(
    key="bff.drafts.list_variants",
    title="BFF List Draft Variants",
    side_effect="read",
)
async def op_list_draft_variants(
    payload: DraftVariantsPayload,
    ctx: TaskContext,
) -> DraftVariantList:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    draft = await db.get(Draft, payload.draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    stmt = select(DraftVariant).where(DraftVariant.draft_id == payload.draft_id)
    variants = (await db.execute(stmt)).scalars().all()
    items = [DraftVariantOut.model_validate(variant) for variant in variants]
    return DraftVariantList(root=items)


@FLOWS.flow(
    key="bff.drafts.read_draft",
    title="Get Draft Content",
    description="Retrieve complete draft content and metadata for content editing interface",
    input_model=DraftReadPayload,
    output_model=DraftOut,
    method="get",
    path="/drafts/{draft_id}",
    tags=("bff", "drafts", "content", "read", "ui", "frontend", "editing"),
)
def _flow_bff_read_draft(builder: FlowBuilder):
    task = builder.task("read_draft", "bff.drafts.read_draft")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.drafts.list_drafts",
    title="List All Drafts",
    description="Get paginated list of all content drafts for content management dashboard",
    input_model=DraftListPayload,
    output_model=DraftList,
    method="get",
    path="/drafts",
    tags=("bff", "drafts", "content", "list", "ui", "frontend", "dashboard", "pagination"),
)
def _flow_bff_list_drafts(builder: FlowBuilder):
    task = builder.task("list_drafts", "bff.drafts.list_drafts")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.drafts.list_variants",
    title="Get Draft Variants",
    description="List all variants of a draft for content optimization and A/B testing",
    input_model=DraftVariantsPayload,
    output_model=DraftVariantList,
    method="get",
    path="/drafts/{draft_id}/variants",
    tags=("bff", "drafts", "content", "variants", "list", "ui", "frontend", "optimization", "ab-testing"),
)
def _flow_bff_list_draft_variants(builder: FlowBuilder):
    task = builder.task("list_draft_variants", "bff.drafts.list_variants")
    builder.expect_terminal(task)


__all__ = []


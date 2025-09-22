"""BFF read flows for drafts resources."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException
from pydantic import BaseModel, RootModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.backend.src.modules.adapters.core.types import (
    RenderedMetrics,
    RenderedVariantBlocks,
)
from apps.backend.src.modules.common.enums import PlatformKind, PostStatus
from apps.backend.src.modules.drafts.models import Draft, DraftVariant
from apps.backend.src.modules.drafts.schemas import DraftOut, PostPublicationOut
from apps.backend.src.modules.drafts.service import (
    get_draft_for_user,
    get_draft_variant,
    list_draft_variants,
    list_draft_variants_by_platform,
    list_post_publications_by_variant,
    list_post_publications_by_platform,
    list_post_publications_by_status,
    list_post_publications_by_account_persona,
)
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

class DraftVariantsByPlatformPayload(BaseModel):
    platform: PlatformKind

class DraftVariantDetailPayload(BaseModel):
    draft_id: int
    platform: PlatformKind

class DraftVariantByIdPayload(BaseModel):
    variant_id: int

class DraftList(RootModel[list[DraftOut]]):
    pass

class DraftPostPublicationsPayload(BaseModel):
    account_persona_id: int

class DraftPostPublicationsByVariantPayload(DraftPostPublicationsPayload):
    variant_id: int

class DraftPostPublicationsByPlatformPayload(DraftPostPublicationsPayload):
    platform: List[PlatformKind]

class DraftPostPublicationsByStatusPayload(DraftPostPublicationsPayload):
    status: List[PostStatus]

class DraftPostPublicationsList(RootModel[list[PostPublicationOut]]):
    pass


def _parse_persona_account_id(ctx: TaskContext) -> Optional[int]:
    raw = ctx.optional(str, name="persona_account_id")
    if raw is None:
        return None
    try:
        value = int(raw)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid persona account context") from exc
    if value <= 0:
        raise HTTPException(status_code=400, detail="Invalid persona account context")
    return value


class DraftVariantRender(BaseModel):
    variant_id: int
    draft_id: int
    platform: str
    status: str
    compiled_at: Optional[datetime] = None
    rendered_caption: Optional[str] = None
    rendered_blocks: Optional[RenderedVariantBlocks] = None
    warnings: Optional[list[str]] = None
    errors: Optional[list[str]] = None
    metrics: Optional[RenderedMetrics] = None
    compiler_version: int
    ir_revision_compiled: Optional[int] = None
    post_publication_id: Optional[int] = None
    post_publication_status: Optional[str] = None
    post_publication_scheduled_at: Optional[datetime] = None

    @classmethod
    def from_model(
        cls,
        variant: DraftVariant,
        *,
        persona_account_id: Optional[int] = None,
    ) -> "DraftVariantRender":
        publication = None
        if persona_account_id is not None:
            for candidate in variant.publications or []:
                if candidate.account_persona_id == persona_account_id:
                    publication = candidate
                    break
        return cls(
            variant_id=variant.id,
            draft_id=variant.draft_id,
            platform=variant.platform.value,
            status=variant.status.value,
            compiled_at=variant.compiled_at,
            rendered_caption=variant.rendered_caption,
            rendered_blocks=variant.rendered_blocks,
            warnings=variant.warnings or None,
            errors=variant.errors or None,
            metrics=variant.metrics or None,
            compiler_version=variant.compiler_version,
            ir_revision_compiled=variant.ir_revision_compiled,
            post_publication_id=publication.id if publication else None,
            post_publication_status=publication.status.value if publication else None,
            post_publication_scheduled_at=publication.scheduled_at if publication else None,
        )


class DraftVariantRenderList(RootModel[list[DraftVariantRender]]):
    pass


class DraftVariantRenderDetail(DraftVariantRender):
    pass


@operator(
    key="bff.drafts.read_draft",
    title="BFF Read Draft",
    side_effect="read",
)
async def op_read_draft(payload: DraftReadPayload, ctx: TaskContext) -> DraftOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    try:
        draft = await get_draft_for_user(
            db,
            draft_id=payload.draft_id,
            user_id=user.id,
        )
    except PermissionError as exc:  # pragma: no cover - thin authorization guard
        raise HTTPException(status_code=403, detail="Not authorized") from exc
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
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
) -> DraftVariantRenderList:
    persona_account_id = _parse_persona_account_id(ctx)
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    try:
        draft = await get_draft_for_user(
            db,
            draft_id=payload.draft_id,
            user_id=user.id,
        )
    except PermissionError as exc:  # pragma: no cover - thin authorization guard
        raise HTTPException(status_code=403, detail="Not authorized") from exc

    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    variants = await list_draft_variants(
        db,
        draft_id=draft.id,
        user_id=user.id,
        draft=draft,
    )
    items = [
        DraftVariantRender.from_model(variant, persona_account_id=persona_account_id)
        for variant in variants
    ]
    return DraftVariantRenderList(root=items)

@operator(
    key="bff.drafts.list_variants_by_platform",
    title="BFF List Draft Variants by Platform",
    side_effect="read",
)
async def op_list_draft_variants_by_platform(
    payload: DraftVariantsByPlatformPayload,
    ctx: TaskContext,
) -> DraftVariantRenderList:
    persona_account_id = _parse_persona_account_id(ctx)
    
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    variants = await list_draft_variants_by_platform(
        db,
        user_id=user.id,
        platform=payload.platform,
    )
    return DraftVariantRenderList(
        root=[
            DraftVariantRender.from_model(variant, persona_account_id=persona_account_id)
            for variant in variants
        ]
    )

@operator(
    key="bff.drafts.read_variant",
    title="BFF Read Draft Variant Detail",
    side_effect="read",
)
async def op_read_draft_variant(
    payload: DraftVariantDetailPayload,
    ctx: TaskContext,
) -> DraftVariantRenderDetail:
    persona_account_id = _parse_persona_account_id(ctx)
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    try:
        draft = await get_draft_for_user(
            db,
            draft_id=payload.draft_id,
            user_id=user.id,
        )
    except PermissionError as exc:  # pragma: no cover - thin authorization guard
        raise HTTPException(status_code=403, detail="Not authorized") from exc

    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    variant = await get_draft_variant(
        db,
        draft_id=draft.id,
        user_id=user.id,
        platform=payload.platform,
        draft=draft,
    )
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    return DraftVariantRenderDetail.from_model(
        variant,
        persona_account_id=persona_account_id,
    )


@operator(
    key="bff.drafts.read_variant_by_id",
    title="BFF Read Draft Variant by Variant ID",
    side_effect="read",
)
async def op_read_draft_variant_by_id(
    payload: DraftVariantByIdPayload,
    ctx: TaskContext,
) -> DraftVariantRenderDetail:
    persona_account_id = _parse_persona_account_id(ctx)
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    # Get variant by ID with draft ownership check and eager load publications
    stmt = (
        select(DraftVariant)
        .join(Draft, DraftVariant.draft_id == Draft.id)
        .where(DraftVariant.id == payload.variant_id)
        .where(Draft.user_id == user.id)
        .options(selectinload(DraftVariant.publications))
    )
    variant = (await db.execute(stmt)).scalar_one_or_none()

    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    return DraftVariantRenderDetail.from_model(
        variant,
        persona_account_id=persona_account_id,
    )

@operator(
    key="bff.drafts.list_post_publications_by_variant",
    title="BFF List Post Publications by Variant",
    side_effect="read",
)
async def op_list_post_publications_by_variant(
    payload: DraftPostPublicationsByVariantPayload,
    ctx: TaskContext,
) -> DraftPostPublicationsList:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    publications = await list_post_publications_by_variant(
        db,
        variant_id=payload.variant_id,
        account_persona_id=payload.account_persona_id,
    )
    return DraftPostPublicationsList(root=[PostPublicationOut.model_validate(publication) for publication in publications])

@operator(
    key="bff.drafts.list_post_publications_by_platform",
    title="BFF List Post Publications by Platform",
    side_effect="read",
)
async def op_list_post_publications_by_platform(
    payload: DraftPostPublicationsByPlatformPayload,
    ctx: TaskContext,
) -> DraftPostPublicationsList:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    publications = await list_post_publications_by_platform(
        db,
        account_persona_id=payload.account_persona_id,
        platform=payload.platform,
    )
    return DraftPostPublicationsList(root=[PostPublicationOut.model_validate(publication) for publication in publications])

@operator(
    key="bff.drafts.list_post_publications_by_status",
    title="BFF List Post Publications by Status",
    side_effect="read",
)
async def op_list_post_publications_by_status(
    payload: DraftPostPublicationsByStatusPayload,
    ctx: TaskContext,
) -> DraftPostPublicationsList:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    publications = await list_post_publications_by_status(
        db,
        account_persona_id=payload.account_persona_id,
        status=payload.status,
    )
    return DraftPostPublicationsList(root=[PostPublicationOut.model_validate(publication) for publication in publications])

"""
Payload 중 query string으로 불가한 것은 bff에서 불가피하게 post 요청
"""

@FLOWS.flow(
    key="bff.drafts.list_post_publications_by_variant",
    title="List Post Publications by Variant",
    description="List all post publications for a specific variant",
    input_model=DraftPostPublicationsByVariantPayload,
    output_model=DraftPostPublicationsList,
    method="post",
    path="/drafts/post-publications/variant",
    tags=("bff", "drafts", "content", "post-publications", "list", "by variant"),
)
def _flow_bff_list_post_publications_by_variant(builder: FlowBuilder):
    task = builder.task("list_post_publications_by_variant", "bff.drafts.list_post_publications_by_variant")
    builder.expect_terminal(task)

@FLOWS.flow(
    key="bff.drafts.list_post_publications_by_platform",
    title="List Post Publications by Platform",
    description="List all post publications for a specific platform",
    input_model=DraftPostPublicationsByPlatformPayload,
    output_model=DraftPostPublicationsList,
    method="post",
    path="/drafts/post-publications/platform",
    tags=("bff", "drafts", "content", "post-publications", "list", "by platform"),
)
def _flow_bff_list_post_publications_by_platform(builder: FlowBuilder):
    task = builder.task("list_post_publications_by_platform", "bff.drafts.list_post_publications_by_platform")
    builder.expect_terminal(task)

@FLOWS.flow(
    key="bff.drafts.list_post_publications_by_status",
    title="List Post Publications by Status",
    description="List all post publications for a specific status",
    input_model=DraftPostPublicationsByStatusPayload,
    output_model=DraftPostPublicationsList,
    method="post",
    path="/drafts/post-publications/status",
    tags=("bff", "drafts", "content", "post-publications", "list", "by status"),
)
def _flow_bff_list_post_publications_by_status(builder: FlowBuilder):
    task = builder.task("list_post_publications_by_status", "bff.drafts.list_post_publications_by_status")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.drafts.list_variants_by_platform",
    title="List Draft Variants by Platform",
    description="List all variants of a draft for a specific platform",
    input_model=DraftVariantsByPlatformPayload,
    output_model=DraftVariantRenderList,
    method="get",
    path="/drafts/platform/{platform}",
    tags=("bff", "drafts", "content", "variants", "list", "by platform"),
)
def _flow_bff_list_draft_variants_by_platform(builder: FlowBuilder):
    task = builder.task("list_draft_variants_by_platform", "bff.drafts.list_variants_by_platform")
    builder.expect_terminal(task)

@FLOWS.flow(
    key="bff.drafts.list_variants",
    title="Get Draft Variants",
    description="List all variants of a draft for content optimization and A/B testing",
    input_model=DraftVariantsPayload,
    output_model=DraftVariantRenderList,
    method="get",
    path="/drafts/{draft_id}/variants",
    tags=("bff", "drafts", "content", "variants", "list", "ui", "frontend", "optimization", "ab-testing"),
)
def _flow_bff_list_draft_variants(builder: FlowBuilder):
    task = builder.task("list_draft_variants", "bff.drafts.list_variants")
    builder.expect_terminal(task)

@FLOWS.flow(
    key="bff.drafts.read_variant",
    title="Get Draft Variant Detail",
    description="Retrieve rendered payload for a specific platform variant",
    input_model=DraftVariantDetailPayload,
    output_model=DraftVariantRenderDetail,
    method="get",
    path="/drafts/{draft_id}/variants/{platform}",
    tags=("bff", "drafts", "content", "variant", "detail", "ui", "frontend"),
)
def _flow_bff_read_draft_variant(builder: FlowBuilder):
    task = builder.task("read_draft_variant", "bff.drafts.read_variant")
    builder.expect_terminal(task)

@FLOWS.flow(
    key="bff.drafts.read_variant_by_id",
    title="Get Draft Variant by ID",
    description="Retrieve rendered payload for a variant by its ID",
    input_model=DraftVariantByIdPayload,
    output_model=DraftVariantRenderDetail,
    method="get",
    path="/drafts/variants/{variant_id}",
    tags=("bff", "drafts", "content", "variant", "detail", "ui", "frontend"),
)
def _flow_bff_read_draft_variant_by_id(builder: FlowBuilder):
    task = builder.task("read_draft_variant_by_id", "bff.drafts.read_variant_by_id")
    builder.expect_terminal(task)

@FLOWS.flow(
    key="bff.drafts.read_draft",
    title="Get Draft Content",
    description="Show the draft content",
    input_model=DraftReadPayload,
    output_model=DraftOut,
    method="get",
    path="/drafts/{draft_id}",
    tags=("bff", "drafts", "content", "read", "get", "one"),
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

__all__ = []

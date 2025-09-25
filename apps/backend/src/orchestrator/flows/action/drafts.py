"""Draft orchestration flows."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.backend.src.modules.accounts.models import PlatformAccount, PersonaAccount
from apps.backend.src.modules.common.enums import PlatformKind, PostStatus, VariantStatus
from apps.backend.src.modules.drafts.models import Draft, DraftVariant, PostPublication
from apps.backend.src.modules.drafts.schemas import (
    DraftIR,
    DraftOut,
    DraftSaveRequest,
    DraftDeleteCommand,
    PostPublicationOut,
)
from apps.backend.src.modules.drafts.service import (
    create_draft,
    delete_draft,
    cancel_post_publication,
    ensure_publication_schedule,
    get_draft_variant,
    remove_publication_schedule,
    upsert_post_publication_schedule,
    update_draft_ir,
)
from apps.backend.src.modules.users.models import User

from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator
from apps.backend.src.workers.Adapter.tasks import publish_variant_with_adapter


class MessageOut(BaseModel):
    message: str


class DraftUpdateCommand(BaseModel):
    draft_id: Optional[int] = None
    ir: DraftIR
    title: Optional[str] = None
    tags: Optional[List[str]] = None
    goal: Optional[str] = None
    campaign_id: Optional[int] = None


class DraftVariantReadyCommand(BaseModel):
    draft_id: Optional[int] = None
    platform: PlatformKind
    ready: bool
    scheduled_at: Optional[datetime] = None


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
    key="drafts.toggle_ready",
    title="Toggle Ready For Post",
    side_effect="write",
)
async def op_toggle_ready_for_post(
    payload: DraftVariantReadyCommand,
    ctx: TaskContext,
) -> PostPublicationOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    persona_raw = ctx.optional(str, name="persona_account_id")
    if not persona_raw:
        raise HTTPException(status_code=400, detail="Persona account context required")
    try:
        persona_account_id = int(persona_raw)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid persona account context") from exc
    if persona_account_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid persona account context")

    draft_id = _require_identifier(payload.draft_id, "draft_id")
    draft = await _load_owned_draft(db, draft_id=draft_id, owner_user_id=user.id)

    variant = await get_draft_variant(
        db,
        draft_id=draft.id,
        user_id=user.id,
        platform=payload.platform,
        draft=draft,
    )
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    try:
        if payload.ready:
            if payload.scheduled_at is None:
                raise HTTPException(status_code=422, detail="scheduled_at is required when ready is true")
            publication = await upsert_post_publication_schedule(
                db,
                variant=variant,
                persona_account_id=persona_account_id,
                scheduled_at=payload.scheduled_at,
                owner_user_id=user.id,
            )
            await ensure_publication_schedule(
                db,
                publication=publication,
                variant=variant,
                persona_account_id=persona_account_id,
                scheduled_at=payload.scheduled_at,
            )
        else:
            publication = await cancel_post_publication(
                db,
                variant=variant,
                persona_account_id=persona_account_id,
                owner_user_id=user.id,
            )
            await remove_publication_schedule(
                db,
                publication=publication,
            )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await db.commit()
    await db.refresh(publication)
    return PostPublicationOut.model_validate(publication)


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

@operator(
    key="drafts.delete",
    title="Delete Draft",
    side_effect="write",
)
async def op_delete_draft(payload: DraftDeleteCommand, ctx: TaskContext) -> MessageOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    draft_id = _require_identifier(payload.draft_id, "draft_id")
    await _load_owned_draft(db, draft_id=draft_id, owner_user_id=user.id)
    await delete_draft(db, draft_id=draft_id)
    return MessageOut(message="Draft deleted successfully")

@FLOWS.flow(
    key="drafts.create",
    title="Create Content Draft",
    description="Start a new content draft with initial parameters and metadata",
    input_model=DraftSaveRequest,
    output_model=DraftOut,
    method="post",
    path="/drafts",
    tags=("action", "drafts", "content", "create", "writing"),
)
def _flow_create_draft(builder: FlowBuilder):
    task = builder.task("create_draft", "drafts.create")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="drafts.update_ir",
    title="Update Draft Content",
    description="Modify the content and structure of an existing draft",
    input_model=DraftUpdateCommand,
    output_model=DraftOut,
    method="put",
    path="/drafts/{draft_id}/ir",
    tags=("action", "drafts", "content", "update", "writing", "editing"),
)
def _flow_update_draft(builder: FlowBuilder):
    task = builder.task("update_draft", "drafts.update_ir")
    builder.expect_terminal(task)

@FLOWS.flow(
    key="drafts.delete",
    title="Delete Draft",
    description="Delete an existing draft",
    input_model=DraftDeleteCommand,
    output_model=MessageOut,
    method="delete",
    path="/drafts/{draft_id}",
    tags=("action", "drafts", "content", "delete", "writing", "editing"),
)
def _flow_delete_draft(builder: FlowBuilder):
    task = builder.task("delete_draft", "drafts.delete")
    builder.expect_terminal(task)


class PublishVariantPayload(BaseModel):
    post_publication_id: int
    persona_account_id: int


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _load_publication(
    db: AsyncSession,
    *,
    post_publication_id: int,
    persona_account_id: int,
) -> PostPublication:
    stmt = (
        select(PostPublication)
        .where(PostPublication.id == post_publication_id)
        .options(
            selectinload(PostPublication.variant),
            selectinload(PostPublication.persona_account),
        )
    )
    publication = (await db.execute(stmt)).scalar_one_or_none()
    if publication is None:
        raise HTTPException(status_code=404, detail="post_publication not found")
    if publication.persona_account_id != persona_account_id:
        raise HTTPException(status_code=403, detail="persona account mismatch")
    if publication.variant is None:
        raise HTTPException(status_code=400, detail="variant missing for publication")
    return publication


async def _load_platform_account(
    db: AsyncSession,
    persona_account: PersonaAccount,
) -> PlatformAccount:
    platform = await db.get(PlatformAccount, persona_account.account_id)
    if platform is None:
        raise HTTPException(status_code=404, detail="platform account not found")
    if not platform.access_token:
        raise HTTPException(status_code=400, detail="platform account missing access token")
    return platform


def _prepare_credentials(platform: PlatformAccount) -> Dict[str, str | None]:
    return {
        "access_token": platform.access_token,
        "user_id": platform.external_id,
    }


@operator(
    key="drafts.publish_variant",
    title="Publish Draft Variant",
    side_effect="write",
)
async def op_publish_variant(
    payload: PublishVariantPayload,
    ctx: TaskContext,
) -> PostPublicationOut:
    db: AsyncSession = ctx.require(AsyncSession)

    publication = await _load_publication(
        db,
        post_publication_id=payload.post_publication_id,
        persona_account_id=payload.persona_account_id,
    )
    variant: DraftVariant = publication.variant  # type: ignore[assignment]

    if variant.status in {VariantStatus.PENDING, VariantStatus.INVALID} or not variant.rendered_blocks:
        raise HTTPException(status_code=409, detail="variant not ready for publishing")

    persona_account = publication.persona_account
    if persona_account is None:
        raise HTTPException(status_code=404, detail="persona account missing")

    platform_account = await _load_platform_account(db, persona_account)

    credentials = _prepare_credentials(platform_account)
    publish_result = await publish_variant_with_adapter(
        platform=publication.platform,
        rendered_blocks=variant.rendered_blocks,
        caption=variant.rendered_caption,
        credentials=credentials,
        options=(publication.meta or {}).get("publish_options") if publication.meta else None,
    )

    publication.updated_at = _now()
    if publish_result.ok:
        publication.status = PostStatus.PUBLISHED
        publication.published_at = publication.updated_at
        publication.external_id = publish_result.external_id
        if publication.external_id and publication.external_id.startswith("http"):
            publication.permalink = publication.external_id
        publication.errors = None
        publication.warnings = publish_result.warnings or None
    else:
        publication.status = PostStatus.FAILED
        publication.errors = publish_result.errors or ["publish_failed"]
        publication.warnings = publish_result.warnings or None
        await db.flush()
        await db.commit()
        raise HTTPException(
            status_code=500,
            detail="; ".join(publication.errors or ["publish_failed"]),
        )

    await db.flush()
    await db.commit()
    await db.refresh(publication)
    return PostPublicationOut.model_validate(publication)


@FLOWS.flow(
    key="drafts.toggle_ready",
    title="Toggle Ready For Post",
    description="Mark or unmark a draft variant as ready for publishing with scheduling",
    input_model=DraftVariantReadyCommand,
    output_model=PostPublicationOut,
    method="put",
    path="/drafts/variants/ready",
    tags=("action", "drafts", "variants", "publication", "schedule"),
)
def _flow_toggle_ready_for_post(builder: FlowBuilder):
    task = builder.task("toggle_ready_for_post", "drafts.toggle_ready")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="drafts.publish_variant",
    title="Publish Scheduled Variant",
    description="Execute a scheduled publish for a draft variant",
    input_model=PublishVariantPayload,
    output_model=PostPublicationOut,
    method="post",
    path="/drafts/variants/publish",
    tags=("action", "drafts", "variants", "publication", "schedule"),
)
def _flow_publish_variant(builder: FlowBuilder):
    task = builder.task("publish_variant", "drafts.publish_variant")
    builder.expect_terminal(task)

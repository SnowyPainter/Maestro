from __future__ import annotations


from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from apps.backend.src.modules.drafts.service import (
    _now,
    _load_owned_draft,
    ensure_publication_schedule,
    get_draft_variant,
    upsert_post_publication_schedule,
)
from apps.backend.src.modules.drafts.schemas import PostPublicationOut
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator
from apps.backend.src.modules.scheduler.schemas import CreatePostScheduleCommand

@operator(
    key="internal.drafts.create_post_schedule",
    title="Create Post Schedule",
    side_effect="write",
)
async def op_create_post_schedule(
    payload: CreatePostScheduleCommand,
    ctx: TaskContext,
) -> PostPublicationOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    draft = await _load_owned_draft(db, variant_id=payload.variant_id, owner_user_id=user.id)

    variant = await get_draft_variant(
        db,
        draft_id=draft.id,
        user_id=user.id,
        platform=payload.platform,
        draft=draft,
    )
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    scheduled_at = payload.scheduled_at or _now()

    try:
        publication = await upsert_post_publication_schedule(
            db,
            variant=variant,
            persona_account_id=payload.persona_account_id,
            scheduled_at=scheduled_at,
            owner_user_id=user.id,
        )
        await ensure_publication_schedule(
            db,
            publication=publication,
            variant=variant,
            persona_account_id=payload.persona_account_id,
            scheduled_at=scheduled_at,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await db.commit()
    await db.refresh(publication)
    return PostPublicationOut.model_validate(publication)

@FLOWS.flow(
    key="internal.drafts.create_post_schedule",
    title="Create Post Schedule",
    description="Create or update a post publication schedule for the given draft variant",
    input_model=CreatePostScheduleCommand,
    output_model=PostPublicationOut,
    method="post",
    path="/internal/drafts/post/create",
    tags=("internal", "drafts", "publication"),
)
def _flow_create_post_schedule(builder: FlowBuilder):
    task = builder.task("create_post_schedule", "internal.drafts.create_post_schedule")
    builder.expect_terminal(task)
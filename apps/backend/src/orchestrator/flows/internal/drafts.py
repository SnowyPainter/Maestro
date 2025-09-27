from __future__ import annotations


from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.accounts.models import PlatformAccount
from apps.backend.src.modules.common.enums import ALREADY_PUBLISHED_STATUS, PostStatus
from apps.backend.src.modules.drafts.models import PostPublication
from apps.backend.src.modules.drafts.service import (
    _now,
    _load_owned_draft,
    _load_persona_account_for_user,
)
from apps.backend.src.modules.drafts.schemas import PostPublicationOut
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator
from apps.backend.src.modules.scheduler.schemas import PostPublishTemplateParams
from apps.backend.src.workers.Adapter.tasks import publish_variant_with_adapter

def _build_adapter_credentials(account: PlatformAccount) -> dict:
    credentials: dict[str, object] = {}
    if account.access_token:
        credentials["access_token"] = account.access_token
    if account.refresh_token:
        credentials["refresh_token"] = account.refresh_token
    if account.external_id:
        credentials["external_id"] = account.external_id
        credentials.setdefault("threads_user_id", account.external_id)
        credentials.setdefault("user_id", account.external_id)
    if account.handle:
        credentials["handle"] = account.handle
    if account.token_expires_at:
        credentials["token_expires_at"] = account.token_expires_at.isoformat()
    if account.scopes:
        credentials["scopes"] = account.scopes
    return credentials


def _strip_schedule_meta(meta: dict | None) -> dict | None:
    if not meta:
        return None
    cleaned = dict(meta)
    cleaned.pop("schedule_id", None)
    cleaned.pop("scheduled_at", None)
    cleaned.pop("schedule_label", None)
    return cleaned or None

@operator(
    key="internal.drafts.publish",
    title="Publish Draft Variant",
    side_effect="write",
)
async def op_publish_post(
    payload: PostPublishTemplateParams,
    ctx: TaskContext,
) -> PostPublicationOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User | None = ctx.optional(User)
    schedule_context = ctx.optional(dict, name="schedule_context") or {}

    owner_user_id = user.id if user else schedule_context.get("user_id")
    try:
        owner_user_id = int(owner_user_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Owner user context missing") from None

    variant = await _load_owned_draft(
        db,
        variant_id=payload.variant_id,
        owner_user_id=owner_user_id,
    )

    if variant.platform != payload.platform:
        raise HTTPException(status_code=404, detail="Variant not found for platform")

    publication = await db.get(PostPublication, payload.post_publication_id)
    if publication is None:
        raise HTTPException(status_code=404, detail="Publication not found")
    if publication.variant_id != variant.id or publication.account_persona_id != payload.persona_account_id:
        raise HTTPException(status_code=404, detail="Publication mismatch")
    if publication.status in ALREADY_PUBLISHED_STATUS:
        raise HTTPException(status_code=409, detail="Publication already published")

    try:
        persona_account = await _load_persona_account_for_user(
            db,
            persona_account_id=payload.persona_account_id,
            owner_user_id=owner_user_id,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    account = await db.get(PlatformAccount, persona_account.account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Platform account not found")
    if account.platform != payload.platform:
        raise HTTPException(status_code=400, detail="Persona account platform mismatch")

    if not variant.rendered_caption and not variant.rendered_blocks:
        raise HTTPException(status_code=409, detail="Variant has no rendered content")

    credentials = _build_adapter_credentials(account)
    if "access_token" not in credentials:
        raise HTTPException(status_code=400, detail="Persona account missing access token")

    meta = dict(publication.meta or {})
    publish_options = meta.get("publish_options")
    if not isinstance(publish_options, dict):
        publish_options = meta.get("options") if isinstance(meta.get("options"), dict) else None

    try:
        result = await publish_variant_with_adapter(
            platform=payload.platform,
            rendered_blocks=variant.rendered_blocks,
            caption=variant.rendered_caption,
            credentials=credentials,
            options=publish_options,
        )
    except Exception as exc:  # pragma: no cover - defensive fallback
        publication.status = PostStatus.FAILED
        publication.errors = [f"adapter error: {exc}"]
        publication.warnings = None
        publication.published_at = None
        publication.meta = _strip_schedule_meta(meta)
        publication.updated_at = _now()
        db.add(publication)
        await db.flush()
        await db.commit()
        raise HTTPException(status_code=502, detail="Adapter publish failed") from exc

    publication.meta = _strip_schedule_meta(meta)
    publication.warnings = result.warnings or None
    publication.updated_at = _now()

    if result.ok:
        publication.status = PostStatus.PUBLISHED
        publication.published_at = _now()
        publication.scheduled_at = None
        publication.external_id = result.external_id
        publication.errors = None
    else:
        publication.status = PostStatus.FAILED
        publication.errors = result.errors or ["publish failed"]
        publication.published_at = None

    db.add(publication)
    await db.flush()
    await db.commit()

    if not result.ok:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Publish failed",
                "errors": publication.errors,
            },
        )

    await db.refresh(publication)
    return PostPublicationOut.model_validate(publication)


@FLOWS.flow(
    key="internal.drafts.publish",
    title="Publish Draft Variant",
    description="Publish a draft variant using the linked platform adapter",
    input_model=PostPublishTemplateParams,
    output_model=PostPublicationOut,
    method="post",
    path="/internal/drafts/post/publish",
    tags=("internal", "drafts", "publication"),
)
def _flow_publish_post(builder: FlowBuilder):
    task = builder.task("publish", "internal.drafts.publish")
    builder.expect_terminal(task)

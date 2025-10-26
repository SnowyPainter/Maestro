from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Iterable, Optional, Union

from apps.backend.src.core.celery_app import celery_app
from celery import shared_task
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from apps.backend.src.core.config import settings
from apps.backend.src.modules.common.enums import (
    PlatformKind,
    ReactionActionStatus,
    ReactionActionType,
    VariantStatus,
)
from apps.backend.src.modules.accounts.models import Persona, PersonaAccount
from apps.backend.src.modules.drafts.models import Draft, DraftVariant
from apps.backend.src.modules.adapters.service import compile_variant
from apps.backend.src.core.context import get_persona_account_id
from apps.backend.src.modules.adapters.registry import ADAPTER_REGISTRY
from apps.backend.src.modules.adapters.core.types import (
    MessageSendResult,
    MetricsResult,
    PublishResult,
    RenderedVariantBlocks,
)
from apps.backend.src.modules.reactive.models import ReactionActionLog
from apps.backend.src.modules.insights.models import InsightComment
from apps.backend.src.modules.accounts.models import PlatformAccount
from sqlalchemy.exc import IntegrityError

_ENGINE = create_engine(settings.SYNC_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=_ENGINE, autocommit=False, autoflush=False)


def _parse_int(value: Optional[str]) -> Optional[int]:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _load_persona(session, persona_account_id: Optional[int]) -> Optional[Persona]:
    if persona_account_id is None:
        return None

    persona_account = session.get(PersonaAccount, persona_account_id)
    return persona_account.persona if persona_account else None


def _load_persona_account_with_platform(session, persona_account_id: int) -> tuple[Optional[PersonaAccount], Optional[PlatformAccount]]:
    if persona_account_id is None:
        return None, None
    persona_account = session.get(PersonaAccount, persona_account_id)
    if not persona_account:
        return None, None
    platform_account = session.get(PlatformAccount, persona_account.account_id)
    return persona_account, platform_account


def _get_or_create_reaction_log(
    session,
    *,
    insight_comment_id: int,
    reaction_rule_id: Optional[int],
    tag_key: str,
    action_type: ReactionActionType,
    payload: Optional[dict] = None,
) -> ReactionActionLog:
    stmt = (
        select(ReactionActionLog)
        .where(
            ReactionActionLog.insight_comment_id == insight_comment_id,
            ReactionActionLog.tag_key == tag_key,
            ReactionActionLog.action_type == action_type,
        )
        .limit(1)
    )
    log = session.execute(stmt).scalar_one_or_none()
    if log:
        return log

    log = ReactionActionLog(
        insight_comment_id=insight_comment_id,
        reaction_rule_id=reaction_rule_id,
        tag_key=tag_key,
        action_type=action_type,
        status=ReactionActionStatus.PENDING,
        payload=payload,
    )
    session.add(log)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        # Another worker inserted the log concurrently; fetch it.
        log = session.execute(stmt).scalar_one_or_none()
        if log:
            return log
        raise
    session.refresh(log)
    return log


def _mark_reaction_log(
    session,
    *,
    log: ReactionActionLog,
    status: ReactionActionStatus,
    payload: Optional[dict] = None,
    error: Optional[str] = None,
) -> None:
    log.status = status
    log.payload = payload
    log.error = error
    log.executed_at = datetime.now(timezone.utc)
    session.add(log)
    session.commit()
    session.refresh(log)

def _is_dm_window_closed(result: MessageSendResult) -> bool:
    if not isinstance(result, MessageSendResult):
        return False
    candidates = list(result.errors or [])
    raw = result.raw or {}
    for value in raw.values():
        if isinstance(value, str):
            candidates.append(value)
        elif isinstance(value, list):
            candidates.extend(str(item) for item in value if item is not None)
    for error in candidates:
        if not isinstance(error, str):
            continue
        lowered = error.lower()
        if "허용되는 창" in error:
            return True
        if "outside the allowed window" in lowered:
            return True
        if "subcode=2534022" in lowered or "2534022" in lowered:
            return True
        if "subcode=33" in lowered:
            return True
    return False

def enqueue_variant_compile(
    *,
    draft_id: int,
    variant_id: int,
    injector_names: Optional[Iterable[str]] = None,
) -> None:
    names = list(injector_names) if injector_names is not None else None
    compile_draft_variant.delay(
        draft_id=draft_id,
        variant_id=variant_id,
        injector_names=names,
    )


@celery_app.task(
    name="apps.backend.src.workers.Adapter.tasks.compile_draft_variant",
    queue="adapter",
    bind=True,
    max_retries=3,
)
def compile_draft_variant(
    self,
    *,
    draft_id: int,
    variant_id: int,
    injector_names: Optional[list[str]] = None,
):
    """Compile a single draft variant using adapter pipeline."""

    with SessionLocal() as session:
        draft: Union[Draft, None] = session.get(Draft, draft_id)
        variant: Union[DraftVariant, None] = session.get(DraftVariant, variant_id)

        if draft is None or variant is None:
            return {
                "ok": False,
                "reason": "not_found",
                "draft_id": draft_id,
                "variant_id": variant_id,
            }
        
        persona_account_id = _parse_int(get_persona_account_id())
        persona = _load_persona(session, persona_account_id)

        try:
            result = asyncio.run(
                compile_variant(
                    ir=draft.ir,
                    platform=variant.platform,
                    ir_revision=draft.ir_revision,
                    persona=persona,
                    injector_names=injector_names,
                )
            )
        except Exception as exc:  # pragma: no cover - defensive fallback
            variant.errors = [f"Compilation failed: {exc}"]
            variant.status = VariantStatus.INVALID
            variant.compiled_at = datetime.now(timezone.utc)
            variant.ir_revision_compiled = draft.ir_revision
            session.add(variant)
            session.commit()
            return {
                "ok": False,
                "reason": "compile_error",
                "draft_id": draft_id,
                "variant_id": variant_id,
                "error": str(exc),
            }
        
        from apps.backend.src.modules.drafts.service import apply_compile_result_to_variant
        apply_compile_result_to_variant(variant, result)
        session.add(variant)
        session.commit()

        return {
            "ok": True,
            "draft_id": draft_id,
            "variant_id": variant_id,
            "status": variant.status.value,
        }


async def publish_variant_with_adapter(
    *,
    platform: PlatformKind,
    rendered_blocks: RenderedVariantBlocks | None,
    caption: Optional[str],
    credentials: dict,
    options: Optional[dict] = None,
) -> PublishResult:
    """Publish a rendered variant using the registered adapter.

    This helper wraps the adapter registry so other modules (e.g. orchestrator
    operators) do not need to instantiate adapters directly.
    """

    adapter = ADAPTER_REGISTRY.create_instance(platform)
    return await adapter.publish(
        rendered_blocks,
        caption,
        credentials=credentials,
        options=options,
    )

async def sync_metrics_with_adapter(
    *,
    platform: PlatformKind,
    external_id: str,
    credentials: dict,
) -> MetricsResult:
    adapter = ADAPTER_REGISTRY.create_instance(platform)
    return await adapter.sync_metrics(external_id, credentials=credentials)


@celery_app.task(
    name="apps.backend.src.workers.Adapter.tasks.reactive_reply_to_comment",
    queue="coworker",
    bind=True
)
def reactive_reply_to_comment(
    self,
    *,
    insight_comment_id: int,
    persona_account_id: int,
    reaction_rule_id: Optional[int],
    tag_key: str,
    message: str,
    metadata: Optional[dict] = None,
):
    """Post a reply to a comment while guarding against duplicate replies."""

    with SessionLocal() as session:
        comment: InsightComment | None = session.get(InsightComment, insight_comment_id)
        if comment is None:
            return {
                "ok": False,
                "reason": "comment_not_found",
                "insight_comment_id": insight_comment_id,
            }

        log = _get_or_create_reaction_log(
            session,
            insight_comment_id=insight_comment_id,
            reaction_rule_id=reaction_rule_id,
            tag_key=tag_key,
            action_type=ReactionActionType.REPLY,
            payload={"message": message, "metadata": metadata},
        )

        if log.status == ReactionActionStatus.SUCCESS:
            return {
                "ok": True,
                "skipped": True,
                "reason": "already_executed",
            }

        if comment.is_owned_by_me:
            _mark_reaction_log(
                session,
                log=log,
                status=ReactionActionStatus.SKIPPED,
                error="comment_authored_by_me",
            )
            return {
                "ok": True,
                "skipped": True,
                "reason": "comment_authored_by_me",
            }

        # Guard against duplicate replies already posted by us.
        existing_reply_stmt = (
            select(InsightComment)
            .where(
                InsightComment.platform == comment.platform,
                InsightComment.parent_external_id == comment.comment_external_id,
                InsightComment.is_owned_by_me.is_(True),
            )
            .limit(1)
        )
        existing_reply = session.execute(existing_reply_stmt).scalar_one_or_none()
        if existing_reply:
            _mark_reaction_log(
                session,
                log=log,
                status=ReactionActionStatus.SKIPPED,
                payload={
                    "existing_comment_id": existing_reply.id,
                    "existing_comment_external_id": existing_reply.comment_external_id,
                },
                error="reply_already_exists",
            )
            return {
                "ok": True,
                "skipped": True,
                "reason": "reply_already_exists",
            }

        persona_account, platform_account = _load_persona_account_with_platform(
            session,
            persona_account_id,
        )
        if not persona_account or not platform_account:
            _mark_reaction_log(
                session,
                log=log,
                status=ReactionActionStatus.FAILED,
                error="persona_account_not_found",
            )
            return {
                "ok": False,
                "reason": "persona_account_not_found",
            }

        credentials = {}
        if platform_account.access_token:
            credentials["access_token"] = platform_account.access_token
        if platform_account.external_id:
            credentials["threads_user_id"] = platform_account.external_id
            credentials["user_id"] = platform_account.external_id
        if platform_account.handle:
            credentials["handle"] = platform_account.handle

        supported_platforms = (PlatformKind.THREADS, PlatformKind.INSTAGRAM)
        if comment.platform not in supported_platforms:
            _mark_reaction_log(
                session,
                log=log,
                status=ReactionActionStatus.SKIPPED,
                error=f"comment_reply_not_supported_for_{comment.platform.value}",
            )
            return {
                "ok": True,
                "skipped": True,
                "reason": "unsupported_platform",
            }

        adapter = ADAPTER_REGISTRY.create_instance(comment.platform)

        options = dict(metadata or {})
        if comment.platform == PlatformKind.INSTAGRAM:
            options.setdefault("reply_to_comment_id", comment.comment_external_id)
            if comment.parent_external_id:
                options.setdefault("parent_external_id", comment.parent_external_id)

        try:
            result = asyncio.run(
                adapter.create_comment(
                    comment.comment_external_id,
                    credentials=credentials,
                    text=message,
                    options=options or None,
                )
            )
        except Exception as exc:  # pragma: no cover - safety guard
            _mark_reaction_log(
                session,
                log=log,
                status=ReactionActionStatus.FAILED,
                error=str(exc),
            )
            raise

        if result.ok:
            payload = {
                "external_id": result.external_id,
                "permalink": result.permalink,
                "warnings": result.warnings,
            }
            _mark_reaction_log(
                session,
                log=log,
                status=ReactionActionStatus.SUCCESS,
                payload=payload,
            )
            return {
                "ok": True,
                "external_id": result.external_id,
                "permalink": result.permalink,
                "warnings": result.warnings,
            }

        payload = {
            "warnings": result.warnings,
        }
        _mark_reaction_log(
            session,
            log=log,
            status=ReactionActionStatus.FAILED,
            payload=payload,
            error="; ".join(result.errors),
        )
        return {
            "ok": False,
            "errors": result.errors,
            "warnings": result.warnings,
        }


@celery_app.task(
    name="apps.backend.src.workers.Adapter.tasks.reactive_send_dm",
    queue="coworker",
    bind=True,
    max_retries=3,
)
def reactive_send_dm(
    self,
    *,
    platform: str,
    persona_account_id: int,
    reaction_rule_id: Optional[int],
    tag_key: str,
    insight_comment_id: int,
    comment_external_id: str,
    recipient_author_id: Optional[str] = None,
    message: str,
    metadata: Optional[dict] = None,
):
    """Send a direct message if supported; otherwise mark as skipped."""

    with SessionLocal() as session:
        platform_kind = PlatformKind(platform)
        log = _get_or_create_reaction_log(
            session,
            insight_comment_id=insight_comment_id,
            reaction_rule_id=reaction_rule_id,
            tag_key=tag_key,
            action_type=ReactionActionType.DM,
            payload={
                "comment_external_id": comment_external_id,
                "recipient_author_id": recipient_author_id,
                "message": message,
                "metadata": metadata,
            },
        )

        if log.status == ReactionActionStatus.SUCCESS:
            return {
                "ok": True,
                "skipped": True,
                "reason": "already_executed",
            }

        persona_account, platform_account = _load_persona_account_with_platform(
            session,
            persona_account_id,
        )
        if not persona_account or not platform_account:
            _mark_reaction_log(
                session,
                log=log,
                status=ReactionActionStatus.FAILED,
                error="persona_account_not_found",
            )
            return {
                "ok": False,
                "reason": "persona_account_not_found",
            }

        adapter = ADAPTER_REGISTRY.create_instance(platform_kind)
        capability_support = adapter.supports()
        if not capability_support.direct_message:
            _mark_reaction_log(
                session,
                log=log,
                status=ReactionActionStatus.SKIPPED,
                error=f"dm_not_supported_for_{platform_kind.value}",
            )
            return {
                "ok": True,
                "skipped": True,
                "reason": "unsupported_platform",
            }

        credentials: dict[str, Any] = {}
        if platform_account.access_token:
            credentials["access_token"] = platform_account.access_token
        if platform_account.external_id:
            if platform_kind is PlatformKind.THREADS:
                credentials["threads_user_id"] = platform_account.external_id
                credentials["user_id"] = platform_account.external_id
            elif platform_kind is PlatformKind.INSTAGRAM:
                credentials["instagram_user_id"] = platform_account.external_id
                credentials["user_id"] = platform_account.external_id

        try:
            dm_options = dict(metadata or {})
            dm_options.setdefault("comment_external_id", comment_external_id)
            result = asyncio.run(
                adapter.send_direct_message(
                    recipient_external_id=comment_external_id,
                    credentials=credentials,
                    text=message,
                    options=dm_options or None,
                )
            )
        except Exception as exc:  # pragma: no cover - safety guard
            _mark_reaction_log(
                session,
                log=log,
                status=ReactionActionStatus.FAILED,
                error=str(exc),
            )
            raise

        if isinstance(result, MessageSendResult):
            base_payload = {
                "recipient_id": result.recipient_id,
                "message_id": result.message_id,
                "warnings": result.warnings,
                "errors": result.errors,
                "raw": result.raw,
                "skipped": result.skipped,
                "reason": result.reason,
                "message": message,
                "metadata": metadata,
                "persona_account_id": persona_account_id,
                "comment_external_id": comment_external_id,
                "recipient_external_id": comment_external_id,
                "recipient_author_id": recipient_author_id,
            }
            if _is_dm_window_closed(result):
                payload = {**base_payload, "window_closed": True}
                _mark_reaction_log(
                    session,
                    log=log,
                    status=ReactionActionStatus.SKIPPED,
                    payload=payload,
                    error="dm_window_closed",
                )
                return {"ok": False, "skipped": True, "reason": "dm_window_closed", **payload}
            if result.ok:
                _mark_reaction_log(
                    session,
                    log=log,
                    status=ReactionActionStatus.SUCCESS,
                    payload=base_payload,
                )
                return {"ok": True, **base_payload}
            if result.skipped:
                _mark_reaction_log(
                    session,
                    log=log,
                    status=ReactionActionStatus.SKIPPED,
                    payload=base_payload,
                    error=result.reason,
                )
                return {"ok": False, "skipped": True, **base_payload}
            _mark_reaction_log(
                session,
                log=log,
                status=ReactionActionStatus.FAILED,
                payload=base_payload,
                error=result.reason or "dm_send_failed",
            )
            return {"ok": False, **base_payload}

        # Fallback for dict or custom response types
        if isinstance(result, dict):
            augmented = dict(result)
            augmented.setdefault("message", message)
            augmented.setdefault("metadata", metadata)
            augmented.setdefault("comment_external_id", comment_external_id)
            augmented.setdefault("recipient_external_id", comment_external_id)
            if recipient_author_id is not None:
                augmented.setdefault("recipient_author_id", recipient_author_id)
            augmented.setdefault("persona_account_id", persona_account_id)
            ok = bool(augmented.get("ok"))
            skipped = bool(augmented.get("skipped"))
            reason = augmented.get("reason")
            if ok:
                _mark_reaction_log(
                    session,
                    log=log,
                    status=ReactionActionStatus.SUCCESS,
                    payload=augmented,
                )
                return augmented
            if skipped:
                _mark_reaction_log(
                    session,
                    log=log,
                    status=ReactionActionStatus.SKIPPED,
                    payload=augmented,
                    error=reason,
                )
                return augmented
            _mark_reaction_log(
                session,
                log=log,
                status=ReactionActionStatus.FAILED,
                payload=augmented,
                error=reason or augmented.get("error") or "dm_send_failed",
            )
            return augmented

        ok = getattr(result, "ok", False)
        skipped = getattr(result, "skipped", False)
        reason = getattr(result, "reason", None)
        payload = getattr(result, "__dict__", {}).copy()
        payload.setdefault("message", message)
        payload.setdefault("metadata", metadata)
        payload.setdefault("comment_external_id", comment_external_id)
        payload.setdefault("recipient_external_id", comment_external_id)
        if recipient_author_id is not None:
            payload.setdefault("recipient_author_id", recipient_author_id)
        payload.setdefault("persona_account_id", persona_account_id)
        if ok:
            _mark_reaction_log(
                session,
                log=log,
                status=ReactionActionStatus.SUCCESS,
                payload=payload,
            )
        elif skipped:
            _mark_reaction_log(
                session,
                log=log,
                status=ReactionActionStatus.SKIPPED,
                payload=payload,
                error=reason,
            )
        else:
            _mark_reaction_log(
                session,
                log=log,
                status=ReactionActionStatus.FAILED,
                payload=payload,
                error=reason or "dm_send_failed",
            )
        return {"ok": ok, "skipped": skipped, "reason": reason, "payload": payload}

__all__ = [
    "enqueue_variant_compile",
    "compile_draft_variant",
    "publish_variant_with_adapter",
    "sync_metrics_with_adapter",
    "reactive_reply_to_comment",
    "reactive_send_dm",
]

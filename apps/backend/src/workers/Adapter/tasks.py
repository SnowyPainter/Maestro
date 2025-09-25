from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Iterable, Optional, Union

from apps.backend.src.core.celery_app import celery_app
from celery import shared_task
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from apps.backend.src.core.config import settings
from apps.backend.src.modules.common.enums import PlatformKind, VariantStatus
from apps.backend.src.modules.accounts.models import Persona, PersonaAccount
from apps.backend.src.modules.drafts.models import Draft, DraftVariant
from apps.backend.src.modules.adapters.service import compile_variant
from apps.backend.src.core.context import get_persona_account_id
from apps.backend.src.modules.adapters.registry import ADAPTER_REGISTRY
from apps.backend.src.modules.adapters.core.types import PublishResult, RenderedVariantBlocks

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


__all__ = [
    "enqueue_variant_compile",
    "compile_draft_variant",
    "publish_variant_with_adapter",
]

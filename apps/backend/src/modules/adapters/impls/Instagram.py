# apps/backend/src/modules/adapters/impls/Instagram.py
from __future__ import annotations

import uuid
from typing import Optional

from apps.backend.src.modules.adapters.schemas import (
    Adapter,
    CompileResult,
    DeleteResult,
    MetricsResult,
    PublishResult,
)
from apps.backend.src.modules.common.enums import (
    ContentKind,
    MetricsScope,
    PlatformKind,
    VariantStatus,
)
from apps.backend.src.modules.injectors.base import InjectedContent

from ..platforms import (
    _apply_linebreak_rule,
    _build_metrics,
    _check_banned_words,
    _extract_blocks,
    _limit_media,
    _mk_compile_result,
    _merge_options,
    _truncate,
)


def _utcnow():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc)


class InstagramAdapter(Adapter):
    platform = PlatformKind.INSTAGRAM
    compiler_version = 1

    DEFAULT_POLICY = {
        "char_limit": 2200,
        "allowed_media": ("image", "video"),
        "max_media": 10,
        "linebreak_rule": "single-to-double",
    }

    async def compile(self, payload: InjectedContent, *, locale: Optional[str] = None) -> CompileResult:
        policy = {**self.DEFAULT_POLICY, **(payload.policy or {})}
        allowed_media = tuple(policy.get("allowed_media") or self.DEFAULT_POLICY["allowed_media"])
        max_media = policy.get("max_media", self.DEFAULT_POLICY["max_media"])
        char_limit = policy.get("char_limit", self.DEFAULT_POLICY["char_limit"])
        linebreak_rule = policy.get("linebreak_rule", self.DEFAULT_POLICY["linebreak_rule"])

        caption_source, media_source, block_warnings = _extract_blocks(payload.ir)

        caption = _apply_linebreak_rule(caption_source, linebreak_rule)
        caption, trunc_warning = _truncate(caption, char_limit)

        media_final, media_warnings = _limit_media(media_source, max_media, allowed_media)

        warnings: list[str] = list(payload.warnings)
        errors: list[str] = list(payload.errors)
        if block_warnings:
            warnings.extend(block_warnings)
        if trunc_warning:
            warnings.append(trunc_warning)
        if media_warnings:
            warnings.extend(media_warnings)

        persona_directives = payload.persona_directives or {}
        banned_words = persona_directives.get("banned_words") or []
        if banned_words:
            warnings.extend(_check_banned_words(caption, banned_words))

        metrics = _build_metrics(caption, media_final)
        options = _merge_options(payload.options, {"policy": {**policy, "allowed_media": list(allowed_media)}})

        rendered_blocks = {
            "media": media_final,
            "options": options,
            "metrics": metrics,
        }

        status = VariantStatus.INVALID if errors else VariantStatus.VALID

        return _mk_compile_result(
            status=status,
            caption=caption,
            blocks=rendered_blocks,
            warnings=warnings,
            errors=errors,
            compiler_version=self.compiler_version,
            ir_revision=payload.ir_revision,
        )

    async def publish(
        self,
        rendered_blocks: dict | None,
        caption: str | None,
        *,
        credentials: dict,
        options: dict | None = None,
    ) -> PublishResult:
        external_id = f"ig:{uuid.uuid4()}"
        return PublishResult(ok=True, external_id=external_id, errors=[], warnings=[])

    async def delete(self, external_id: str, *, credentials: dict) -> DeleteResult:
        return DeleteResult(ok=True, errors=[])

    async def sync_metrics(self, external_id: str, *, credentials: dict) -> MetricsResult:
        return MetricsResult(
            ok=True,
            metrics={"impressions": 0.0, "likes": 0.0, "comments": 0.0, "saves": 0.0},
            scope=MetricsScope.SINCE_PUBLISH,
            content_kind=ContentKind.POST,
            mapping_version=1,
            collected_at=_utcnow(),
            raw={"external_id": external_id},
            warnings=[],
            errors=[],
        )

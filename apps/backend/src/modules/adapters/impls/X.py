# apps/backend/src/modules/adapters/impls/X.py
from __future__ import annotations

import uuid
from typing import Optional

from apps.backend.src.modules.adapters.engine import (
    CompileState,
    compile_with_spec,
    get_compile_spec,
)
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
)
from apps.backend.src.modules.injectors.base import InjectedContent

def _utcnow():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc)


class XAdapter(Adapter):
    platform = PlatformKind.X
    compiler_version = 1

    async def compile(self, payload: InjectedContent, *, locale: Optional[str] = None) -> CompileResult:
        return await compile_with_spec(payload, SPEC)

    async def publish(
        self,
        rendered_blocks: dict | None,
        caption: str | None,
        *,
        credentials: dict,
        options: dict | None = None,
    ) -> PublishResult:
        external_id = f"x:{uuid.uuid4()}"
        return PublishResult(ok=True, external_id=external_id, errors=[], warnings=[])

    async def delete(self, external_id: str, *, credentials: dict) -> DeleteResult:
        return DeleteResult(ok=True, errors=[])

    async def sync_metrics(self, external_id: str, *, credentials: dict) -> MetricsResult:
        return MetricsResult(
            ok=True,
            metrics={"impressions": 0.0, "likes": 0.0, "reposts": 0.0, "replies": 0.0},
            scope=MetricsScope.SINCE_PUBLISH,
            content_kind=ContentKind.POST,
            mapping_version=1,
            collected_at=_utcnow(),
            raw={"external_id": external_id},
            warnings=[],
            errors=[],
        )


def _x_metrics_hook(state: CompileState) -> None:
    caption = state.caption or ""
    state.metrics["hashtag_count"] = caption.count("#") if caption else 0


SPEC = get_compile_spec(
    PlatformKind.X,
    XAdapter.compiler_version,
    hooks=(
        _x_metrics_hook,
    ),
)

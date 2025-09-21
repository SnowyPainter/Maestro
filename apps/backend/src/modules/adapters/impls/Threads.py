# apps/backend/src/modules/adapters/impls/Threads.py
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


class ThreadsAdapter(Adapter):
    platform = PlatformKind.THREADS
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
        external_id = f"threads:{uuid.uuid4()}"
        return PublishResult(ok=True, external_id=external_id, errors=[], warnings=[])

    async def delete(self, external_id: str, *, credentials: dict) -> DeleteResult:
        return DeleteResult(ok=True, errors=[])

    async def sync_metrics(self, external_id: str, *, credentials: dict) -> MetricsResult:
        return MetricsResult(
            ok=True,
            metrics={"likes": 0.0, "replies": 0.0, "reposts": 0.0},
            scope=MetricsScope.SINCE_PUBLISH,
            content_kind=ContentKind.POST,
            mapping_version=1,
            collected_at=_utcnow(),
            raw={"external_id": external_id},
            warnings=[],
            errors=[],
        )


def _threads_metric_hook(state: CompileState) -> None:
    caption = state.caption or ""
    if caption:
        state.metrics["thread_length"] = caption.count("\n\n") + 1
    else:
        state.metrics["thread_length"] = 0


SPEC = get_compile_spec(
    PlatformKind.THREADS,
    ThreadsAdapter.compiler_version,
    hooks=(
        _threads_metric_hook,
    ),
)

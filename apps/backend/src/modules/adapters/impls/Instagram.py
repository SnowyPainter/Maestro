# apps/backend/src/modules/adapters/impls/Instagram.py
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from apps.backend.src.modules.adapters.core.capabilities import MetricsCapability, PublishingCapability
from apps.backend.src.modules.adapters.core.compiler import SpecCompiler
from apps.backend.src.modules.adapters.core.adapter import CapabilityAdapter
from apps.backend.src.modules.adapters.core.types import MetricsResult, PublishResult, RenderedVariantBlocks
from apps.backend.src.modules.common.enums import ContentKind, MetricsScope, PlatformKind


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class InstagramAdapter(CapabilityAdapter[SpecCompiler]):
    platform = PlatformKind.INSTAGRAM

    def __init__(self) -> None:
        compiler = SpecCompiler(platform=self.platform, version=1)
        publisher = InstagramPublishingCapability()
        metrics = InstagramMetricsCapability()
        super().__init__(
            platform=self.platform,
            compiler=compiler,
            publisher=publisher,
            metrics=metrics,
        )


class InstagramPublishingCapability(PublishingCapability):
    async def publish(
        self,
        rendered_blocks: RenderedVariantBlocks | None,
        caption: str | None,
        *,
        credentials: dict,
        options: dict | None = None,
    ) -> PublishResult:
        external_id = f"ig:{uuid.uuid4()}"
        return PublishResult(ok=True, external_id=external_id, errors=[], warnings=[])


@dataclass
class _PlaceholderMetrics:
    impressions: float = 0.0
    likes: float = 0.0
    comments: float = 0.0
    saves: float = 0.0


class InstagramMetricsCapability(MetricsCapability):
    async def fetch_metrics(self, external_id: str, *, credentials: dict) -> MetricsResult:
        metrics = _PlaceholderMetrics().__dict__
        return MetricsResult(
            ok=True,
            metrics=metrics,
            scope=MetricsScope.SINCE_PUBLISH,
            content_kind=ContentKind.POST,
            mapping_version=1,
            collected_at=_utcnow(),
            raw={"external_id": external_id},
            warnings=[],
            errors=[],
        )

from __future__ import annotations

from typing import Optional, Protocol

from apps.backend.src.modules.adapters.core.types import (
    CompileResult,
    DeleteResult,
    CommentCreateResult,
    MetricsResult,
    PublishResult,
    RenderedVariantBlocks,
)
from apps.backend.src.modules.injectors.base import InjectedContent


class CompileCapability(Protocol):
    """Capability responsible for turning injected content into platform-ready artifacts."""

    version: int

    async def compile(
        self,
        payload: InjectedContent,
        *,
        locale: Optional[str] = None,
    ) -> CompileResult: ...


class PublishingCapability(Protocol):
    """Capability for publishing rendered content to a platform."""

    async def publish(
        self,
        rendered_blocks: RenderedVariantBlocks | None,
        caption: str | None,
        *,
        credentials: dict,
        options: dict | None = None,
    ) -> PublishResult: ...


class DeletionCapability(Protocol):
    """Capability for removing previously published content."""

    async def delete(self, external_id: str, *, credentials: dict) -> DeleteResult: ...


class MetricsCapability(Protocol):
    """Capability for pulling metrics from a platform."""

    async def fetch_metrics(self, external_id: str, *, credentials: dict) -> MetricsResult: ...


class CommentCreateCapability(Protocol):
    """Capability for creating comments or replies on a platform."""

    async def create_comment(
        self,
        parent_external_id: str,
        *,
        credentials: dict,
        text: str,
        options: dict | None = None,
    ) -> CommentCreateResult: ...


class CommentDeleteCapability(Protocol):
    """Capability for removing comments from a platform."""

    async def delete_comment(self, comment_external_id: str, *, credentials: dict) -> DeleteResult: ...

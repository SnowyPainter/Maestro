from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Generic, Optional, TypeVar

from .capabilities import (
    CommentCreateCapability,
    CommentDeleteCapability,
    CommentReadCapability,
    CompileCapability,
    DeletionCapability,
    MessageSendCapability,
    MetricsCapability,
    PublishingCapability,
)
from .types import (
    CompileResult,
    CommentCreateResult,
    CommentListResult,
    DeleteResult,
    MetricsResult,
    PublishResult,
    RenderedVariantBlocks,
)
from apps.backend.src.modules.common.enums import ContentKind, MetricsScope, PlatformKind
from apps.backend.src.modules.injectors.base import InjectedContent


@dataclass(frozen=True)
class CapabilitySupport:
    """Describes which optional capabilities are implemented by an adapter."""

    publish: bool
    delete: bool
    metrics: bool
    comment_create: bool
    comment_delete: bool
    comment_read: bool
    direct_message: bool


CompileCapabilityT = TypeVar("CompileCapabilityT", bound=CompileCapability)


class CapabilityAdapter(Generic[CompileCapabilityT]):
    """Adapter base that delegates work to capability implementations."""

    platform: PlatformKind

    def __init__(
        self,
        *,
        platform: PlatformKind,
        compiler: CompileCapabilityT,
        publisher: PublishingCapability | None = None,
        deleter: DeletionCapability | None = None,
        metrics: MetricsCapability | None = None,
        comment_creator: CommentCreateCapability | None = None,
        comment_deleter: CommentDeleteCapability | None = None,
        comment_reader: CommentReadCapability | None = None,
        message_sender: MessageSendCapability | None = None,
    ) -> None:
        self.platform = platform
        self._compiler = compiler
        self._publisher = publisher
        self._deleter = deleter
        self._metrics = metrics
        self._comment_creator = comment_creator
        self._comment_deleter = comment_deleter
        self._comment_reader = comment_reader
        self._message_sender = message_sender

    # Adapter protocol compat -----------------------------------------------------------------
    @property
    def compiler_version(self) -> int:
        return self._compiler.version

    async def compile(
        self,
        payload: InjectedContent,
        *,
        locale: Optional[str] = None,
    ) -> CompileResult:
        return await self._compiler.compile(payload, locale=locale)

    async def publish(
        self,
        rendered_blocks: RenderedVariantBlocks | None,
        caption: str | None,
        *,
        credentials: dict,
        options: dict | None = None,
    ) -> PublishResult:
        if not self._publisher:
            return PublishResult(
                ok=False,
                external_id=None,
                errors=[f"{self.platform.value} publish not supported"],
                warnings=[],
            )
        return await self._publisher.publish(
            rendered_blocks,
            caption,
            credentials=credentials,
            options=options,
        )

    async def delete(self, external_id: str, *, credentials: dict) -> DeleteResult:
        if not self._deleter:
            return DeleteResult(
                ok=False,
                errors=[f"{self.platform.value} delete not supported"],
            )
        return await self._deleter.delete(external_id, credentials=credentials)

    async def sync_metrics(self, external_id: str, *, credentials: dict) -> MetricsResult:
        if not self._metrics:
            return MetricsResult(
                ok=False,
                metrics={},
                scope=MetricsScope.SINCE_PUBLISH,
                content_kind=ContentKind.POST,
                mapping_version=0,
                collected_at=datetime.now(timezone.utc),
                raw={},
                warnings=[],
                errors=[f"{self.platform.value} metrics not supported"],
            )
        metrics = await self._metrics.fetch_metrics(external_id, credentials=credentials)

        if self._comment_reader:
            try:
                comment_result = await self._comment_reader.list_comments(
                    external_id,
                    credentials=credentials,
                    options=None,
                )
            except Exception as exc:  # pragma: no cover - defensive guard
                metrics.comment_errors.append(str(exc))
            else:
                metrics.comment_warnings.extend(comment_result.warnings)
                if comment_result.ok:
                    metrics.comments = comment_result.comments
                    metrics.comments_next_cursor = comment_result.next_cursor
                else:
                    metrics.comment_errors.extend(comment_result.errors)

        return metrics

    # Convenience ---------------------------------------------------------------------------------
    def supports(self) -> CapabilitySupport:
        return CapabilitySupport(
            publish=self._publisher is not None,
            delete=self._deleter is not None,
            metrics=self._metrics is not None,
            comment_create=self._comment_creator is not None,
            comment_delete=self._comment_deleter is not None,
            comment_read=self._comment_reader is not None,
            direct_message=self._message_sender is not None,
        )

    async def create_comment(
        self,
        parent_external_id: str,
        *,
        credentials: dict,
        text: str,
        options: dict | None = None,
    ) -> CommentCreateResult:
        if not self._comment_creator:
            return CommentCreateResult(
                ok=False,
                external_id=None,
                errors=[f"{self.platform.value} comment create not supported"],
                warnings=[],
            )
        return await self._comment_creator.create_comment(
            parent_external_id,
            credentials=credentials,
            text=text,
            options=options,
        )

    async def delete_comment(self, comment_external_id: str, *, credentials: dict) -> DeleteResult:
        if not self._comment_deleter:
            return DeleteResult(
                ok=False,
                errors=[f"{self.platform.value} comment delete not supported"],
            )
        return await self._comment_deleter.delete_comment(comment_external_id, credentials=credentials)

    async def list_comments(
        self,
        parent_external_id: str,
        *,
        credentials: dict,
        options: dict | None = None,
    ) -> CommentListResult:
        if not self._comment_reader:
            return CommentListResult(
                ok=False,
                comments=[],
                next_cursor=None,
                errors=[f"{self.platform.value} comment read not supported"],
                warnings=[],
            )
        return await self._comment_reader.list_comments(
            parent_external_id,
            credentials=credentials,
            options=options,
        )

    async def send_direct_message(
        self,
        *,
        recipient_external_id: str,
        credentials: dict,
        text: str,
        options: dict | None = None,
    ):
        if not self._message_sender:
            from apps.backend.src.modules.adapters.core.types import MessageSendResult

            return MessageSendResult(
                ok=False,
                skipped=True,
                reason=f"{self.platform.value}_dm_not_supported",
                errors=[f"{self.platform.value} direct message not supported"],
            )
        return await self._message_sender.send_message(
            recipient_external_id=recipient_external_id,
            credentials=credentials,
            text=text,
            options=options,
        )

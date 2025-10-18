# apps/backend/src/modules/adapters/core/types.py
from __future__ import annotations
from typing import Protocol, Optional, Dict, Any, List, Literal, TypedDict, Mapping
from dataclasses import dataclass, field
from datetime import datetime

from apps.backend.src.modules.common.enums import ContentKind, PlatformKind, VariantStatus, MetricsScope
from apps.backend.src.modules.injectors.base import InjectedContent

from typing_extensions import TypedDict as TypedDict_
"""
[API] Failed to import apps.backend.src.orchestrator.flows.action.drafts during flow autodiscovery: Please use `typing_extensions.TypedDict` instead of `typing.TypedDict` on Python < 3.12.
[API] 
[API] For further information visit https://errors.pydantic.dev/2.11/u/typed-dict-version
[API] Failed to import apps.backend.src.orchestrator.flows.bff.bff_drafts during flow autodiscovery: Please use `typing_extensions.TypedDict` instead of `typing.TypedDict` on Python < 3.12.
"""

class RenderedMediaItem(TypedDict_, total=False):
    type: Literal["image", "video"]
    url: str
    alt: Optional[str]
    caption: Optional[str]
    ratio: Optional[str]


RenderedMetrics = Dict[str, Any]


class RenderedVariantBlocks(TypedDict_, total=False):
    media: List[RenderedMediaItem]
    options: Dict[str, Any]
    metrics: RenderedMetrics


@dataclass
class CompileResult:
    status: VariantStatus
    rendered_caption: Optional[str]
    rendered_blocks: Optional[RenderedVariantBlocks]
    metrics: Optional[RenderedMetrics]
    errors: List[str]
    warnings: List[str]
    compiler_version: int
    compiled_at: datetime
    ir_revision_compiled: int

@dataclass
class PublishResult:
    ok: bool
    external_id: Optional[str]  # 플랫폼 포스트 ID
    permalink: Optional[str]
    errors: List[str]
    warnings: List[str]


@dataclass
class CommentCreateResult:
    ok: bool
    external_id: Optional[str]
    permalink: Optional[str]
    errors: List[str]
    warnings: List[str]


@dataclass
class Comment:
    external_id: str
    parent_external_id: Optional[str]
    author_id: Optional[str]
    author_username: Optional[str]
    text: Optional[str]
    created_at: Optional[datetime]
    permalink: Optional[str]
    raw: Dict[str, Any]
    metrics: Dict[str, float] = field(default_factory=dict)
    is_owned_by_me: Optional[bool] = None


@dataclass
class CommentListResult:
    ok: bool
    comments: List[Comment]
    next_cursor: Optional[str]
    errors: List[str]
    warnings: List[str]


@dataclass
class DeleteResult:
    ok: bool
    errors: List[str]

@dataclass
class MetricsResult:
    ok: bool
    metrics: Dict[str, float]                 # KPIKey.value 기반 dict
    scope: MetricsScope                                # "since_publish" 등
    content_kind: ContentKind                         # "post"/"video"/...
    mapping_version: int
    collected_at: datetime
    raw: Dict[str, Any]
    warnings: list[str]
    errors: list[str]
    comments: List[Comment] = field(default_factory=list)
    comments_next_cursor: Optional[str] = None
    comment_warnings: list[str] = field(default_factory=list)
    comment_errors: list[str] = field(default_factory=list)

def _coerce_str(values: Mapping[str, Any], keys: List[str]) -> Optional[str]:
    for key in keys:
        value = values.get(key)
        if isinstance(value, str):
            stripped = value.strip()
            if stripped:
                return stripped
    return None


@dataclass(frozen=True)
class ThreadsCredentials:
    access_token: str
    user_id: Optional[str]

    @classmethod
    def from_mapping(
        cls,
        raw: Mapping[str, Any] | None,
        *,
        require_user_id: bool = True,
    ) -> tuple[Optional["ThreadsCredentials"], List[str]]:
        if not isinstance(raw, Mapping):
            return None, ["access_token", "threads user id"] if require_user_id else ["access_token"]

        access_token = _coerce_str(raw, ["access_token", "token"])
        user_id = _coerce_str(
            raw,
            [
                "threads_user_id",
                "user_id",
                "profile_id",
                "external_id",
            ],
        )

        missing: List[str] = []
        if not access_token:
            missing.append("access_token")
        if require_user_id and not user_id:
            missing.append("threads user id")

        if missing:
            return None, missing

        return cls(access_token=access_token, user_id=user_id), []


class Adapter(Protocol):
    platform: PlatformKind
    compiler_version: int  # 규칙/렌더러 버전

    # IR -> Variant 산출물
    async def compile(self, payload: InjectedContent, *, locale: Optional[str] = None) -> CompileResult: ...

    # 계정/퍼소나별 발행 (계정 자격증명은 외부에서 주입)
    async def publish(
        self,
        rendered_blocks: RenderedVariantBlocks | None,
        caption: str | None,
        *,
        credentials: dict,
        options: dict | None = None,
    ) -> PublishResult: ...

    # 외부 리소스 삭제
    async def delete(self, external_id: str, *, credentials: dict) -> DeleteResult: ...

    # 외부 → 내부 메트릭 동기화
    async def sync_metrics(self, external_id: str, *, credentials: dict) -> MetricsResult: ...

    # 댓글 작성
    async def create_comment(
        self,
        parent_external_id: str,
        *,
        credentials: dict,
        text: str,
        options: dict | None = None,
    ) -> CommentCreateResult: ...

    # 댓글 삭제
    async def delete_comment(self, comment_external_id: str, *, credentials: dict) -> DeleteResult: ...

    # 댓글 조회
    async def list_comments(
        self,
        parent_external_id: str,
        *,
        credentials: dict,
        options: dict | None = None,
    ) -> CommentListResult: ...

# apps/backend/src/modules/adapters/base.py
from __future__ import annotations
from typing import Protocol, Optional, Dict, Any, List, Tuple
from dataclasses import dataclass
from datetime import datetime

from apps.backend.src.modules.common.enums import ContentKind, PlatformKind, VariantStatus, MetricsScope

@dataclass
class CompileResult:
    status: VariantStatus
    rendered_caption: Optional[str]
    rendered_blocks: Optional[Dict[str, Any]]
    metrics: Optional[Dict[str, Any]]
    errors: List[str]
    warnings: List[str]
    compiler_version: int
    compiled_at: datetime
    ir_revision_compiled: int

@dataclass
class PublishResult:
    ok: bool
    external_id: Optional[str]  # 플랫폼 포스트 ID/URL
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

class Adapter(Protocol):
    platform: PlatformKind
    compiler_version: int  # 규칙/렌더러 버전

    # IR -> Variant 산출물
    async def compile(self, ir: dict, *, locale: Optional[str] = None) -> CompileResult: ...

    # 계정/퍼소나별 발행 (계정 자격증명은 외부에서 주입)
    async def publish(self, rendered_blocks: dict | None, caption: str | None, *, credentials: dict, options: dict | None = None) -> PublishResult: ...

    # 외부 리소스 삭제
    async def delete(self, external_id: str, *, credentials: dict) -> DeleteResult: ...

    # 외부 → 내부 메트릭 동기화
    async def sync_metrics(self, external_id: str, *, credentials: dict) -> MetricsResult: ...
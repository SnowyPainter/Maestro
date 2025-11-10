from __future__ import annotations

from typing import Any, Iterable, Optional

from apps.backend.src.modules.adapters.core.types import Adapter, CompileResult
from apps.backend.src.modules.adapters.registry import ADAPTER_REGISTRY
from apps.backend.src.modules.common.enums import PlatformKind
from apps.backend.src.modules.injectors.base import (
    DEFAULT_INJECTOR_REGISTRY,
    InjectorContext,
    InjectedContent,
    InjectorRegistry,
)
from apps.backend.src.modules.link_tracking.service import TrackingLinkAllocator


async def compile_variant(
    *,
    ir: Any,
    platform: PlatformKind,
    ir_revision: int = 0,
    persona: Any = None,
    locale: Optional[str] = None,
    injector_registry: Optional[InjectorRegistry] = None,
    injector_names: Optional[Iterable[str]] = None,
    adapter_instance: Optional[Adapter] = None,
    tracking_allocator: Optional[TrackingLinkAllocator] = None,
) -> CompileResult:
    """Compose IR through injectors then delegate to the adapter compiler."""

    context = InjectorContext.from_ir(
        platform=platform,
        ir=ir,
        ir_revision=ir_revision,
        persona=persona,
        locale=locale,
        link_allocator=tracking_allocator,
    )

    registry = injector_registry or DEFAULT_INJECTOR_REGISTRY
    injected: InjectedContent = registry.run(context, injector_names)

    adapter = adapter_instance or ADAPTER_REGISTRY.create_instance(platform)
    return await adapter.compile(injected, locale=locale)


__all__ = ["compile_variant"]

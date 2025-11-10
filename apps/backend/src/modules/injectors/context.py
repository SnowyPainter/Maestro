from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Protocol

from apps.backend.src.modules.common.enums import PlatformKind
from apps.backend.src.modules.link_tracking.service import TrackingLinkAllocator


@dataclass
class InjectedContent:
    """Final payload passed to adapters after injection."""

    platform: PlatformKind
    ir: Dict[str, Any]
    ir_revision: int
    policy: Dict[str, Any] = field(default_factory=dict)
    persona_directives: Dict[str, Any] = field(default_factory=dict)
    options: Dict[str, Any] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    locale: Optional[str] = None
    link_allocator: Optional[TrackingLinkAllocator] = None


@dataclass
class InjectorContext:
    """Mutable context shared across injector pipeline."""

    platform: PlatformKind
    ir: Dict[str, Any]
    ir_revision: int = 0
    persona: Any = None
    locale: Optional[str] = None
    policy: Dict[str, Any] = field(default_factory=dict)
    persona_directives: Dict[str, Any] = field(default_factory=dict)
    options: Dict[str, Any] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    link_allocator: Optional[TrackingLinkAllocator] = None

    @classmethod
    def from_ir(
        cls,
        *,
        platform: PlatformKind,
        ir: Any,
        ir_revision: int = 0,
        persona: Any = None,
        locale: Optional[str] = None,
        link_allocator: Optional[TrackingLinkAllocator] = None,
    ) -> "InjectorContext":
        ir_dict = _normalize_ir(ir)
        options = copy.deepcopy(ir_dict.get("options") or {})
        return cls(
            platform=platform,
            ir=ir_dict,
            ir_revision=ir_revision,
            persona=persona,
            locale=locale,
            options=options,
            link_allocator=link_allocator,
        )

    def finalize(self) -> InjectedContent:
        return InjectedContent(
            platform=self.platform,
            ir=copy.deepcopy(self.ir),
            ir_revision=self.ir_revision,
            policy=copy.deepcopy(self.policy),
            persona_directives=copy.deepcopy(self.persona_directives),
            options=copy.deepcopy(self.options),
            warnings=list(self.warnings),
            errors=list(self.errors),
            locale=self.locale,
            link_allocator=self.link_allocator,
        )


class Injector(Protocol):
    """Public injector interface."""

    name: str

    def apply(self, context: InjectorContext) -> None: ...


class InjectorRegistry:
    """Keeps injector instances in deterministic order."""

    def __init__(self) -> None:
        self._registry: Dict[str, Injector] = {}
        self._order: List[str] = []

    def register(self, injector: Injector, *, name: Optional[str] = None) -> None:
        key = name or getattr(injector, "name", injector.__class__.__name__.lower())
        if key in self._registry:
            raise ValueError(f"Injector '{key}' already registered")
        self._registry[key] = injector
        self._order.append(key)

    def resolve(self, names: Optional[Iterable[str]] = None) -> List[Injector]:
        if names is None:
            keys = self._order
        else:
            keys = list(names)
        resolved: List[Injector] = []
        for key in keys:
            if key not in self._registry:
                raise KeyError(f"Injector '{key}' not registered")
            resolved.append(self._registry[key])
        return resolved

    def run(
        self,
        context: InjectorContext,
        names: Optional[Iterable[str]] = None,
    ) -> InjectedContent:
        for injector in self.resolve(names):
            injector.apply(context)
        return context.finalize()


def _normalize_ir(ir: Any) -> Dict[str, Any]:
    if ir is None:
        return {"blocks": [], "options": {}}
    if isinstance(ir, dict):
        return copy.deepcopy(ir)
    if hasattr(ir, "model_dump"):
        return copy.deepcopy(ir.model_dump())
    raise TypeError("Unsupported IR payload type")


__all__ = [
    "InjectedContent",
    "InjectorContext",
    "Injector",
    "InjectorRegistry",
]

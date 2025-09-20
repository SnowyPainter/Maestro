"""Compatibility layer for injector public API."""
from __future__ import annotations

from .context import InjectedContent, InjectorContext, Injector, InjectorRegistry
from .persona import PersonaInjector
from .platform_policy import ComposePolicy, PlatformPolicyInjector, PLATFORM_POLICIES

DEFAULT_INJECTOR_REGISTRY = InjectorRegistry()
DEFAULT_INJECTOR_REGISTRY.register(PlatformPolicyInjector())
DEFAULT_INJECTOR_REGISTRY.register(PersonaInjector())

__all__ = [
    "InjectedContent",
    "InjectorContext",
    "Injector",
    "InjectorRegistry",
    "PersonaInjector",
    "ComposePolicy",
    "PlatformPolicyInjector",
    "PLATFORM_POLICIES",
    "DEFAULT_INJECTOR_REGISTRY",
]

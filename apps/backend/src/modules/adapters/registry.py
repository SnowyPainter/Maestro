# apps/backend/src/modules/adapters/registry.py
"""Adapter registry with autodiscovery for platform adapters."""
from __future__ import annotations

import importlib
import inspect
import pkgutil
from typing import Dict, Type

from apps.backend.src.modules.common.enums import PlatformKind

from .schemas import Adapter


class AdapterRegistry:
    """Registry for platform adapters."""

    def __init__(self) -> None:
        self._adapters: Dict[PlatformKind, Type[Adapter]] = {}

    def register(self, adapter_class: Type[Adapter]) -> None:
        """Register an adapter class for its platform."""
        if not hasattr(adapter_class, "platform"):
            raise ValueError(
                f"Adapter class {adapter_class.__name__} must have a 'platform' attribute"
            )

        platform = adapter_class.platform
        if platform in self._adapters:
            raise ValueError(f"Adapter for platform '{platform}' already registered")

        self._adapters[platform] = adapter_class

    def get(self, platform: PlatformKind) -> Type[Adapter]:
        """Get the adapter class for a specific platform."""
        if platform not in self._adapters:
            raise KeyError(f"No adapter registered for platform '{platform}'")
        return self._adapters[platform]

    def get_all(self) -> Dict[PlatformKind, Type[Adapter]]:
        """Get all registered adapters."""
        return self._adapters.copy()

    def has_platform(self, platform: PlatformKind) -> bool:
        """Check if a platform has a registered adapter."""
        return platform in self._adapters

    def create_instance(self, platform: PlatformKind) -> Adapter:
        """Create an instance of the adapter for the given platform."""
        adapter_class = self.get(platform)
        return adapter_class()


# Global adapter registry instance
ADAPTER_REGISTRY = AdapterRegistry()

IMPLS_PACKAGE = "apps.backend.src.modules.adapters.impls"


def autodiscover_adapters(package: str = IMPLS_PACKAGE) -> None:
    """Import all adapter implementations under the impls package and register them."""

    try:
        base_module = importlib.import_module(package)
    except ModuleNotFoundError:
        return

    for module_info in pkgutil.iter_modules(base_module.__path__, base_module.__name__ + "."):
        module = importlib.import_module(module_info.name)
        _register_module_adapters(module)


def _register_module_adapters(module) -> None:
    for _, obj in inspect.getmembers(module, inspect.isclass):
        if obj.__module__ != module.__name__:
            continue
        if not hasattr(obj, "platform"):
            continue
        try:
            ADAPTER_REGISTRY.register(obj)
        except ValueError:
            # Adapter already registered, skip duplicate
            continue


# Discover adapters on import
autodiscover_adapters()


__all__ = ["AdapterRegistry", "ADAPTER_REGISTRY", "autodiscover_adapters"]

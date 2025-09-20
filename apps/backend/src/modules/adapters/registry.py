# apps/backend/src/modules/adapters/registry.py
"""Adapter registry for platform-specific content adapters.

This module provides a registry system for content adapters that can compile,
publish, and manage content across different social media platforms.
"""

from typing import Dict, Type, Optional
from .schemas import Adapter
from apps.backend.src.modules.common.enums import PlatformKind


class AdapterRegistry:
    """Registry for platform adapters."""

    def __init__(self):
        self._adapters: Dict[PlatformKind, Type[Adapter]] = {}

    def register(self, adapter_class: Type[Adapter]) -> None:
        """Register an adapter class for its platform."""
        if not hasattr(adapter_class, 'platform'):
            raise ValueError(f"Adapter class {adapter_class.__name__} must have a 'platform' attribute")

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

# Auto-register built-in adapters
def _register_builtin_adapters():
    """Automatically register all built-in platform adapters."""
    try:
        from .impls.X import XAdapter
        from .impls.Instagram import InstagramAdapter
        from .impls.Threads import ThreadsAdapter
        from .impls.Blog import BlogAdapter

        ADAPTER_REGISTRY.register(XAdapter)
        ADAPTER_REGISTRY.register(InstagramAdapter)
        ADAPTER_REGISTRY.register(ThreadsAdapter)
        ADAPTER_REGISTRY.register(BlogAdapter)

    except ImportError as e:
        # Handle case where individual adapter files don't exist yet
        pass

# Register built-in adapters on import
_register_builtin_adapters()


__all__ = [
    "AdapterRegistry",
    "ADAPTER_REGISTRY",
]
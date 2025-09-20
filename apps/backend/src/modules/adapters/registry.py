# apps/backend/src/modules/adapters/registry.py
from __future__ import annotations
from typing import Dict, Type
from apps.backend.src.modules.common.enums import PlatformKind
from .base import Adapter

_REGISTRY: Dict[PlatformKind, Adapter] = {}

def register(adapter: Adapter):
    _REGISTRY[adapter.platform] = adapter

def get_adapter(platform: PlatformKind) -> Adapter:
    try:
        return _REGISTRY[platform]
    except KeyError:
        raise RuntimeError(f"No adapter registered for {platform}")
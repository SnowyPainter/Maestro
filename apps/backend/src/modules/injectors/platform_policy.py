from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional

from apps.backend.src.modules.common.enums import PlatformKind

from .context import Injector, InjectorContext


@dataclass(frozen=True)
class ComposePolicy:
    """Static platform-specific constraints."""

    char_limit: Optional[int] = None
    allowed_media: tuple[str, ...] = ()
    max_media: Optional[int] = None
    linebreak_rule: Optional[str] = None

    def as_dict(self) -> Dict[str, object]:
        payload: Dict[str, object] = {}
        if self.char_limit is not None:
            payload["char_limit"] = self.char_limit
        if self.allowed_media:
            payload["allowed_media"] = list(self.allowed_media)
        if self.max_media is not None:
            payload["max_media"] = self.max_media
        if self.linebreak_rule:
            payload["linebreak_rule"] = self.linebreak_rule
        return payload


class PlatformPolicyInjector(Injector):
    name = "platform_policy"

    def __init__(
        self,
        *,
        policy_map: Optional[Dict[PlatformKind, ComposePolicy]] = None,
    ) -> None:
        self._policy_map = policy_map or PLATFORM_POLICIES

    def apply(self, context: InjectorContext) -> None:
        policy = self._policy_map.get(context.platform)
        if not policy:
            return
        policy_dict = policy.as_dict()
        if not policy_dict:
            return
        context.policy.update(policy_dict)
        existing = context.options.get("policy")
        merged = dict(existing) if isinstance(existing, dict) else {}
        merged.update(policy_dict)
        context.options["policy"] = merged


PLATFORM_POLICIES: Dict[PlatformKind, ComposePolicy] = {
    PlatformKind.INSTAGRAM: ComposePolicy(
        char_limit=2200,
        allowed_media=("image", "video"),
        max_media=10,
        linebreak_rule="single-to-double",
    ),
    PlatformKind.THREADS: ComposePolicy(
        char_limit=500,
        allowed_media=("image", "video"),
        max_media=10,
        linebreak_rule="single-to-double",
    ),
    PlatformKind.X: ComposePolicy(
        char_limit=280,
        allowed_media=("image", "video"),
        max_media=4,
    ),
}


__all__ = [
    "ComposePolicy",
    "PlatformPolicyInjector",
    "PLATFORM_POLICIES",
]

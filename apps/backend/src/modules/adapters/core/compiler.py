from __future__ import annotations

from typing import Callable, Iterable, Optional

from apps.backend.src.modules.adapters.core.capabilities import CompileCapability
from apps.backend.src.modules.adapters.engine import CompileState, compile_with_spec, get_compile_spec
from apps.backend.src.modules.common.enums import PlatformKind
from apps.backend.src.modules.injectors.base import InjectedContent
from apps.backend.src.modules.adapters.core.types import CompileResult


class SpecCompiler(CompileCapability):
    """Compile capability powered by the existing adapter compile spec engine."""

    def __init__(
        self,
        *,
        platform: PlatformKind,
        version: int,
        hooks: Optional[Iterable[Callable[[CompileState], None]]] = None,
    ) -> None:
        self._spec = get_compile_spec(platform, version, hooks=tuple(hooks or ()))
        self.version = version

    async def compile(
        self,
        payload: InjectedContent,
        *,
        locale: Optional[str] = None,
    ) -> CompileResult:
        return await compile_with_spec(payload, self._spec)


__all__ = ["SpecCompiler"]

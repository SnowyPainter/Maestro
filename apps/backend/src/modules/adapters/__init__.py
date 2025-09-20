# apps/backend/src/modules/adapters/__init__.py

from .base import Adapter, CompileResult, PublishResult, DeleteResult, MetricsResult
from .platforms import _mk_compile_result
from .registry import AdapterRegistry, ADAPTER_REGISTRY

__all__ = [
    "Adapter",
    "CompileResult",
    "PublishResult",
    "DeleteResult",
    "MetricsResult",
    "_mk_compile_result",
    "AdapterRegistry",
    "ADAPTER_REGISTRY",
]

try:
    from .impls.X import XAdapter  # noqa: F401
    __all__.append("XAdapter")
except ImportError:
    pass

try:
    from .impls.Instagram import InstagramAdapter  # noqa: F401
    __all__.append("InstagramAdapter")
except ImportError:
    pass

try:
    from .impls.Threads import ThreadsAdapter  # noqa: F401
    __all__.append("ThreadsAdapter")
except ImportError:
    pass

try:
    from .impls.Blog import BlogAdapter  # noqa: F401
    __all__.append("BlogAdapter")
except ImportError:
    pass

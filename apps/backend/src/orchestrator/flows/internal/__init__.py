"""Internal orchestrator flows package."""

# Ensure flow modules are imported so their decorators run during autodiscovery.
from . import drafts  # noqa: F401
from . import insights  # noqa: F401
from . import llm  # noqa: F401
from . import mail  # noqa: F401

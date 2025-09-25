"""Aggregate router exposing Internal flows via the orchestrator."""

from __future__ import annotations

from apps.backend.src.orchestrator.dispatch import orchestrate_flow, runtime_dependency
from apps.backend.src.orchestrator.registry import FLOWS

router = FLOWS.build_router(
    orchestrate_flow,
    prefix="/internal",
    tags=["internal"],
    runtime_dependency=runtime_dependency,
    flow_filter=lambda flow: "internal" in flow.tags,
)
for r in router.routes:
    if hasattr(r, "include_in_schema"):
        r.include_in_schema = False


__all__ = ["router"]


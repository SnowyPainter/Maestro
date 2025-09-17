"""Aggregate router exposing BFF flows via the orchestrator."""

from __future__ import annotations

from apps.backend.src.orchestrator.dispatch import orchestrate_flow, runtime_dependency
from apps.backend.src.orchestrator.registry import FLOWS


router = FLOWS.build_router(
    orchestrate_flow,
    prefix="",
    tags=["bff"],
    runtime_dependency=runtime_dependency,
    flow_filter=lambda flow: "bff" in flow.tags and "internal" not in flow.tags,
)


__all__ = ["router"]


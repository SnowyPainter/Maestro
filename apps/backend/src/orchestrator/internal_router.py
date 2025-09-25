"""Aggregate router exposing Internal flows via the orchestrator."""

from __future__ import annotations

from apps.backend.src.orchestrator.dispatch import orchestrate_flow, runtime_dependency
from apps.backend.src.orchestrator.registry import FLOWS


"""

1. 현 구조상 FLOWS 에서 app.include_router 안해도 정상 동작하는지, runtime_dependency 대신에 다른걸로 해야하는지.
2. sniffer가 poll inbox하고 ingest_draft_mail 호출
3. 그 밖에 현재 synchro 의 find_similar_trends_for_persona 가 제대로 구현되어져있는지.

"""

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


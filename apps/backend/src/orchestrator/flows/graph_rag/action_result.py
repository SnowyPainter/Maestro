from __future__ import annotations

import time
from typing import Any, Dict, Iterable, List, Mapping, Optional

from apps.backend.src.modules.rag.schemas import (
    GraphRagActionAudit,
    GraphRagActionIntent,
    GraphRagActionResult,
)


def make_refresh_targets(
    persona_id: Optional[int],
    campaign_id: Optional[int],
) -> List[str]:
    targets: List[str] = []
    if persona_id:
        targets.append(f"persona:{persona_id}")
    if campaign_id:
        targets.append(f"campaign:{campaign_id}")
    return targets


def elapsed_ms(start: float) -> int:
    return int((time.perf_counter() - start) * 1000)


def build_action_result(
    *,
    status: str,
    message: str,
    action_key: str,
    intent: GraphRagActionIntent,
    inputs: Optional[Mapping[str, Any]] = None,
    outputs: Optional[Mapping[str, Any]] = None,
    reason: Optional[str] = None,
    confidence: Optional[float] = None,
    timing_ms: Optional[int] = None,
    refresh: Optional[Iterable[str]] = None,
    audit: Optional[GraphRagActionAudit] = None,
    dedupe_signature: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> GraphRagActionResult:
    """Standardize Graph RAG action responses (structured + backward-compatible)."""
    meta_payload: Dict[str, Any] = dict(meta or {})
    if inputs:
        meta_payload.setdefault("inputs", {}).update(inputs)
    if outputs:
        meta_payload.setdefault("outputs", {}).update(outputs)
    if audit:
        meta_payload.setdefault("audit", {}).update(
            {k: v for k, v in audit.model_dump().items() if v is not None}
        )

    return GraphRagActionResult(
        status=status,
        message=message,
        intent=intent,
        action_key=action_key,
        inputs=dict(inputs or {}),
        outputs=dict(outputs or {}),
        reason=reason,
        confidence=confidence,
        timing_ms=timing_ms,
        refresh=list(refresh or []),
        audit=audit,
        dedupe_signature=dedupe_signature,
        meta=meta_payload,
    )

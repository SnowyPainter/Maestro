from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence

from pydantic import BaseModel

from apps.backend.src.modules.rag.schemas import RagPersonaContext


def payload_to_dict(payload: Any) -> Dict[str, Any]:
    if isinstance(payload, BaseModel):
        if hasattr(payload, "model_dump"):
            return payload.model_dump()  # type: ignore[attr-defined]
        return payload.dict()  # type: ignore[attr-defined]
    if isinstance(payload, dict):
        return dict(payload)
    return dict(payload or {})


def persona_label(ctx: Optional[RagPersonaContext]) -> str:
    if ctx is None:
        return "our brand"
    if ctx.campaign_name and ctx.persona_name:
        return f"{ctx.persona_name} in {ctx.campaign_name}"
    if ctx.persona_name:
        return ctx.persona_name
    if ctx.campaign_name:
        return ctx.campaign_name
    return "our brand"


def persona_context_from_meta(
    meta: Optional[Dict[str, Any]],
    fallback: Optional[RagPersonaContext],
) -> Optional[RagPersonaContext]:
    if not meta:
        return fallback
    persona_id = extract_int(meta, ("persona_id", "personaId"))
    campaign_id = extract_int(meta, ("campaign_id", "campaignId"))
    persona_name = meta.get("persona_name") or meta.get("personaName")
    campaign_name = meta.get("campaign_name") or meta.get("campaignName")
    if not any([persona_id, campaign_id, persona_name, campaign_name]):
        return fallback
    return RagPersonaContext(
        persona_id=persona_id or (fallback.persona_id if fallback else None),
        persona_name=persona_name or (fallback.persona_name if fallback else None),
        campaign_id=campaign_id or (fallback.campaign_id if fallback else None),
        campaign_name=campaign_name or (fallback.campaign_name if fallback else None),
    )


def extract_reasons(meta: Optional[Dict[str, Any]]) -> List[str]:
    reasons: List[str] = []
    if not meta:
        return reasons
    for key in ("reason", "why", "insight"):
        value = meta.get(key)
        if isinstance(value, str):
            reasons.append(value)
    value = meta.get("reasons")
    if isinstance(value, list):
        reasons.extend(str(item) for item in value if item)
    return list(dict.fromkeys(reason for reason in reasons if reason))


def extract_int(
    meta: Optional[Dict[str, Any]],
    keys: Sequence[str],
    *,
    default: Optional[int] = None,
    fallback: Optional[int] = None,
) -> Optional[int]:
    if meta:
        for key in keys:
            value = meta.get(key)
            if value is None:
                continue
            try:
                return int(value)
            except (TypeError, ValueError):
                continue
    return fallback if fallback is not None else default


def extract_float(
    meta: Optional[Dict[str, Any]],
    keys: Sequence[str],
    *,
    default: float = 0.0,
) -> float:
    if meta:
        for key in keys:
            value = meta.get(key)
            if value is None:
                continue
            try:
                return float(value)
            except (TypeError, ValueError):
                continue
    return default


def parse_timestamp(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value)
        except (OverflowError, OSError, ValueError):
            return None
    if isinstance(value, str):
        for candidate in (value, value.replace("Z", "+00:00")):
            try:
                return datetime.fromisoformat(candidate)
            except ValueError:
                continue
    return None


def sort_key_ts(value: Optional[datetime]) -> float:
    if isinstance(value, datetime):
        try:
            return value.timestamp()
        except (OverflowError, OSError):
            return float("-inf")
    return float("-inf")


__all__ = [
    "payload_to_dict",
    "persona_label",
    "persona_context_from_meta",
    "extract_reasons",
    "extract_int",
    "extract_float",
    "parse_timestamp",
    "sort_key_ts",
]

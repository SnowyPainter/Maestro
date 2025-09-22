"""Shared helpers for card rendering across chat components."""

from __future__ import annotations

import re
from typing import Any, Dict, Mapping, Sequence, Tuple, Type, Union

from pydantic import BaseModel


CARD_TYPE_BY_MODEL_NAME: Mapping[str, str] = {
    "CampaignKPIResultOut": "campaign.kpi",
    "CampaignKPIDefListOut": "campaign.kpi_def",
    "CampaignOut": "campaign.detail",
    "CampaignList": "campaign.list",

    "DraftOut": "draft.detail",
    "DraftList": "draft.list",
    "DraftVariantRenderList": "draft.variant.list",
    "DraftVariantRenderDetail": "draft.variant.detail",

    "PersonaOut": "account.persona.detail",
    "PersonaList": "account.persona.list",
    "PlatformAccountOut": "account.pa.detail",
    "PlatformAccountList": "account.pa.list",

    "PersonaAccountOut": "account.persona_account.detail",
    "PersonaAccountList": "account.persona_account.list",

    "TrendsListResponse": "trends.list",

    "TimelineEventCollectionOut": "timeline.events.composed",
    
    "MessageOut": "info",
}

CARD_TYPE_RULES: Sequence[Tuple[re.Pattern[str], str]] = (
    (re.compile(r"kpi|metric|chart", re.IGNORECASE), "chart"),
    (re.compile(r"copy|editor", re.IGNORECASE), "editor"),
    (re.compile(r"list|series|collection", re.IGNORECASE), "table"),
    (re.compile(r"persona|profile|user", re.IGNORECASE), "profile"),
)


def card_type_for_model(model: Union[str, Type[BaseModel]]) -> str:
    """Return the frontend card type for a given Pydantic model or its name."""

    model_name = model if isinstance(model, str) else model.__name__
    direct = CARD_TYPE_BY_MODEL_NAME.get(model_name)
    if direct:
        return direct
    for pattern, card_type in CARD_TYPE_RULES:
        if pattern.search(model_name):
            return card_type
    return "generic"


def serialize_payload(value: Any) -> Dict[str, Any]:
    """Normalize operator output into a dict suitable for card payloads."""

    if isinstance(value, BaseModel):
        if hasattr(value, "model_dump"):
            return value.model_dump()  # type: ignore[attr-defined]
        return value.dict()  # type: ignore[call-arg]
    if isinstance(value, dict):
        return value
    if hasattr(value, "dict") and callable(value.dict):  # type: ignore[attr-defined]
        return value.dict()
    return {"value": value}


__all__ = [
    "CARD_TYPE_BY_MODEL_NAME",
    "CARD_TYPE_RULES",
    "card_type_for_model",
    "serialize_payload",
]

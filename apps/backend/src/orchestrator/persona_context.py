"""Helpers to propagate persona account context through orchestrator payloads."""

from __future__ import annotations

import typing
from collections.abc import Mapping, Sequence as SequenceABC
from types import UnionType
from typing import Annotated, Any, Dict, Optional, get_args, get_origin

from pydantic import BaseModel

PERSONA_FIELD_CANDIDATES = (
    "persona_account_id",
    "account_persona_id",
    "persona_account_ids",
    "account_persona_ids",
)

SEQUENCE_ORIGINS = {list, set, tuple, SequenceABC}


def _field_annotation_from_field(field: Any) -> Any:
    for attr in ("annotation", "outer_type_", "type_"):
        value = getattr(field, attr, None)
        if value is not None:
            return value
    return None


def _annotation_contains_type(annotation: Any, target: type) -> bool:
    if annotation is None:
        return False
    if annotation is target:
        return True
    origin = get_origin(annotation)
    if origin is None:
        return False
    if origin is Annotated:
        args = get_args(annotation)
        if args:
            return _annotation_contains_type(args[0], target)
        return False
    if origin in (typing.Union, UnionType):
        return any(_annotation_contains_type(arg, target) for arg in get_args(annotation))
    return any(_annotation_contains_type(arg, target) for arg in get_args(annotation))


def _annotation_is_sequence(annotation: Any) -> bool:
    if annotation is None:
        return False
    origin = get_origin(annotation)
    if origin is None:
        return False
    if origin in SEQUENCE_ORIGINS:
        return True
    if origin is Annotated:
        args = get_args(annotation)
        if args:
            return _annotation_is_sequence(args[0])
        return False
    if origin in (typing.Union, UnionType):
        return any(_annotation_is_sequence(arg) for arg in get_args(annotation))
    return False


def _sequence_item_annotation(annotation: Any) -> Any:
    if annotation is None:
        return None
    origin = get_origin(annotation)
    if origin in SEQUENCE_ORIGINS:
        args = get_args(annotation)
        if args:
            return args[0]
        return None
    if origin is Annotated:
        args = get_args(annotation)
        if args:
            return _sequence_item_annotation(args[0])
        return None
    if origin in (typing.Union, UnionType):
        for arg in get_args(annotation):
            candidate = _sequence_item_annotation(arg)
            if candidate is not None:
                return candidate
    return None


def _coerce_persona_scalar(raw: Any, annotation: Any) -> Optional[Any]:
    if raw is None:
        return None
    if _annotation_contains_type(annotation, str):
        return str(raw)
    if _annotation_contains_type(annotation, int):
        try:
            return int(raw)
        except (TypeError, ValueError):
            return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return str(raw)


def _coerce_persona_account_value(raw: Any, field: Any) -> Optional[Any]:
    annotation = _field_annotation_from_field(field)
    if _annotation_is_sequence(annotation):
        item_annotation = _sequence_item_annotation(annotation)
        scalar = _coerce_persona_scalar(raw, item_annotation)
        if scalar is None:
            return None
        return [scalar]
    return _coerce_persona_scalar(raw, annotation)


def persona_defaults_from_value(raw: Any, fields: Mapping[str, Any]) -> Dict[str, Any]:
    defaults: Dict[str, Any] = {}
    for name in PERSONA_FIELD_CANDIDATES:
        field = fields.get(name)
        if field is None:
            continue
        value = _coerce_persona_account_value(raw, field)
        if value is None:
            continue
        defaults[name] = value
    return defaults


def persona_context_defaults(fields: Mapping[str, Any]) -> Dict[str, Any]:
    from apps.backend.src.core.context import get_persona_account_id

    raw = get_persona_account_id()
    if not raw:
        return {}
    return persona_defaults_from_value(raw, fields)


def inject_persona_context(payload: BaseModel) -> BaseModel:
    fields = getattr(payload.__class__, "model_fields", None) or getattr(payload.__class__, "__fields__", {})
    if not fields:
        return payload

    defaults = persona_context_defaults(fields)
    if not defaults:
        return payload

    fields_set = getattr(payload, "model_fields_set", None)
    if fields_set is None:
        fields_set = getattr(payload, "__fields_set__", None)

    updates: Dict[str, Any] = {}
    for name, value in defaults.items():
        if name not in fields:
            continue
        if fields_set and name in fields_set:
            continue
        current = getattr(payload, name, None)
        if isinstance(current, (list, tuple, set)) and not current:
            updates[name] = value
            continue
        if current is None:
            updates[name] = value

    if not updates:
        return payload
    if hasattr(payload, "model_copy"):
        return payload.model_copy(update=updates)  # type: ignore[attr-defined]
    return payload.copy(update=updates)


__all__ = [
    "PERSONA_FIELD_CANDIDATES",
    "persona_context_defaults",
    "persona_defaults_from_value",
    "inject_persona_context",
]

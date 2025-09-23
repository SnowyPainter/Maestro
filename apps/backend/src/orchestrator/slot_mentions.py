"""Helpers for loading and working with explicit slot mention metadata."""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
import re
from typing import Any, Dict, Iterable, List, Optional, Sequence, Type, Union, get_args, get_origin

import yaml

from .registry import FLOWS


CONFIG_PATH = Path(__file__).resolve().parent / "config" / "slot_mentions.yaml"


@dataclass(frozen=True)
class SlotHint:
    name: str
    label: str
    description: str
    value_type: str = "string"
    choices: Sequence[str] = field(default_factory=tuple)
    synonyms: Sequence[str] = field(default_factory=tuple)
    flows: Sequence[str] = field(default_factory=tuple)

    @property
    def aliases(self) -> Sequence[str]:
        return (self.name, *self.synonyms)


@lru_cache(maxsize=1)
def load_slot_hints() -> List[SlotHint]:
    if not CONFIG_PATH.exists():
        return []
    with CONFIG_PATH.open("r", encoding="utf-8") as handle:
        raw = yaml.safe_load(handle) or {}
    items: List[SlotHint] = []
    for item in raw.get("slots", []) or []:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        if not name:
            continue
        choices: Sequence[str] = tuple(item.get("choices", []) or [])
        synonyms: Sequence[str] = tuple(item.get("synonyms", []) or [])
        flows: Sequence[str] = tuple(item.get("flows", []) or [])
        hint = SlotHint(
            name=str(name),
            label=str(item.get("label", name)),
            description=str(item.get("description", "")),
            value_type=str(item.get("value_type", "string")),
            choices=choices,
            synonyms=synonyms,
            flows=flows,
        )
        items.append(hint)
    return items


def slot_hint_map() -> Dict[str, SlotHint]:
    mapping: Dict[str, SlotHint] = {}
    for hint in load_slot_hints():
        for alias in hint.aliases:
            mapping[alias.lower()] = hint
    return mapping


def filter_slot_hints(
    *,
    query: Optional[str] = None,
    flow: Optional[str] = None,
    limit: Optional[int] = None,
) -> List[SlotHint]:
    hints = load_slot_hints()
    if flow:
        lowered_flow = flow.lower()
        hints = [
            hint
            for hint in hints
            if not hint.flows or lowered_flow in {f.lower() for f in hint.flows}
        ]
    if query:
        lowered_query = query.lower()
        hints = [
            hint
            for hint in hints
            if lowered_query in hint.name.lower()
            or lowered_query in hint.label.lower()
            or any(lowered_query in alias.lower() for alias in hint.aliases)
        ]
    if limit is not None and limit >= 0:
        hints = hints[:limit]
    return hints


def iter_hint_aliases(hints: Iterable[SlotHint]) -> Dict[str, SlotHint]:
    aliases: Dict[str, SlotHint] = {}
    for hint in hints:
        for alias in hint.aliases:
            aliases[alias.lower()] = hint
    return aliases


_MENTION_NAME_PATTERN = re.compile(r"@(?P<name>[a-zA-Z0-9_.]+)")
_INTEGER_PATTERN = re.compile(r"-?\d+")


def parse_slot_mentions(text: str) -> Dict[str, object]:
    """Extract explicitly mentioned slots from user text."""

    if "@" not in text:
        return {}

    hints_by_alias = slot_hint_map()
    results: Dict[str, object] = {}
    length = len(text)

    for match in _MENTION_NAME_PATTERN.finditer(text):
        alias = match.group("name")
        hint = hints_by_alias.get(alias.lower())
        if hint is None:
            continue

        value_start = match.end()
        while value_start < length and text[value_start].isspace():
            value_start += 1
        if value_start < length and text[value_start] in (":", "="):
            value_start += 1
            while value_start < length and text[value_start].isspace():
                value_start += 1

        next_marker = text.find("@", value_start)
        if next_marker == -1:
            next_marker = length

        raw_segment = text[value_start:next_marker].strip()
        value = _convert_segment(hint, raw_segment)
        if value is None:
            continue
        results[hint.name] = value

    return results


def _convert_segment(hint: SlotHint, segment: str) -> Optional[object]:
    if not segment:
        return None

    value_type = hint.value_type.lower()

    if value_type in {"int", "integer"}:
        match = _INTEGER_PATTERN.search(segment)
        if not match:
            return None
        try:
            return int(match.group())
        except ValueError:
            return None

    if value_type in {"int_list", "integer_list"}:
        values = [_to_int(token) for token in _INTEGER_PATTERN.findall(segment)]
        cleaned = [value for value in values if value is not None]
        return cleaned or None

    if value_type in {"enum", "choice"}:
        candidate = _extract_token(segment)
        if candidate is None:
            return None
        for choice in hint.choices:
            if candidate.lower() == choice.lower():
                return choice
        return candidate

    if value_type in {"string_list", "str_list", "list"}:
        parts = [part.strip(" \t\n\r,;:") for part in re.split(r",|;", segment) if part.strip()]
        return parts or None

    token = _extract_token(segment, allow_spaces=True)
    return token


def _to_int(value: str) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _extract_token(segment: str, *, allow_spaces: bool = False) -> Optional[str]:
    if not segment:
        return None
    cleaned = segment.strip()
    if cleaned and cleaned[0] in {"'", '"'}:
        quote = cleaned[0]
        closing = cleaned.find(quote, 1)
        if closing != -1:
            return cleaned[1:closing].strip()
        cleaned = cleaned[1:]
    if not allow_spaces:
        cleaned = cleaned.split()[0]
    return cleaned.strip(" \t\n\r,;:") or None


def _get_pydantic_fields(model_cls: Type[Any]) -> Dict[str, Any]:
    """Extract fields from a Pydantic model, supporting both v1 and v2."""
    # Try Pydantic v2 first
    fields = getattr(model_cls, "model_fields", None)
    if fields:
        return fields

    # Fall back to Pydantic v1
    fields = getattr(model_cls, "__fields__", None)
    if fields:
        return fields

    return {}


def _infer_value_type(field_info: Any) -> str:
    """Infer value_type from Pydantic field info."""
    # Try to get annotation/type info
    annotation = getattr(field_info, "annotation", None)
    if annotation is None:
        annotation = getattr(field_info, "outer_type_", None)
    if annotation is None:
        annotation = getattr(field_info, "type_", str)

    # Handle Union types (Optional, etc.)
    origin = get_origin(annotation)
    if origin is Union:
        args = get_args(annotation)
        # Remove None from Optional types
        non_none_args = [arg for arg in args if arg is not type(None)]
        if len(non_none_args) == 1:
            annotation = non_none_args[0]
            origin = get_origin(annotation)

    # Handle List types
    if origin in (list, List):
        args = get_args(annotation)
        if args:
            element_type = args[0]
            if element_type in (int, "int"):
                return "integer_list"
            elif element_type in (str, "str"):
                return "string_list"
        return "string_list"

    # Handle basic types
    if annotation in (int, "int"):
        return "integer"
    elif annotation in (str, "str"):
        return "string"
    elif annotation in (bool, "bool"):
        return "boolean"
    elif annotation in (float, "float"):
        return "float"

    # Handle enum types by checking if it's a subclass of Enum
    try:
        if hasattr(annotation, "__bases__"):
            for base in annotation.__bases__:
                if base.__name__ == "Enum":
                    return "enum"
    except:
        pass

    # Default to string
    return "string"


def _extract_field_choices(field_info: Any) -> List[str]:
    """Extract choices from Pydantic field if available."""
    choices = []

    # Check for literal types
    annotation = getattr(field_info, "annotation", None)
    if annotation is None:
        annotation = getattr(field_info, "outer_type_", None)
    if annotation is None:
        annotation = getattr(field_info, "type_", None)

    # Handle Literal types
    origin = get_origin(annotation)
    if origin is not None and hasattr(origin, "__name__") and origin.__name__ == "Literal":
        args = get_args(annotation)
        choices.extend(str(arg) for arg in args)

    # Check for enum values
    try:
        if hasattr(annotation, "__members__"):
            choices.extend(str(member.value) for member in annotation.__members__.values())
    except:
        pass

    return choices


def _generate_slot_hints_from_flows() -> List[SlotHint]:
    """Generate slot hints automatically from all registered flows."""
    try:
        from pydantic import BaseModel
    except ImportError:
        return []  # Pydantic not available, cannot generate hints

    hints_map: Dict[str, SlotHint] = {}

    # Get all flow definitions
    flows = FLOWS.all()

    for flow in flows:
        if not hasattr(flow, 'input_model') or not issubclass(flow.input_model, BaseModel):
            continue

        fields = _get_pydantic_fields(flow.input_model)

        for field_name, field_info in fields.items():
            value_type = _infer_value_type(field_info)
            choices = _extract_field_choices(field_info)

            # Get or create hint
            if field_name in hints_map:
                hint = hints_map[field_name]
                # Merge flows
                existing_flows = set(hint.flows)
                existing_flows.add(flow.key)
                merged_hint = SlotHint(
                    name=hint.name,
                    label=hint.label,
                    description=hint.description,
                    value_type=hint.value_type,
                    choices=hint.choices,
                    synonyms=hint.synonyms,
                    flows=tuple(sorted(existing_flows))
                )
                hints_map[field_name] = merged_hint
            else:
                # Create new hint
                label = field_name.replace('_', ' ').title()
                description = f"Filter by {label.lower()}"

                # Special handling for common patterns
                if field_name.endswith('_id'):
                    if value_type == "integer_list":
                        value_type = "integer_list"
                        description = f"Filter by multiple {label.lower()}s using commas"
                    else:
                        value_type = "integer"
                        description = f"Target a specific {label.lower()}"
                elif field_name in ('limit',):
                    value_type = "integer"
                    description = f"Limit the number of results"
                elif field_name in ('q', 'query', 'search'):
                    value_type = "string"
                    description = f"Set a keyword search term"
                elif field_name in ('since', 'until'):
                    value_type = "date"
                    description = f"Set a {field_name} date"
                elif field_name == 'platform':
                    value_type = "enum"
                    description = f"Filter by platform slug"

                hint = SlotHint(
                    name=field_name,
                    label=label,
                    description=description,
                    value_type=value_type,
                    choices=tuple(choices) if choices else (),
                    flows=(flow.key,)
                )
                hints_map[field_name] = hint

    return list(hints_map.values())


def generate_slot_mentions_yaml(output_path: Optional[Path] = None) -> None:
    """Generate slot_mentions.yaml file automatically from registered flows."""
    if output_path is None:
        output_path = CONFIG_PATH

    hints = _generate_slot_hints_from_flows()

    # Convert to YAML format
    slots_data = []
    for hint in sorted(hints, key=lambda h: h.name):
        slot_dict = {
            "name": hint.name,
            "label": hint.label,
            "description": hint.description,
            "value_type": hint.value_type,
        }

        if hint.choices:
            slot_dict["choices"] = list(hint.choices)
        if hint.synonyms:
            slot_dict["synonyms"] = list(hint.synonyms)
        if hint.flows:
            slot_dict["flows"] = list(hint.flows)

        slots_data.append(slot_dict)

    yaml_data = {"slots": slots_data}

    # Ensure config directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write YAML file
    with output_path.open("w", encoding="utf-8") as f:
        yaml.dump(yaml_data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)


__all__ = [
    "SlotHint",
    "load_slot_hints",
    "slot_hint_map",
    "filter_slot_hints",
    "iter_hint_aliases",
    "parse_slot_mentions",
    "generate_slot_mentions_yaml",
]

"""Helpers for loading and working with explicit slot mention metadata."""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
import re
from typing import Dict, Iterable, List, Optional, Sequence

import yaml


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


__all__ = [
    "SlotHint",
    "load_slot_hints",
    "slot_hint_map",
    "filter_slot_hints",
    "iter_hint_aliases",
    "parse_slot_mentions",
]

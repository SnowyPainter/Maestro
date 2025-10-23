from __future__ import annotations

from collections.abc import Iterable
from typing import Any, Dict, Iterable as IterableType, Mapping, Optional

from apps.backend.src.modules.common.enums import KPIKey


def _normalize_key(value: str) -> str:
    return value.strip().lower()


def _build_default_metric_map() -> Dict[str, KPIKey]:
    mapping: Dict[str, KPIKey] = {}
    for key in KPIKey:
        mapping[_normalize_key(key.value)] = key
        mapping[_normalize_key(key.name)] = key

    alias_pairs: Dict[str, KPIKey] = {
        "like": KPIKey.LIKES,
        "like_count": KPIKey.LIKES,
        "likes_count": KPIKey.LIKES,
        "comment": KPIKey.COMMENTS,
        "comment_count": KPIKey.COMMENTS,
        "comments_count": KPIKey.COMMENTS,
        "reply": KPIKey.COMMENTS,
        "replies": KPIKey.COMMENTS,
        "reply_count": KPIKey.COMMENTS,
        "share": KPIKey.SHARES,
        "shares": KPIKey.SHARES,
        "share_count": KPIKey.SHARES,
        "repost": KPIKey.SHARES,
        "reposts": KPIKey.SHARES,
        "retweet": KPIKey.SHARES,
        "retweets": KPIKey.SHARES,
        "quote": KPIKey.SHARES,
        "quotes": KPIKey.SHARES,
        "save": KPIKey.SAVES,
        "saves_count": KPIKey.SAVES,
        "follow": KPIKey.FOLLOWS,
        "follows": KPIKey.FOLLOWS,
        "followers": KPIKey.FOLLOWS,
        "linkclick": KPIKey.LINK_CLICKS,
        "link_clicks_count": KPIKey.LINK_CLICKS,
        "profile_views": KPIKey.PROFILE_VISITS,
        "profile_views_count": KPIKey.PROFILE_VISITS,
    }
    for alias, key in alias_pairs.items():
        mapping[_normalize_key(alias)] = key
    return mapping


DEFAULT_METRIC_MAP = _build_default_metric_map()


def _coerce_number(value: Any) -> Optional[float]:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _normalize_metric_map(
    metric_map: Optional[Mapping[str, str | KPIKey | IterableType[str | KPIKey]]],
) -> Dict[str, str | KPIKey | IterableType[str | KPIKey]]:
    if not metric_map:
        return {}
    normalized: Dict[str, str | KPIKey | IterableType[str | KPIKey]] = {}
    for raw_key, target in metric_map.items():
        if not isinstance(raw_key, str):
            continue
        normalized[raw_key] = target
        normalized[_normalize_key(raw_key)] = target
    return normalized


def _resolve_mapping(
    name: str,
    metric_map: Mapping[str, str | KPIKey | IterableType[str | KPIKey]],
) -> str | KPIKey | IterableType[str | KPIKey] | None:
    if name in metric_map:
        return metric_map[name]
    normalized = _normalize_key(name)
    if normalized in metric_map:
        return metric_map[normalized]
    return DEFAULT_METRIC_MAP.get(normalized)


def parse_metric_items(
    items: Iterable[Any] | None,
    metric_map: Optional[Mapping[str, str | KPIKey | IterableType[str | KPIKey]]] = None,
) -> Dict[str, float]:
    """Normalize a list of insight metric items into KPIKey-aligned dict."""
    metrics: Dict[str, float] = {}
    if not isinstance(items, Iterable):
        return metrics

    normalized_map = _normalize_metric_map(metric_map)

    for item in items:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        values = item.get("values")
        if not isinstance(name, str) or not isinstance(values, list) or not values:
            continue
        first = values[0]
        if not isinstance(first, dict):
            continue
        number = _coerce_number(first.get("value"))
        if number is None:
            continue

        mapping_entry = _resolve_mapping(name, normalized_map)
        if mapping_entry is None:
            continue

        if (
            isinstance(mapping_entry, Iterable)
            and not isinstance(mapping_entry, (str, KPIKey))
        ):
            targets: IterableType[str | KPIKey] = mapping_entry
        else:
            targets = (mapping_entry,)

        for target in targets:
            key = target.value if isinstance(target, KPIKey) else str(target)
            metrics[key] = metrics.get(key, 0.0) + float(number)
    return metrics


def parse_metric_payload(
    payload: Dict[str, Any] | None,
    *,
    metric_map: Optional[Mapping[str, str | KPIKey | IterableType[str | KPIKey]]] = None,
    data_key: str = "data",
) -> Dict[str, float]:
    """Convenience wrapper to parse Graph-like metric payloads."""
    if not isinstance(payload, dict):
        return {}
    items = payload.get(data_key)
    return parse_metric_items(items, metric_map)

"""Lightweight NLP helpers for the orchestrator chat experience."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, Set
from typing import get_args, get_origin

import dateparser
from pydantic import BaseModel, Field

from .registry import FLOWS


class IntentResult(BaseModel):
    """Structured output describing an analysed user utterance."""

    intent: str
    confidence: float = 0.0
    candidates: List["IntentCandidate"] = Field(default_factory=list)
    slots: Dict[str, Any] = Field(default_factory=dict)
    raw_text: str
    keywords: List[str] = Field(default_factory=list)


class IntentCandidate(BaseModel):
    intent: str
    confidence: float


@dataclass(frozen=True)
class _IntentRule:
    intent: str
    keywords: List[str]
    base_confidence: float = 0.5
    boost_per_keyword: float = 0.08
    minimum_matches: int = 1


INTENT_KEYWORD_OVERRIDES: Dict[str, Sequence[str]] = {
    "campaigns.aggregate_kpis": ["kpi", "performance", "metrics"],
    "campaigns.record_kpi_result": ["record", "log", "metric"],
    "drafts.create": ["draft", "copy", "content"],
}


class NlpEngine:
    """Extremely lightweight intent parser built for English utterances."""

    CAMPAIGN_PATTERN = re.compile(r"(?:campaign|campaigns|camp)\s*(\d+)|#(\d+)", re.IGNORECASE)
    LABEL_STOPWORDS: Set[str] = {
        "id",
        "ids",
        "identifier",
        "number",
        "no",
        "num",
    }

    def __init__(self) -> None:
        self.rules: List[_IntentRule] = self._build_rules()

    def parse(self, message: str) -> IntentResult:
        lowered = message.lower()
        slots = self._extract_common_slots(message)
        keywords = self._extract_keywords(lowered)

        candidates = self._score_intents(lowered)
        if candidates:
            top = max(candidates, key=lambda item: item.confidence)
            intent = top.intent
            confidence = top.confidence
        else:
            intent = "unknown"
            confidence = 0.2

        return IntentResult(
            intent=intent,
            confidence=confidence,
            candidates=candidates,
            slots=slots,
            raw_text=message,
            keywords=keywords,
        )

    def extract_slots_for_model(self, message: str, model_cls: type[BaseModel]) -> Dict[str, Any]:
        """Infer slots that are relevant for a specific flow payload model."""

        keywords = self._extract_keywords(message.lower())
        slots = self._extract_common_slots(message)

        fields = self._model_fields(model_cls)
        inferred: Dict[str, Any] = {}

        for name, field in fields.items():
            if name in slots or name in inferred:
                continue
            candidates = self._label_candidates(name, field)
            combined_slots = {**slots, **inferred}
            value = self._infer_slot_value(
                field_name=name,
                field=field,
                label_candidates=candidates,
                message=message,
                keywords=keywords,
                existing=combined_slots,
            )
            if value is not None:
                inferred[name] = value

        # Synchronise common alias patterns
        campaign_ids = inferred.get("campaign_ids") or slots.get("campaign_ids")
        if campaign_ids:
            if "campaign_ids" in fields and "campaign_ids" not in inferred:
                inferred["campaign_ids"] = campaign_ids
            if "campaign_id" in fields and "campaign_id" not in inferred:
                inferred["campaign_id"] = campaign_ids[0]

        as_of = inferred.get("as_of") or slots.get("as_of")
        if as_of and "as_of" in fields and "as_of" not in inferred:
            inferred["as_of"] = as_of

        if keywords and "keywords" in fields and "keywords" not in inferred:
            inferred["keywords"] = keywords

        combined = {**slots, **inferred}
        return {key: value for key, value in combined.items() if value is not None}

    def _score_intents(self, lowered: str) -> List[IntentCandidate]:
        candidates: List[IntentCandidate] = []
        for rule in self.rules:
            hits = sum(1 for keyword in rule.keywords if keyword in lowered)
            if hits < rule.minimum_matches:
                continue
            confidence = min(1.0, rule.base_confidence + rule.boost_per_keyword * hits)
            candidates.append(IntentCandidate(intent=rule.intent, confidence=confidence))
        candidates.sort(key=lambda item: item.confidence, reverse=True)
        return candidates

    def _build_rules(self) -> List[_IntentRule]:
        rules: List[_IntentRule] = []
        try:
            flows = FLOWS.all()
        except Exception:  # pragma: no cover - during early imports
            flows = []
        for flow in flows:
            keywords = set(self._tokenize(flow.title))
            keywords.update(self._tokenize(flow.key.replace(".", " ")))
            for tag in flow.tags:
                keywords.update(self._tokenize(tag))
            if flow.description:
                keywords.update(self._tokenize(flow.description))
            overrides = INTENT_KEYWORD_OVERRIDES.get(flow.key, [])
            keywords.update(word.lower() for word in overrides)
            filtered = [kw for kw in keywords if len(kw) > 2]
            if not filtered:
                continue
            base_conf = min(0.8, 0.45 + 0.02 * len(filtered))
            rule = _IntentRule(
                intent=flow.key,
                keywords=sorted(filtered)[:15],
                base_confidence=base_conf,
                boost_per_keyword=0.04,
                minimum_matches=1,
            )
            rules.append(rule)
        if not rules:
            rules.extend(
                [
                    _IntentRule(
                        intent="campaign.aggregate_kpis",
                        keywords=["kpi", "metric"],
                        base_confidence=0.6,
                    ),
                    _IntentRule(
                        intent="campaign.summary",
                        keywords=["summary", "overview"],
                        base_confidence=0.55,
                    ),
                    _IntentRule(
                        intent="draft.create",
                        keywords=["draft", "create"],
                        base_confidence=0.5,
                    ),
                ]
            )
        return rules

    def _extract_keywords(self, lowered: str) -> List[str]:
        tokens = re.findall(r"[a-z0-9]+", lowered)
        seen = set()
        keywords: List[str] = []
        for token in tokens:
            if token in seen:
                continue
            seen.add(token)
            keywords.append(token)
        return keywords[:20]

    def _extract_campaign_ids(self, text: str) -> List[int]:
        ids: List[int] = []
        for match in self.CAMPAIGN_PATTERN.findall(text):
            for group in match:
                if not group:
                    continue
                try:
                    ids.append(int(group))
                except ValueError:
                    continue
        return ids

    def _extract_temporal_slot(self, text: str) -> Optional[str]:
        parsed = dateparser.parse(
            text,
            settings={
                "TIMEZONE": "UTC",
                "RETURN_AS_TIMEZONE_AWARE": False,
                "PREFER_DATES_FROM": "past",
            },
        )
        if not parsed:
            return None
        if isinstance(parsed, datetime):
            return parsed.date().isoformat()
        return None

    def _tokenize(self, text: str) -> List[str]:
        return [token for token in re.findall(r"[a-z0-9]+", text.lower()) if token]

    def _extract_common_slots(self, text: str) -> Dict[str, Any]:
        slots: Dict[str, Any] = {}
        campaign_ids = self._extract_campaign_ids(text)
        if campaign_ids:
            slots["campaign_ids"] = campaign_ids
            slots["campaign_id"] = campaign_ids[0]

        as_of = self._extract_temporal_slot(text)
        if as_of:
            slots["as_of"] = as_of

        return slots

    def _infer_slot_value(
        self,
        *,
        field_name: str,
        field: Any,
        label_candidates: List[str],
        message: str,
        keywords: List[str],
        existing: Dict[str, Any],
    ) -> Optional[Any]:
        name = field_name.lower()

        annotation = self._field_annotation(field)
        is_sequence = self._is_sequence_annotation(annotation)
        item_annotation = self._sequence_item_annotation(annotation) if is_sequence else annotation
        expects_int = self._annotation_is_int(item_annotation) or name.endswith("_id") or name.endswith("_ids")

        if name.endswith("_ids") and not is_sequence:
            is_sequence = True
        expects_str = self._annotation_is_str(item_annotation)

        text_like_fields = {"title", "description", "details", "summary", "note", "goal", "message", "body"}
        list_text_fields = {"tags", "labels"}

        if not expects_str and name in text_like_fields:
            expects_str = True
        if not is_sequence and name in list_text_fields:
            is_sequence = True
            expects_str = True

        if "campaign" in name and name.endswith("ids"):
            return existing.get("campaign_ids") or self._extract_campaign_ids(message)

        if "campaign" in name and name.endswith("id"):
            ids = existing.get("campaign_ids") or self._extract_campaign_ids(message)
            if ids:
                return ids[0]

        if any(token in name for token in ("as_of", "date", "day")):
            return existing.get("as_of") or self._extract_temporal_slot(message)

        if expects_int:
            labeled = self._extract_labeled_ids(message, label_candidates)
            if not labeled and name in existing and isinstance(existing[name], list):
                labeled = existing[name]
            if labeled:
                if is_sequence or name.endswith("_ids"):
                    return labeled
                return labeled[0]

        if name == "keywords" and keywords:
            return keywords

        if name in {"query", "search", "search_term", "search_query"}:
            return message.strip()

        labeled_text = None
        if expects_str:
            labeled_text = self._extract_labeled_text(message, label_candidates)

        if labeled_text:
            if is_sequence:
                parts = [part.strip() for part in re.split(r",|/|;|\band\b", labeled_text) if part.strip()]
                if parts:
                    return parts
            else:
                return labeled_text.strip()

        if name in {"text", "description", "details"}:
            return message.strip()

        return None

    def _model_fields(self, model_cls: type[BaseModel]) -> Dict[str, Any]:
        if hasattr(model_cls, "model_fields"):
            return model_cls.model_fields  # type: ignore[attr-defined]
        return getattr(model_cls, "__fields__", {})

    def _label_candidates(self, field_name: str, field: Any) -> List[str]:
        seen: Set[str] = set()
        candidates: List[str] = []

        def push(raw: Optional[str]) -> None:
            if not raw:
                return
            normalized = self._normalize_label(raw)
            if not normalized or normalized in seen:
                return
            seen.add(normalized)
            candidates.append(normalized)

        push(field_name)
        if field_name.endswith("_id"):
            push(field_name[:-3])
        if field_name.endswith("_ids"):
            push(field_name[:-4])
        if "_" in field_name:
            push(field_name.replace("_", " "))
        for part in re.split(r"[_\s]+", field_name):
            push(part)

        alias = getattr(field, "alias", None)
        push(alias)

        info = getattr(field, "field_info", None)
        if info is None and hasattr(field, "title"):
            info = field
        if info is not None:
            push(getattr(info, "title", None))
            push(getattr(info, "description", None))
            extra = getattr(info, "extra", None)
            if extra is None:
                extra = getattr(info, "json_schema_extra", None)
            if isinstance(extra, dict):
                for value in extra.values():
                    if isinstance(value, str):
                        push(value)

        return candidates

    def _normalize_label(self, raw: str) -> Optional[str]:
        tokens = [token for token in re.findall(r"[a-z0-9]+", raw.lower()) if token and token not in self.LABEL_STOPWORDS]
        if not tokens:
            return None
        return " ".join(tokens)

    def _extract_labeled_ids(self, text: str, labels: Sequence[str]) -> List[int]:
        seen: Set[int] = set()
        results: List[int] = []
        for label in labels:
            pattern = self._build_label_regex(label)
            if pattern is None:
                continue
            for match in pattern.finditer(text):
                value = match.group("value")
                try:
                    parsed = int(value)
                except (TypeError, ValueError):
                    continue
                if parsed in seen:
                    continue
                seen.add(parsed)
                results.append(parsed)
        return results

    def _build_label_regex(self, label: Optional[str]) -> Optional[re.Pattern]:
        if not label:
            return None
        tokens = [token for token in label.split(" ") if token]
        if not tokens:
            return None
        joiner = r"[\s/_-]*"
        token_pattern = joiner.join(fr"{re.escape(token)}s?" for token in tokens)
        pattern = rf"(?<![a-z0-9]){token_pattern}(?:{joiner}(?:id|ids|identifier|number|no\.?))?" \
            rf"[\s:#!-]*?(?P<value>-?\d+)"
        return re.compile(pattern, re.IGNORECASE)

    def _extract_labeled_text(self, text: str, labels: Sequence[str]) -> Optional[str]:
        lowered = text.lower()
        for label in labels:
            if not label:
                continue
            target = label.lower()
            index = lowered.find(target)
            if index == -1:
                continue
            start = index + len(target)
            snippet = text[start:]
            match = re.match(r"\s*(?:is|=|:|->)?\s*['\"]?([^'\"\n\r;,]+)", snippet)
            if match:
                return match.group(1).strip()
        return None

    def _field_annotation(self, field: Any) -> Any:
        for attr in ("annotation", "outer_type_", "type_"):
            value = getattr(field, attr, None)
            if value is not None:
                return value
        return None

    def _annotation_is_int(self, annotation: Any) -> bool:
        if annotation is None:
            return False
        if annotation is int:
            return True
        origin = get_origin(annotation)
        if origin is None:
            return False
        return any(self._annotation_is_int(arg) for arg in get_args(annotation))

    def _annotation_is_str(self, annotation: Any) -> bool:
        if annotation is None:
            return False
        if annotation is str:
            return True
        origin = get_origin(annotation)
        if origin is None:
            return False
        return any(self._annotation_is_str(arg) for arg in get_args(annotation))

    def _is_sequence_annotation(self, annotation: Any) -> bool:
        if annotation is None:
            return False
        origin = get_origin(annotation)
        if origin is None:
            return False
        return origin in (list, set, tuple, SequenceABC)

    def _sequence_item_annotation(self, annotation: Any) -> Any:
        if annotation is None:
            return None
        origin = get_origin(annotation)
        if origin in (list, set, tuple, SequenceABC):
            args = get_args(annotation)
            if args:
                return args[0]
        return None


nlp_engine = NlpEngine()


__all__ = ["IntentCandidate", "IntentResult", "NlpEngine", "nlp_engine"]
from collections.abc import Sequence as SequenceABC

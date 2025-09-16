"""Lightweight NLP helpers for the orchestrator chat experience."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Sequence

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


@dataclass
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

    def __init__(self) -> None:
        self.rules: List[_IntentRule] = self._build_rules()

    def parse(self, message: str) -> IntentResult:
        lowered = message.lower()
        slots: Dict[str, Any] = {}
        keywords = self._extract_keywords(lowered)

        campaign_ids = self._extract_campaign_ids(message)
        if campaign_ids:
            slots["campaign_ids"] = campaign_ids
            slots["campaign_id"] = campaign_ids[0]

        as_of = self._extract_temporal_slot(message)
        if as_of:
            slots["as_of"] = as_of

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
                "LANGUAGE": "en",
            },
        )
        if not parsed:
            return None
        if isinstance(parsed, datetime):
            return parsed.date().isoformat()
        return None

    def _tokenize(self, text: str) -> List[str]:
        return [token for token in re.findall(r"[a-z0-9]+", text.lower()) if token]


nlp_engine = NlpEngine()


__all__ = ["IntentCandidate", "IntentResult", "NlpEngine", "nlp_engine"]

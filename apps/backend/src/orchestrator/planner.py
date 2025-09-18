"""Planner that maps natural language intents to orchestrator actions."""

from __future__ import annotations

import hashlib
import logging
import math
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Literal, Mapping, Optional, Sequence, Tuple

from pydantic import BaseModel, ValidationError

from apps.backend.src.services.embeddings import embed_texts
from .cards import card_type_for_model
from .nlp import nlp_engine
from .persona_context import persona_context_defaults
from .registry import FLOWS, FlowDefinition

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal plan/step containers
# ---------------------------------------------------------------------------


@dataclass
class PlanExecutionStep:
    id: Optional[str]
    kind: Literal["flow", "dynamic"]
    payload: Dict[str, Any] = field(default_factory=dict)
    payload_builder: Optional[Callable[[Mapping[str, Any]], Dict[str, Any]]] = None
    depends_on: Tuple[str, ...] = field(default_factory=tuple)
    flow_key: Optional[str] = None
    flow: Optional[FlowDefinition] = None
    title: Optional[str] = None
    card_hint: Optional[str] = None


@dataclass
class ChatPlan:
    steps: List[PlanExecutionStep]
    messages: List[str]
    notes: Optional[str] = None
    primary_match: Optional[FlowMatch] = None
    slots: Dict[str, Any] = field(default_factory=dict)
    alternatives: List[FlowMatch] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Flow matcher powered by embeddings with keyword fallback
# ---------------------------------------------------------------------------


@dataclass
class FlowMatch:
    score: float
    flow: FlowDefinition
    strategy: Literal["embedding", "keyword"]


class FlowMatcher:
    MIN_EMBED_SCORE = 0.35
    MIN_KEYWORD_SCORE = 0.15

    def __init__(self) -> None:
        self._cached_signature = ""
        self._flow_refs: List[FlowDefinition] = []
        self._flow_vectors: List[List[float]] = []
        self._flow_tokens: List[set[str]] = []
        self._token_idf: Dict[str, float] = {}

    async def search(self, query: str, *, top_k: int = 5) -> List[FlowMatch]:
        FLOWS.autodiscover()
        flows = list(FLOWS.all())
        await self._ensure_index(flows)

        results: List[FlowMatch] = []

        if self._flow_vectors:
            try:
                query_vec = (await embed_texts([query]))[0]
                query_vec = self._normalize(query_vec)
            except Exception as exc:  # pragma: no cover - network failure fallback
                logger.warning(
                    "Embedding search failed, falling back to keyword matching: %s", exc
                )
            else:
                for flow, flow_vec in zip(self._flow_refs, self._flow_vectors):
                    if not flow_vec:
                        continue
                    score = sum(a * b for a, b in zip(query_vec, flow_vec))
                    if score < self.MIN_EMBED_SCORE:
                        continue
                    results.append(FlowMatch(score=score, flow=flow, strategy="embedding"))

        if not results:
            results = self._keyword_search(query, flows, top_k=top_k)

        results.sort(key=lambda item: item.score, reverse=True)
        return results[:top_k]

    async def _ensure_index(self, flows: List[FlowDefinition]) -> None:
        signature = self._compute_signature(flows)
        if signature == self._cached_signature:
            return

        texts = [self._flow_text(flow) for flow in flows]
        vectors: List[List[float]] = []
        if texts:
            try:
                raw_vectors = await embed_texts(texts)
                vectors = [self._normalize(vec) for vec in raw_vectors]
            except Exception as exc:  # pragma: no cover
                logger.warning("Failed to compute flow embeddings: %s", exc)
                vectors = [[] for _ in flows]

        token_sets: List[set[str]] = []
        df_counter: Counter[str] = Counter()
        for flow in flows:
            tokens = set(self._tokenize(self._flow_text(flow)))
            token_sets.append(tokens)
            for token in tokens:
                df_counter[token] += 1
        total_docs = max(len(flows), 1)
        self._token_idf = {
            token: math.log((total_docs + 1) / (df + 1)) + 1.0 for token, df in df_counter.items()
        }

        self._flow_refs = flows
        self._flow_vectors = vectors
        self._flow_tokens = token_sets
        self._cached_signature = signature

    def _keyword_search(self, query: str, flows: List[FlowDefinition], *, top_k: int) -> List[FlowMatch]:
        query_tokens = self._tokenize(query)
        if not query_tokens or not self._flow_tokens:
            return []
        token_weights = {token: self._token_idf.get(token, 0.5) for token in query_tokens}
        max_weight = sum(token_weights.values()) or 1.0
        scored: List[FlowMatch] = []
        query_set = set(query_tokens)
        for flow, tokens in zip(self._flow_refs, self._flow_tokens):
            if not tokens:
                continue
            common = tokens & query_set
            if not common:
                continue
            score = sum(token_weights.get(token, 0.0) for token in common) / max_weight
            if score < self.MIN_KEYWORD_SCORE:
                continue
            scored.append(FlowMatch(score=score, flow=flow, strategy="keyword"))
        scored.sort(key=lambda item: item.score, reverse=True)
        return scored[:top_k]

    def _flow_text(self, flow: FlowDefinition) -> str:
        tag_text = " ".join(flow.tags)
        return f"{flow.title} {flow.description or ''} {flow.key} {tag_text}".strip()

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r"[a-z0-9]+", text.lower())

    def _normalize(self, vector: Sequence[float]) -> List[float]:
        norm = math.sqrt(sum(component * component for component in vector)) or 1.0
        return [component / norm for component in vector]

    def _compute_signature(self, flows: List[FlowDefinition]) -> str:
        if not flows:
            return ""
        descriptor = "|".join(
            f"{flow.key}:{flow.title}:{flow.description or ''}:{','.join(sorted(flow.tags))}"
            for flow in flows
        )
        return hashlib.sha1(descriptor.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Planner implementation
# ---------------------------------------------------------------------------


class FlowPlanner:
    def __init__(self) -> None:
        self._matcher = FlowMatcher()

    async def plan(self, message: str) -> ChatPlan:
        segments = self._split_compound_message(message)
        if len(segments) > 1:
            return await self._plan_segments(message, segments)
        return await self._plan_single(message)

    async def _plan_single(self, message: str) -> ChatPlan:
        matches = await self._matcher.search(message, top_k=5)
        if not matches:
            return ChatPlan(steps=[], messages=self._no_match_messages(message), notes=None)

        attempted_slots: Dict[str, Any] = {}
        for idx, match in enumerate(matches):
            slots = self._extract_flow_slots(match.flow, message)
            steps = self._build_flow_steps(match.flow, slots, message)
            if steps:
                self._ensure_step_ids(steps)
                notes = (
                    f"Matched flow '{match.flow.title}' via {match.strategy} search "
                    f"(score {match.score:.2f})."
                )
                alternatives = [candidate for pos, candidate in enumerate(matches) if pos != idx]
                return ChatPlan(
                    steps=steps,
                    messages=[],
                    notes=notes,
                    primary_match=match,
                    slots=slots,
                    alternatives=self._trim_alternatives(alternatives, match),
                )
            if not attempted_slots:
                attempted_slots = slots

        suggestions = self._no_match_messages(message, matches=matches)
        return ChatPlan(
            steps=[],
            messages=suggestions,
            notes=None,
            primary_match=matches[0],
            alternatives=self._trim_alternatives(matches[1:], matches[0]),
            slots=attempted_slots,
        )

    async def _plan_segments(self, original: str, segments: List[str]) -> ChatPlan:
        combined_steps: List[PlanExecutionStep] = []
        messages: List[str] = []
        notes: List[str] = []
        primary_match: Optional[FlowMatch] = None
        alternatives: List[FlowMatch] = []
        merged_slots: Dict[str, Any] = {}
        step_counter = 0

        for index, segment in enumerate(segments, start=1):
            segment_text = segment.strip()
            if not segment_text:
                continue

            segment_plan = await self._plan_single(segment_text)
            merged_slots.update(segment_plan.slots)
            if segment_plan.primary_match and primary_match is None:
                primary_match = segment_plan.primary_match
            alternatives.extend(segment_plan.alternatives)

            if segment_plan.steps:
                label = (
                    segment_plan.notes
                    or f"Step {index}: matched {segment_plan.primary_match.flow.key if segment_plan.primary_match else 'flow'}"
                )
                notes.append(label)
                self._ensure_step_ids(segment_plan.steps, start=step_counter + 1, force=True)
                step_counter += len(segment_plan.steps)
                combined_steps.extend(segment_plan.steps)
            else:
                prefix = f"segment {index} ('{segment_text}')"
                if segment_plan.messages:
                    messages.extend(f"{prefix}: {msg}" for msg in segment_plan.messages)
                else:
                    messages.append(f"{prefix}: no executable flow identified")

        if not combined_steps:
            return ChatPlan(
                steps=[],
                messages=messages or self._no_match_messages(original),
                notes=None,
                primary_match=primary_match,
                slots=merged_slots,
                alternatives=self._trim_alternatives(alternatives, primary_match),
            )

        self._apply_flow_adapters(combined_steps)
        note_text = "\n".join(note for note in notes if note)
        return ChatPlan(
            steps=combined_steps,
            messages=messages,
            notes=note_text or None,
            primary_match=primary_match,
            slots=merged_slots,
            alternatives=self._trim_alternatives(alternatives, primary_match),
        )

    def _split_compound_message(self, message: str) -> List[str]:
        pattern = re.compile(
            r"(?i)\b(?:and then|then|and)\b|[,;]|(?:그리고|그다음|그 다음|이후에)"
        )
        segments: List[str] = []
        last_index = 0
        for match in pattern.finditer(message):
            segment = message[last_index : match.start()].strip(" .,;")
            if segment:
                segments.append(segment)
            last_index = match.end()
        tail = message[last_index:].strip(" .,;")
        if tail:
            segments.append(tail)
        return segments if len(segments) > 1 else [message]

    def _ensure_step_ids(
        self,
        steps: List[PlanExecutionStep],
        *,
        start: int = 1,
        force: bool = False,
    ) -> None:
        for offset, step in enumerate(steps, start=start):
            if force or step.id is None:
                step.id = f"step{offset}"

    def _trim_alternatives(
        self,
        candidates: List[FlowMatch],
        primary: Optional[FlowMatch],
        *,
        limit: int = 5,
    ) -> List[FlowMatch]:
        seen: set[str] = set()
        if primary:
            seen.add(primary.flow.key)
        unique: List[FlowMatch] = []
        for match in candidates:
            if match.flow.key in seen:
                continue
            seen.add(match.flow.key)
            unique.append(match)
            if len(unique) >= limit:
                break
        return unique

    def _apply_flow_adapters(self, steps: List[PlanExecutionStep]) -> None:
        if len(steps) < 2:
            return

        from .adapters import FLOW_ADAPTERS as imported_adapters
        FLOW_ADAPTERS = imported_adapters

        for previous, current in zip(steps, steps[1:]):
            if previous.flow_key is None or current.flow_key is None:
                continue
            if current.payload_builder is not None:
                continue
            adapter = FLOW_ADAPTERS.get((previous.flow_key, current.flow_key))
            if adapter is None:
                continue
            prev_id = previous.id or previous.flow_key
            base_payload = dict(current.payload)

            def builder(result_map: Mapping[str, Any], *, _adapter=adapter, _prev_id=prev_id, _base=base_payload) -> Dict[str, Any]:
                if _prev_id not in result_map:
                    raise KeyError(f"Missing result for step '{_prev_id}'")
                return _adapter(result_map[_prev_id], dict(_base))

            current.payload_builder = builder
            current.depends_on = tuple(sorted(set(current.depends_on + (prev_id,))))

    def _build_flow_steps(
        self,
        flow: FlowDefinition,
        slots: Dict[str, Any],
        message: str,
    ) -> List[PlanExecutionStep]:
        payload = self._build_payload(flow.input_model, slots, message)
        card_hint = card_type_for_model(flow.output_model)

        if payload is not None:
            return [
                PlanExecutionStep(
                    id=None,
                    kind="flow",
                    flow_key=flow.key,
                    payload=payload,
                    card_hint=card_hint,
                )
            ]

        # Try fan-out by campaign IDs for flows expecting a single campaign
        if "campaign_ids" in slots:
            campaign_ids = slots["campaign_ids"]
            steps: List[PlanExecutionStep] = []
            for cid in campaign_ids:
                overrides = dict(slots)
                overrides["campaign_id"] = cid
                payload = self._build_payload(flow.input_model, overrides, message)
                if payload is None:
                    continue
                title = f"Campaign #{cid}"
                steps.append(
                    PlanExecutionStep(
                        id=None,
                        kind="flow",
                        flow_key=flow.key,
                        payload=payload,
                        title=title,
                        card_hint=card_hint,
                    )
                )
            if steps:
                return steps

        return []

    def _extract_flow_slots(self, flow: FlowDefinition, message: str) -> Dict[str, Any]:
        try:
            flow_specific = nlp_engine.extract_slots_for_model(message, flow.input_model)
        except Exception:  # pragma: no cover - defensive, should not happen
            flow_specific = {}
        slots = dict(flow_specific)
        context_defaults = self._persona_context_defaults(self._model_fields(flow.input_model))
        for key, value in context_defaults.items():
            slots.setdefault(key, value)
        return slots

    def _build_payload(
        self,
        model_cls: type[BaseModel],
        slots: Dict[str, Any],
        message: str,
    ) -> Optional[Dict[str, Any]]:
        fields = self._model_fields(model_cls)
        data: Dict[str, Any] = {}

        for name in fields.keys():
            if name in slots:
                data[name] = slots[name]
                continue
            plural = f"{name}s"
            if plural in slots and isinstance(slots[plural], list) and slots[plural]:
                data[name] = slots[plural][0]
                continue
            if name == "title":
                data[name] = message[:50].strip() or "Untitled"
                continue
            if name == "ir":
                data[name] = self._default_draft_ir(message)
                continue
            # skip optional fields (will be handled by model defaults)

        context_defaults = self._persona_context_defaults(fields)
        for key, value in context_defaults.items():
            data.setdefault(key, value)

        try:
            model_cls(**data)
        except ValidationError:
            return None
        return data

    def _persona_context_defaults(self, fields: Mapping[str, Any]) -> Dict[str, Any]:
        return persona_context_defaults(fields)

    def _model_fields(self, model_cls: type[BaseModel]) -> Dict[str, Any]:
        if hasattr(model_cls, "model_fields"):
            return model_cls.model_fields  # type: ignore[attr-defined]
        return getattr(model_cls, "__fields__", {})

    def _default_draft_ir(self, text: str) -> Dict[str, Any]:
        markdown = text.strip() or "Generated draft from chat request."
        return {
            "blocks": [
                {
                    "type": "text",
                    "props": {"markdown": markdown},
                }
            ],
            "options": {},
        }

    def _no_match_messages(
        self,
        message: str,
        *,
        matches: Optional[List[FlowMatch]] = None,
    ) -> List[str]:
        base = "I couldn't map this request to an orchestration flow yet."
        hint = "Try referencing a campaign id (e.g. #123) or ask for a specific action."
        response = [base]
        if matches:
            shortlist = ", ".join(f"{match.flow.key} ({match.score:.2f})" for match in matches[:3])
            response.append(f"Closest matches were {shortlist}.")
        if message.strip():
            response.append(hint)
        return response

flow_planner = FlowPlanner()


__all__ = ["ChatPlan", "FlowMatch", "PlanExecutionStep", "FlowPlanner", "flow_planner"]

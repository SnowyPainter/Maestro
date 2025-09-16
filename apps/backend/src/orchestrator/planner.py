"""Planner that maps natural language intents to orchestrator actions."""

from __future__ import annotations

import hashlib
import logging
import math
from collections import Counter, deque
from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional, Sequence, Tuple

import re

from pydantic import BaseModel, ValidationError

from apps.backend.src.services.embeddings import embed_texts
from .cards import card_type_for_model
from .nlp import IntentResult
from .registry import FLOWS, FlowBuilder, FlowDefinition, OperatorMeta, REGISTRY

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal plan/step containers
# ---------------------------------------------------------------------------


@dataclass
class PlanExecutionStep:
    kind: Literal["flow", "dynamic"]
    payload: Dict[str, Any]
    flow_key: Optional[str] = None
    flow: Optional[FlowDefinition] = None
    title: Optional[str] = None
    card_hint: Optional[str] = None


@dataclass
class ChatPlan:
    intent: IntentResult
    steps: List[PlanExecutionStep]
    messages: List[str]
    notes: Optional[str] = None


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


TARGET_TYPE_HINTS = {
    "campaign.aggregate_kpis": "CampaignKPIResultOut",
    "campaign.summary": "CampaignKPIResultOut",
    "draft.create": "DraftOut",
}


class FlowPlanner:
    def __init__(self) -> None:
        self._matcher = FlowMatcher()

    async def plan(self, message: str, intent: IntentResult) -> ChatPlan:
        query = " ".join([message, intent.intent, " ".join(intent.keywords)])
        existing = await self._plan_existing_flow(query, intent)
        if existing:
            return existing

        dynamic = self._plan_dynamic_chain(intent)
        if dynamic:
            return dynamic

        suggestions = [
            "I couldn't map this request to an orchestration flow yet.",
        ]
        if intent.candidates:
            candidate_text = ", ".join(
                f"{candidate.intent} ({candidate.confidence:.0%})"
                for candidate in intent.candidates[:3]
            )
            suggestions.append(f"Top intent candidates: {candidate_text}.")
        if intent.keywords:
            suggestions.append(
                "Detected keywords: " + ", ".join(intent.keywords[:5]) + "."
            )
        suggestions.append(
            "Try referencing a campaign id (e.g. #123) or ask me to create a draft explicitly."
        )
        return ChatPlan(intent=intent, steps=[], messages=suggestions, notes=None)

    async def _plan_existing_flow(self, query: str, intent: IntentResult) -> Optional[ChatPlan]:
        matches = await self._matcher.search(query, top_k=5)
        slots = intent.slots
        for match in matches:
            flow = match.flow
            weighted_score = self._weighted_score(match, intent)
            min_score = (
                FlowMatcher.MIN_EMBED_SCORE
                if match.strategy == "embedding"
                else FlowMatcher.MIN_KEYWORD_SCORE
            )
            if weighted_score < min_score:
                continue
            steps = self._build_flow_steps(flow, intent, slots)
            if steps:
                notes = (
                    f"Matched flow '{flow.title}' via {match.strategy} search "
                    f"(score {weighted_score:.2f})."
                )
                return ChatPlan(intent=intent, steps=steps, messages=[], notes=notes)
        return None

    def _plan_dynamic_chain(self, intent: IntentResult) -> Optional[ChatPlan]:
        operators = [REGISTRY[key] for key in REGISTRY]
        slots = intent.slots

        start_candidates: List[Tuple[OperatorMeta, Dict[str, Any]]] = []
        for meta in operators:
            payload = self._build_payload(meta.input_model, intent, slots)
            if payload is not None:
                start_candidates.append((meta, payload))

        if not start_candidates:
            return None

        target_name = TARGET_TYPE_HINTS.get(intent.intent)
        path = self._find_operator_path(start_candidates, operators, target_name)
        if not path:
            return None

        metas, first_payload = path
        dynamic_flow = self._build_dynamic_flow(intent, metas)
        card_hint = card_type_for_model(dynamic_flow.output_model)
        title = f"Dynamic plan: {' → '.join(meta.key for meta in metas)}"

        step = PlanExecutionStep(
            kind="dynamic",
            payload=first_payload,
            flow=dynamic_flow,
            title=title,
            card_hint=card_hint,
        )
        notes = "Orchestrator composed an ad-hoc operator chain automatically."
        return ChatPlan(intent=intent, steps=[step], messages=[], notes=notes)

    def _weighted_score(self, match: FlowMatch, intent: IntentResult) -> float:
        base = match.score
        boost = 1.0
        for candidate in intent.candidates:
            if candidate.confidence < 0.3:
                continue
            intent_tokens = [candidate.intent, candidate.intent.split(".")[-1]]
            if any(token and token in match.flow.key for token in intent_tokens):
                boost = max(boost, 1.0 + candidate.confidence * 0.5)
                continue
            if any(token and any(token in tag for tag in match.flow.tags) for token in intent_tokens):
                boost = max(boost, 1.0 + candidate.confidence * 0.3)
        return base * boost

    def _build_flow_steps(
        self,
        flow: FlowDefinition,
        intent: IntentResult,
        slots: Dict[str, Any],
    ) -> List[PlanExecutionStep]:
        payload = self._build_payload(flow.input_model, intent, slots)
        card_hint = card_type_for_model(flow.output_model)

        if payload is not None:
            return [
                PlanExecutionStep(
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
                payload = self._build_payload(flow.input_model, intent, overrides)
                if payload is None:
                    continue
                title = f"Campaign #{cid}"
                steps.append(
                    PlanExecutionStep(
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

    def _build_payload(
        self,
        model_cls: type[BaseModel],
        intent: IntentResult,
        slots: Dict[str, Any],
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
            if name == "as_of" and "as_of" in slots:
                data[name] = slots["as_of"]
                continue
            if name == "title":
                data[name] = intent.raw_text[:50].strip() or "Untitled"
                continue
            if name == "ir":
                data[name] = self._default_draft_ir(intent.raw_text)
                continue
            # skip optional fields (will be handled by model defaults)

        try:
            model_cls(**data)
        except ValidationError:
            return None
        return data

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

    def _model_fields(self, model_cls: type[BaseModel]) -> Dict[str, Any]:
        if hasattr(model_cls, "model_fields"):
            return model_cls.model_fields  # type: ignore[attr-defined]
        return getattr(model_cls, "__fields__", {})

    def _find_operator_path(
        self,
        starts: List[Tuple[OperatorMeta, Dict[str, Any]]],
        operators: List[OperatorMeta],
        target_name: Optional[str],
    ) -> Optional[Tuple[List[OperatorMeta], Dict[str, Any]]]:
        inputs: Dict[type, List[OperatorMeta]] = {}
        for meta in operators:
            inputs.setdefault(meta.input_model, []).append(meta)

        target_type = None
        if target_name:
            target_type = next(
                (meta.output_model for meta in operators if meta.output_model.__name__ == target_name),
                None,
            )

        queue: deque[Tuple[OperatorMeta, List[OperatorMeta], Dict[str, Any]]] = deque()
        visited: set[str] = set()

        for meta, payload in starts:
            queue.append((meta, [meta], payload))
            visited.add(meta.key)

        max_depth = 4
        while queue:
            meta, path, payload = queue.popleft()
            if target_type is None or meta.output_model is target_type:
                return path, payload

            if len(path) >= max_depth:
                continue

            for candidate in inputs.get(meta.output_model, []):
                if candidate.key in visited:
                    continue
                visited.add(candidate.key)
                queue.append((candidate, path + [candidate], payload))

        return None

    def _build_dynamic_flow(self, intent: IntentResult, metas: Sequence[OperatorMeta]) -> FlowDefinition:
        suffix = hashlib.sha1(intent.raw_text.encode("utf-8")).hexdigest()[:10]
        builder = FlowBuilder(
            key=f"chat.dynamic.{suffix}",
            title="Dynamic chat plan",
            input_model=metas[0].input_model,
            output_model=metas[-1].output_model,
            operator_registry=REGISTRY,
        )
        previous = None
        for idx, meta in enumerate(metas):
            task_id = f"step_{idx}"
            handle = builder.task(
                task_id,
                meta.key,
                upstream=[previous] if previous else None,
            )
            previous = handle
        builder.expect_entry("step_0")
        if previous:
            builder.expect_terminal(previous)
        return builder.compile()

flow_planner = FlowPlanner()


__all__ = ["ChatPlan", "PlanExecutionStep", "FlowPlanner", "flow_planner"]

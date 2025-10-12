"""Chat entrypoint that leverages the NLP engine and planner."""

from __future__ import annotations

from dataclasses import dataclass
import heapq
import inspect
from typing import Any, Callable, Dict, List, Literal, Mapping, Optional, Sequence, Set, Tuple

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, ValidationError
from apps.backend.src.core.logging import setup_logging
setup_logging()

from .cards import card_type_for_model, serialize_payload
from .dag_executor import DagExecutor
from .dispatch import ExecutionRuntime, runtime_dependency
from .dsl import DagNode, DagSpec
from .nlp import IntentCandidate, IntentResult
from .planner import ChatPlan, FlowMatch, flow_planner
from .registry import FLOWS, FlowDefinition


router = APIRouter(prefix="/chat", tags=["chat"])


class ChatQuery(BaseModel):
    message: str = Field(..., description="User utterance (English)")
    session_id: Optional[str] = Field(None, description="Conversation identifier")


class ChatCard(BaseModel):
    card_type: str
    data: Dict[str, Any]
    title: Optional[str] = None
    source_flow: Optional[str] = None


class FlowMatchSummary(BaseModel):
    key: str
    title: str
    score: float
    strategy: Literal["embedding", "keyword"]
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class ChatResponse(BaseModel):
    intent: IntentResult
    match: Optional[FlowMatchSummary] = None
    alternative_matches: List[FlowMatchSummary] = Field(default_factory=list)
    plan_notes: Optional[str] = None
    cards: List[ChatCard] = Field(default_factory=list)
    messages: List[str] = Field(default_factory=list)


class FlowInfo(BaseModel):
    key: str
    title: str
    description: Optional[str] = None
    method: str
    path: str
    tags: List[str]


@dataclass(frozen=True)
class _PlanStepInfo:
    id: str
    label: str
    flow: FlowDefinition
    title: Optional[str]
    card_hint: Optional[str]


@router.post("/query", response_model=ChatResponse)
async def chat_query(
    payload: ChatQuery,
    runtime: ExecutionRuntime = Depends(runtime_dependency),
) -> ChatResponse:
    plan = await flow_planner.plan(payload.message)
    response = await _execute_plan(payload.message, plan, runtime)
    return response


@router.get("/flows", response_model=List[FlowInfo])
async def get_available_flows() -> List[FlowInfo]:
    """Get list of all available flows."""
    flows = FLOWS.all()
    return [
        FlowInfo(
            key=flow.key,
            title=flow.title,
            description=flow.description,
            method=flow.method,
            path=flow.api_path(),
            tags=list(flow.tags),
        )
        for flow in flows
    ]


async def _execute_plan(message: str, plan: ChatPlan, runtime: ExecutionRuntime) -> ChatResponse:
    intent = _intent_from_plan(message, plan)
    response = ChatResponse(intent=intent, plan_notes=plan.notes)
    if plan.primary_match:
        response.match = _summarize_match(plan.primary_match)
    if plan.alternatives:
        response.alternative_matches = [_summarize_match(match) for match in plan.alternatives]
    response.messages.extend(plan.messages)

    spec, step_infos, execution_order = _build_plan_spec(plan, response)

    if spec is not None and execution_order:
        skip_notified: Set[str] = set()

        def handle_error(
            node_id: str,
            exc: Exception,
            stage: Literal["prepare", "execute"],
        ) -> None:
            info = step_infos.get(node_id)
            label = info.label if info else node_id
            if stage == "prepare" and isinstance(exc, ValidationError):
                detail = exc.errors()[0].get("msg", "validation error")
                response.messages.append(
                    f"Unable to build request for step '{label}': {detail}"
                )
                return
            if stage == "prepare":
                response.messages.append(
                    f"Failed to prepare payload for step '{label}': {exc}"
                )
                return
            flow_key = info.flow.key if info else node_id
            response.messages.append(f"Failed to execute {flow_key}: {exc}")

        def handle_skip(node_id: str, missing: Sequence[str]) -> None:
            if node_id in skip_notified:
                return
            skip_notified.add(node_id)
            info = step_infos.get(node_id)
            label = info.label if info else node_id
            response.messages.append(
                f"Skipping step '{label}' because dependencies {list(missing)} are unavailable."
            )

        executor = DagExecutor(
            spec,
            runtime=runtime,
            schedule_payload={},
            schedule_context={},
            continue_on_error=True,
            on_error=handle_error,
            on_skip=handle_skip,
        )
        execution_result = await executor.run()

        completed_nodes = set(executor.completed)
        raw_results = execution_result.raw_results
        serialized_results = execution_result.node_results

        for node_id in execution_order:
            if node_id not in completed_nodes:
                continue
            info = step_infos[node_id]
            payload_value = raw_results.get(node_id)
            if payload_value is None:
                payload_value = serialized_results.get(node_id, {})
            card_payload = serialize_payload(payload_value)
            if isinstance(card_payload, list):
                card_payload = {"items": card_payload}
            card_type = info.card_hint or card_type_for_model(info.flow.output_model)
            response.cards.append(
                ChatCard(
                    card_type=card_type,
                    data=card_payload,
                    title=info.title,
                    source_flow=info.flow.key,
                )
            )

    if not response.cards and not response.messages:
        response.messages.append("No actions were executed for this request.")

    return response


def _build_plan_spec(
    plan: ChatPlan,
    response: ChatResponse,
) -> Tuple[Optional[DagSpec], Dict[str, _PlanStepInfo], List[str]]:
    if not plan.steps:
        return None, {}, []

    plan_order: List[str] = []
    node_entries: Dict[str, DagNode] = {}
    dependency_map: Dict[str, Tuple[str, ...]] = {}
    step_infos: Dict[str, _PlanStepInfo] = {}

    for index, step in enumerate(plan.steps, start=1):
        step_id = step.id or step.flow_key or f"step{index}"
        plan_order.append(step_id)
        step_label = step.title or step.flow_key or step_id

        if step.kind != "flow":
            response.messages.append(
                f"Skipping step '{step_label}' because unsupported kind '{step.kind}'."
            )
            continue

        try:
            flow = step.flow if step.flow is not None else FLOWS.get(step.flow_key)
        except KeyError:
            response.messages.append(f"Flow '{step.flow_key}' is not available anymore.")
            continue

        payload_dict = dict(step.payload)
        payload_builder = _wrap_payload_builder(payload_dict, step.payload_builder)

        node_entries[step_id] = DagNode(
            id=step_id,
            flow=flow,
            inputs=payload_dict,
            payload_builder=payload_builder,
        )
        dependency_map[step_id] = tuple(step.depends_on or ())
        step_infos[step_id] = _PlanStepInfo(
            id=step_id,
            label=step_label,
            flow=flow,
            title=step.title,
            card_hint=step.card_hint,
        )

    if not node_entries:
        return None, {}, []

    included_ids: Set[str] = set(node_entries.keys())
    changed = True
    while changed:
        changed = False
        for node_id in list(included_ids):
            deps = dependency_map.get(node_id, ())
            if any(dep not in included_ids for dep in deps):
                included_ids.remove(node_id)
                changed = True

    removed_ids = set(node_entries.keys()) - included_ids
    for removed_id in removed_ids:
        info = step_infos.get(removed_id)
        label = info.label if info else removed_id
        missing = [
            dep for dep in dependency_map.get(removed_id, ()) if dep not in included_ids
        ]
        if missing:
            response.messages.append(
                f"Skipping step '{label}' because dependencies {missing} are unavailable."
            )
        else:
            response.messages.append(
                f"Skipping step '{label}' because dependencies are unavailable."
            )
        node_entries.pop(removed_id, None)
        dependency_map.pop(removed_id, None)
        step_infos.pop(removed_id, None)

    execution_order = [node_id for node_id in plan_order if node_id in included_ids]
    if not execution_order:
        return None, {}, []

    adjacency: Dict[str, List[str]] = {node_id: [] for node_id in execution_order}
    predecessors: Dict[str, List[str]] = {node_id: [] for node_id in execution_order}
    for node_id in execution_order:
        for dep in dependency_map.get(node_id, ()):
            if dep in included_ids:
                adjacency[dep].append(node_id)
                predecessors[node_id].append(dep)

    entry_nodes = [node_id for node_id, preds in predecessors.items() if not preds]

    try:
        topological_order = _stable_topological_order(
            adjacency, predecessors, execution_order
        )
    except ValueError:
        response.messages.append(
            "Unable to execute plan because it contains cyclic dependencies."
        )
        return None, {}, []

    nodes = {node_id: node_entries[node_id] for node_id in execution_order}
    spec = DagSpec(
        nodes=nodes,
        adjacency=adjacency,
        predecessors=predecessors,
        entry_nodes=entry_nodes,
        topological_order=topological_order,
    )
    return spec, step_infos, execution_order


def _wrap_payload_builder(
    payload: Dict[str, Any],
    builder: Optional[Callable[[Mapping[str, Any]], Any]],
) -> Optional[Callable[[Mapping[str, Any]], Any]]:
    if builder is None:
        return None

    base_payload = dict(payload)

    def wrapper(
        results: Mapping[str, Any],
        *,
        _builder: Callable[[Mapping[str, Any]], Any] = builder,
        _base: Dict[str, Any] = base_payload,
    ) -> Any:
        candidate = _builder(results)
        if inspect.isawaitable(candidate):
            async def _await_candidate() -> Dict[str, Any]:
                resolved = await candidate  # type: ignore[arg-type]
                if resolved is None:
                    return dict(_base)
                return resolved

            return _await_candidate()  # type: ignore[return-value]
        if candidate is None:
            return dict(_base)
        return candidate

    return wrapper


def _stable_topological_order(
    adjacency: Dict[str, List[str]],
    predecessors: Dict[str, List[str]],
    order_hint: List[str],
) -> List[str]:
    if not adjacency:
        return []

    index_hint = {node_id: idx for idx, node_id in enumerate(order_hint)}
    in_degree = {node_id: len(predecessors.get(node_id, [])) for node_id in adjacency}
    heap: List[Tuple[int, str]] = [
        (index_hint.get(node_id, len(index_hint)), node_id)
        for node_id, degree in in_degree.items()
        if degree == 0
    ]
    heapq.heapify(heap)

    ordered: List[str] = []
    while heap:
        _, current = heapq.heappop(heap)
        ordered.append(current)
        for downstream in adjacency.get(current, []):
            in_degree[downstream] -= 1
            if in_degree[downstream] == 0:
                heapq.heappush(
                    heap,
                    (index_hint.get(downstream, len(index_hint)), downstream),
                )

    if len(ordered) != len(adjacency):
        raise ValueError("cycle detected")
    return ordered


def _intent_from_plan(message: str, plan: ChatPlan) -> IntentResult:
    intent_key = plan.primary_match.flow.key if plan.primary_match else "unknown"
    confidence = plan.primary_match.score if plan.primary_match else 0.0
    candidates = [
        IntentCandidate(intent=match.flow.key, confidence=match.score)
        for match in plan.alternatives[:3]
    ]
    return IntentResult(
        intent=intent_key,
        confidence=confidence,
        candidates=candidates,
        slots=plan.slots,
        raw_text=message,
        keywords=[],
    )


def _summarize_match(match: FlowMatch) -> FlowMatchSummary:
    flow = match.flow
    return FlowMatchSummary(
        key=flow.key,
        title=flow.title,
        description=flow.description,
        tags=list(flow.tags),
        score=match.score,
        strategy=match.strategy,
    )


__all__ = ["router"]

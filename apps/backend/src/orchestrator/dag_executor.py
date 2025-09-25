"""Dynamic DAG executor for schedule-provided specifications."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, Iterable, Literal, Mapping, Optional, Sequence

from pydantic import BaseModel

from apps.backend.src.orchestrator.dsl import DagSpec, DagNode
from apps.backend.src.orchestrator.dispatch import ExecutionRuntime, orchestrate_flow
from apps.backend.src.workers.CoWorker.runtime import ScheduleReschedule


@dataclass
class ExecutionResult:
    node_results: Dict[str, Dict[str, Any]]
    context: Dict[str, Any]
    raw_results: Dict[str, Any] = field(default_factory=dict)


class DagExecutor:
    """Executes a :class:`DagSpec` against dynamic schedule state."""

    def __init__(
        self,
        spec: DagSpec,
        *,
        runtime: ExecutionRuntime,
        schedule_payload: Dict[str, Any],
        schedule_context: Dict[str, Any],
        resume_payload: Optional[Dict[str, Any]] = None,
        result_transform: Optional[Callable[[Any], Dict[str, Any]]] = None,
        continue_on_error: bool = False,
        on_error: Optional[
            Callable[[str, Exception, Literal["prepare", "execute"]], None]
        ] = None,
        on_skip: Optional[Callable[[str, Sequence[str]], None]] = None,
    ) -> None:
        self.spec = spec
        self.runtime = runtime
        self.payload = schedule_payload or {}
        self.context = schedule_context
        self.resume_payload = resume_payload or {}
        self._result_transform = result_transform or _normalize_result
        self.continue_on_error = continue_on_error
        self.on_error = on_error
        self.on_skip = on_skip

        self.dag_state = self.context.setdefault("_dag", {})
        stored_results = self.dag_state.get("results", {})
        if not isinstance(stored_results, dict):
            stored_results = {}
        self.node_results: Dict[str, Dict[str, Any]] = {
            node_id: _ensure_dict(stored_results.get(node_id)) for node_id in self.spec.nodes
        }
        self.raw_results: Dict[str, Any] = {
            node_id: stored_results[node_id]
            for node_id in self.spec.nodes
            if node_id in stored_results
        }
        completed = self.dag_state.get("completed", [])
        if isinstance(completed, list):
            self.completed = set(str(item) for item in completed)
        else:
            self.completed = set()

    async def run(self) -> ExecutionResult:
        """Execute nodes sequentially until completion or suspension."""

        resume_next = self.dag_state.pop("resume_next", None)
        resume_next_id = None
        if isinstance(resume_next, (list, tuple)) and resume_next:
            resume_next_id = str(resume_next[0])
        elif isinstance(resume_next, str):
            resume_next_id = resume_next

        order = self.spec.topological_order
        start_index = 0
        if resume_next_id:
            try:
                start_index = order.index(resume_next_id)
            except ValueError:
                start_index = 0

        for idx in range(start_index, len(order)):
            node_id = order[idx]
            if node_id in self.completed:
                continue

            missing = [
                dep for dep in self.spec.predecessors.get(node_id, []) if dep not in self.completed
            ]
            if missing:
                if self.on_skip:
                    self.on_skip(node_id, missing)
                continue

            node = self.spec.nodes[node_id]
            try:
                payload_model = self._build_inputs(node)
            except Exception as exc:
                if self.on_error:
                    self.on_error(node_id, exc, "prepare")
                if self.continue_on_error:
                    continue
                raise

            try:
                outcome = await orchestrate_flow(node.flow, payload_model, self.runtime)
            except ScheduleReschedule as suspend:
                self._handle_reschedule(node_id, suspend)
                raise
            except Exception as exc:
                if self.on_error:
                    self.on_error(node_id, exc, "execute")
                if self.continue_on_error:
                    continue
                raise

            self.raw_results[node_id] = outcome
            result_dict = self._result_transform(outcome)
            self.node_results[node_id] = result_dict
            self.completed.add(node_id)
            self._update_dag_state()

        # completed all reachable nodes
        self.dag_state.pop("resume_next", None)
        self.context.pop("_resume", None)
        self._update_dag_state()
        return ExecutionResult(
            node_results=self.node_results,
            context=self.context,
            raw_results=self.raw_results,
        )

    def _handle_reschedule(self, node_id: str, suspend: ScheduleReschedule) -> None:
        downstream = self.spec.adjacency.get(node_id, [])
        next_node = downstream[0] if downstream else None
        if next_node:
            self.dag_state["resume_next"] = [next_node]
        self.dag_state["waiting_node"] = node_id
        self.dag_state["wait_started_at"] = datetime.utcnow().isoformat()
        self._update_dag_state()
        # ensure updated context makes it into directive if not provided
        if suspend.directive.context is None:
            suspend.directive.context = self.context

    def _build_inputs(self, node: DagNode) -> BaseModel:
        if node.payload_builder is not None:
            raw_inputs = node.payload_builder(self.raw_results)
        else:
            raw_inputs = {
                key: self._materialize(value) for key, value in node.inputs.items()
            }

        if isinstance(raw_inputs, BaseModel):
            if hasattr(raw_inputs, "model_dump"):
                raw_inputs = raw_inputs.model_dump()  # type: ignore[attr-defined]
            else:
                raw_inputs = raw_inputs.dict()  # type: ignore[attr-defined]
        elif isinstance(raw_inputs, Mapping):
            raw_inputs = dict(raw_inputs)
        else:
            raise TypeError(
                "payload builder must return a mapping or BaseModel-compatible object"
            )

        model_cls = node.flow.input_model
        if hasattr(model_cls, "model_validate"):
            return model_cls.model_validate(raw_inputs)
        return model_cls.parse_obj(raw_inputs)  # type: ignore[attr-defined]

    def _materialize(self, value: Any) -> Any:
        if isinstance(value, str) and value.startswith("$."):
            return self._resolve_path(value[2:])
        if isinstance(value, dict):
            return {k: self._materialize(v) for k, v in value.items()}
        if isinstance(value, list):
            return [self._materialize(item) for item in value]
        return value

    def _resolve_path(self, path: str) -> Any:
        segments = path.split(".") if path else []
        if not segments:
            return None
        root = segments.pop(0)
        if root == "payload":
            current: Any = self.payload
        elif root == "context":
            current = self.context
        elif root == "resume":
            current = self.context.get("_resume", {}) or self.resume_payload
        elif root == "nodes":
            current = self.node_results
        elif root == "nodes_raw":
            current = self.raw_results
        else:
            return None
        for segment in segments:
            if isinstance(current, dict):
                current = current.get(segment)
            elif isinstance(current, list):
                try:
                    idx = int(segment)
                    current = current[idx]
                except (ValueError, IndexError):
                    return None
            elif hasattr(current, segment):
                current = getattr(current, segment)
            else:
                return None
        return current

    def _update_dag_state(self) -> None:
        self.dag_state["completed"] = sorted(self.completed)
        self.dag_state["results"] = self.node_results


def _model_to_dict(model: BaseModel) -> Dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _normalize_result(value: Any) -> Dict[str, Any]:
    if isinstance(value, BaseModel):
        return _model_to_dict(value)
    if isinstance(value, dict):
        return value
    return {"value": value}


def _ensure_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, BaseModel):
        return _model_to_dict(value)
    return {}


__all__ = ["DagExecutor", "ExecutionResult"]

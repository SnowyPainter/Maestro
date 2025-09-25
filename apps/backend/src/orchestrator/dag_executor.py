"""Dynamic DAG executor for schedule-provided specifications."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Iterable, Optional

from pydantic import BaseModel

from apps.backend.src.orchestrator.dsl import DagSpec, DagNode
from apps.backend.src.orchestrator.dispatch import ExecutionRuntime, orchestrate_flow
from apps.backend.src.workers.CoWorker.runtime import ScheduleReschedule


@dataclass
class ExecutionResult:
    node_results: Dict[str, Dict[str, Any]]
    context: Dict[str, Any]


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
    ) -> None:
        self.spec = spec
        self.runtime = runtime
        self.payload = schedule_payload or {}
        self.context = schedule_context
        self.resume_payload = resume_payload or {}

        self.dag_state = self.context.setdefault("_dag", {})
        stored_results = self.dag_state.get("results", {})
        if not isinstance(stored_results, dict):
            stored_results = {}
        self.node_results: Dict[str, Dict[str, Any]] = {
            node_id: _ensure_dict(stored_results.get(node_id)) for node_id in self.spec.nodes
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
            if not self._dependencies_completed(node_id):
                continue

            node = self.spec.nodes[node_id]
            payload_model = self._build_inputs(node)
            try:
                outcome = await orchestrate_flow(node.flow, payload_model, self.runtime)
                if isinstance(outcome, BaseModel):
                    result_dict = _model_to_dict(outcome)
                elif isinstance(outcome, dict):
                    result_dict = outcome
                else:
                    result_dict = {"value": outcome}
                self.node_results[node_id] = result_dict
                self.completed.add(node_id)
                self._update_dag_state()
            except ScheduleReschedule as suspend:
                self._handle_reschedule(node_id, suspend)
                raise

        # completed all reachable nodes
        self.dag_state.pop("resume_next", None)
        self.context.pop("_resume", None)
        self._update_dag_state()
        return ExecutionResult(node_results=self.node_results, context=self.context)

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

    def _dependencies_completed(self, node_id: str) -> bool:
        for upstream in self.spec.predecessors.get(node_id, []):
            if upstream not in self.completed:
                return False
        return True

    def _build_inputs(self, node: DagNode) -> BaseModel:
        raw_inputs = {
            key: self._materialize(value) for key, value in node.inputs.items()
        }
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


def _ensure_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, BaseModel):
        return _model_to_dict(value)
    return {}


__all__ = ["DagExecutor", "ExecutionResult"]

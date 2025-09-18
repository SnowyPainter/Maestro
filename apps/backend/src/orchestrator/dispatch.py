"""Flow execution runtime for the orchestrator DSL."""

from __future__ import annotations

from dataclasses import dataclass, field
from inspect import Parameter, Signature, signature
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    Iterable,
    Optional,
    Tuple,
    Type,
    get_type_hints,
)

from fastapi import Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.core.context import get_persona_account_id
from apps.backend.src.core.deps import get_current_user, get_db
from apps.backend.src.modules.users.models import User

from .persona_context import inject_persona_context
from .registry import FlowDefinition, FlowTask, OperatorMeta, REGISTRY, _extract_model_type


class ExecutionRuntime:
    """Holds per-request resources that operators may depend on."""

    def __init__(self) -> None:
        self._by_name: Dict[str, Any] = {}
        self._by_type: Dict[type, Any] = {}

    def clone(self) -> "ExecutionRuntime":
        duplicated = ExecutionRuntime()
        duplicated._by_name.update(self._by_name)
        duplicated._by_type.update(self._by_type)
        return duplicated

    def provide(self, value: Any, *, name: Optional[str] = None, type_hint: Optional[type] = None) -> None:
        if value is None:
            return
        if name:
            self._by_name[name] = value
        hint = type_hint or type(value)
        for cls in _iter_type_mro(hint):
            self._by_type[cls] = value

    def optional(self, annotation: Any, *, name: Optional[str] = None) -> Any:
        try:
            return self.require(annotation, name=name)
        except LookupError:
            return None

    def require(self, annotation: Any, *, name: Optional[str] = None) -> Any:
        if name and name in self._by_name:
            return self._by_name[name]
        candidate = self._resolve_by_annotation(annotation)
        if candidate is not None:
            return candidate
        if name and name in self._by_name:
            return self._by_name[name]
        raise LookupError(f"Dependency '{annotation}' not available")

    def _resolve_by_annotation(self, annotation: Any) -> Any:
        if isinstance(annotation, type):
            if annotation in self._by_type:
                return self._by_type[annotation]
            for cls, value in self._by_type.items():
                if isinstance(value, annotation):
                    return value
        return None

@dataclass
class TaskContext:
    flow: FlowDefinition
    task: FlowTask
    payload: BaseModel
    runtime: ExecutionRuntime
    results: Dict[str, Any]

    def result(self, task_id: str) -> Any:
        return self.results[task_id]

    def optional(self, annotation: Any, *, name: Optional[str] = None) -> Any:
        return self.runtime.optional(annotation, name=name)

    def require(self, annotation: Any, *, name: Optional[str] = None) -> Any:
        return self.runtime.require(annotation, name=name)


@dataclass
class FlowState:
    flow: FlowDefinition
    payload: BaseModel
    runtime: ExecutionRuntime
    results: Dict[str, Any] = field(default_factory=dict)


async def orchestrate_flow(
    flow: FlowDefinition,
    payload: BaseModel,
    runtime: Optional[ExecutionRuntime],
) -> BaseModel:
    payload = inject_persona_context(payload)
    state = FlowState(flow=flow, payload=payload, runtime=runtime or ExecutionRuntime())
    for task_id in flow.topological_order():
        task = flow.tasks[task_id]
        await _execute_task(task, state)
    return _finalize_state(state)


async def _execute_task(task: FlowTask, state: FlowState) -> None:
    meta = REGISTRY.ensure(task.operator_key)
    operator_payload = _build_operator_payload(task, state, meta)
    context = TaskContext(
        flow=state.flow,
        task=task,
        payload=state.payload,
        runtime=state.runtime,
        results=state.results,
    )
    result = await _invoke_operator(meta, operator_payload, context)
    state.results[task.id] = _coerce_output(meta.output_model, result)


def _build_operator_payload(task: FlowTask, state: FlowState, meta: OperatorMeta) -> BaseModel:
    direct_factory = task.config.get("payload_factory")
    source_spec = task.config.get("payload_from", "payload")
    source = _resolve_source(source_spec, state)
    attr_path = task.config.get("payload_attr")
    if attr_path:
        source = _pluck_attribute(source, attr_path)
    if callable(direct_factory):
        candidate = direct_factory(state, source)
    else:
        candidate = source
    return _coerce_input(meta.input_model, candidate)


def _resolve_source(spec: Any, state: FlowState) -> Any:
    if callable(spec):
        return spec(state)
    if spec in ("payload", "$payload", None):
        return state.payload
    if isinstance(spec, str):
        if spec.startswith("task:"):
            task_id = spec.split(":", 1)[1]
            return state.results[task_id]
        if spec in state.results:
            return state.results[spec]
        raise KeyError(f"Unknown payload reference '{spec}' in flow '{state.flow.key}'")
    return spec


def _pluck_attribute(value: Any, path: str) -> Any:
    parts = [p for p in path.split(".") if p]
    current = value
    for part in parts:
        if isinstance(current, BaseModel):
            current = getattr(current, part)
            continue
        if isinstance(current, dict):
            current = current[part]
            continue
        current = getattr(current, part)
    return current


async def _invoke_operator(meta: OperatorMeta, payload: BaseModel, context: TaskContext) -> Any:
    handler = meta.handler
    sig = signature(handler)
    type_hints = get_type_hints(handler, include_extras=True)
    bound_args = _bind_operator_arguments(sig, type_hints, meta, payload, context)
    outcome = handler(**bound_args)
    if isinstance(outcome, Awaitable):
        return await outcome
    return outcome


def _bind_operator_arguments(
    sig: Signature,
    type_hints: Dict[str, Any],
    meta: OperatorMeta,
    payload: BaseModel,
    context: TaskContext,
) -> Dict[str, Any]:
    bound: Dict[str, Any] = {}
    payload_bound = False
    for name, param in sig.parameters.items():
        annotation = type_hints.get(name, param.annotation)
        if annotation is Parameter.empty:
            raise TypeError(
                f"Operator '{meta.key}' parameter '{name}' must include a type annotation"
            )
        annotation_model = _extract_model_type(annotation)
        if annotation_model is not None and issubclass(meta.input_model, annotation_model):
            if payload_bound:
                raise TypeError(
                    f"Operator '{meta.key}' has multiple BaseModel parameters; only one is allowed"
                )
            bound[name] = (
                payload
                if isinstance(payload, meta.input_model)
                else _coerce_input(meta.input_model, payload)
            )
            payload_bound = True
            continue
        if annotation is TaskContext:
            bound[name] = context
            continue
        try:
            bound[name] = context.require(annotation, name=name)
        except LookupError as exc:
            if param.default is not Parameter.empty:
                bound[name] = param.default
                continue
            raise RuntimeError(
                f"Operator '{meta.key}' missing dependency for parameter '{name}' ({annotation})"
            ) from exc
    if not payload_bound:
        raise TypeError(
            f"Operator '{meta.key}' must declare a Pydantic BaseModel parameter to receive the payload"
        )
    return bound


def _coerce_input(model_cls: Type[BaseModel], value: Any) -> BaseModel:
    if isinstance(value, model_cls):
        return value
    if isinstance(value, BaseModel):
        data = value.model_dump() if hasattr(value, "model_dump") else value.dict()
    elif isinstance(value, dict):
        data = value
    else:
        data = value
    if hasattr(model_cls, "model_validate"):
        return model_cls.model_validate(data)
    return model_cls.parse_obj(data)


def _coerce_output(model_cls: Type[BaseModel], value: Any) -> BaseModel:
    if isinstance(value, model_cls):
        return value
    if isinstance(value, BaseModel):
        data = value.model_dump() if hasattr(value, "model_dump") else value.dict()
    elif isinstance(value, dict):
        data = value
    else:
        data = value
    if hasattr(model_cls, "model_validate"):
        return model_cls.model_validate(data)
    return model_cls.parse_obj(data)


def _finalize_state(state: FlowState) -> BaseModel:
    terminals = state.flow.terminal_tasks
    if len(terminals) == 1:
        return _coerce_output(state.flow.output_model, state.results[terminals[0]])
    aggregated = {task_id: state.results[task_id] for task_id in terminals}
    return _coerce_output(state.flow.output_model, aggregated)


def _iter_type_mro(hint: type) -> Iterable[type]:
    for cls in hint.mro():
        if cls is object:
            continue
        yield cls


async def runtime_dependency(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ExecutionRuntime:
    runtime = ExecutionRuntime()
    runtime.provide(db, name="db", type_hint=AsyncSession)
    runtime.provide(user, name="user", type_hint=User)
    # 필수적으로 해당 persona_account_id가 user꺼가 맞는지 확인해야함.
    runtime.provide(get_persona_account_id(), name="persona_account_id", type_hint=str)

    return runtime


__all__ = [
    "ExecutionRuntime",
    "TaskContext",
    "orchestrate_flow",
    "runtime_dependency",
]

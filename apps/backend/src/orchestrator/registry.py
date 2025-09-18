"""Operator and flow registries for the Maestro orchestrator DSL.

The orchestrator is expected to become the single entry point for mutating
operations.  This module provides the primitives required to:

* Declare low level operators (`@operator`) that encapsulate domain work.
* Compose those operators with a DAG-first DSL (`FlowBuilder`).
* Auto-register the resulting DAGs (`FlowRegistry`) so that FastAPI routers and
  OpenAPI specifications can be generated without additional boilerplate.

Usage sketch::

    @operator(key="campaign.aggregate_kpis", title="Aggregate campaign KPIs")
    async def aggregate(payload: AggregatePayload) -> AggregateResult:
        ...

    @FLOWS.flow(
        key="campaigns.aggregate",
        title="Aggregate Campaign KPIs",
        input_model=AggregatePayload,
        output_model=AggregateResult,
    )
    def _build_campaign_aggregate(builder: FlowBuilder):
        start = builder.task("aggregate", "campaign.aggregate_kpis")
        builder.expect_terminal(start)

The router returned by ``FLOWS.build_router`` can then be plugged into the
FastAPI app.  Doing so keeps the OpenAPI schema in sync with the orchestrated
flows automatically.
"""

from __future__ import annotations

import re
import importlib
import logging
import pkgutil
from collections import deque
from dataclasses import dataclass, field
from inspect import Parameter, Signature, isawaitable, iscoroutinefunction, signature
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    Iterable,
    Iterator,
    Literal,
    MutableMapping,
    Optional,
    Sequence,
    Tuple,
    Type,
    TypeVar,
    Union,
    get_args,
    get_origin,
    get_type_hints,
)

from pydantic import BaseModel

from .persona_context import inject_persona_context

logger = logging.getLogger(__name__)

try:  # FastAPI is an optional dependency during unit tests.
    from fastapi import APIRouter, Depends
except ImportError:  # pragma: no cover - FastAPI might not be installed yet.
    APIRouter = None  # type: ignore
    Depends = None  # type: ignore


PayloadModelT = TypeVar("PayloadModelT", bound=BaseModel)
ResultModelT = TypeVar("ResultModelT", bound=BaseModel)
OperatorCallable = Callable[..., Union[Awaitable[BaseModel], BaseModel]]
TaskRef = Union[str, "TaskHandle"]


class OperatorMeta(BaseModel):
    key: str  # e.g. "campaign.aggregate_kpis"
    title: str
    side_effect: Literal["read", "write"]
    queue: Literal["default", "sniffer", "synchro", "coworker", "generator"] = "default"
    input_model: Type[BaseModel]
    output_model: Type[BaseModel]
    handler: OperatorCallable
    description: Optional[str] = None
    is_async: bool = False

    class Config:
        arbitrary_types_allowed = True


class OperatorRegistry(MutableMapping[str, OperatorMeta]):
    """Reusable registry that tracks declared operators."""

    def __init__(self) -> None:
        self._operators: Dict[str, OperatorMeta] = {}

    def __getitem__(self, key: str) -> OperatorMeta:
        return self._operators[key]

    def __setitem__(self, key: str, value: OperatorMeta) -> None:
        self.register(value)

    def __delitem__(self, key: str) -> None:
        del self._operators[key]

    def __iter__(self) -> Iterator[str]:
        return iter(self._operators)

    def __len__(self) -> int:
        return len(self._operators)

    def register(self, meta: OperatorMeta) -> OperatorMeta:
        if meta.key in self._operators:
            raise ValueError(f"Operator '{meta.key}' already registered")
        self._operators[meta.key] = meta
        return meta

    def ensure(self, key: str) -> OperatorMeta:
        if key not in self._operators:
            raise KeyError(f"Operator '{key}' not registered")
        return self._operators[key]


REGISTRY = OperatorRegistry()


def _resolve_model(annotation: Any, *, kind: str, operator_key: str) -> Type[BaseModel]:
    model_type = _extract_model_type(annotation)
    if model_type is None:
        raise TypeError(
            f"Operator '{operator_key}' requires a Pydantic BaseModel annotation for {kind}."
        )
    return model_type


def _extract_model_type(annotation: Any) -> Optional[Type[BaseModel]]:
    if annotation is None:
        return None
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        return annotation
    origin = get_origin(annotation)
    if origin is None:
        return None
    for arg in get_args(annotation):
        model_type = _extract_model_type(arg)
        if model_type is not None:
            return model_type
    return None


def operator(
    key: str,
    title: str,
    side_effect: Literal["read", "write"] = "read",
    queue: Literal["default", "sniffer", "synchro", "coworker", "generator"] = "default",
):
    """Decorator used to register orchestrator operators."""

    def wrap(func: OperatorCallable):
        sig = signature(func)
        type_hints = get_type_hints(func, include_extras=True)
        payload_annotation = next(
            (
                type_hints.get(param.name, param.annotation)
                for param in sig.parameters.values()
                if param.kind in (param.POSITIONAL_OR_KEYWORD, param.KEYWORD_ONLY)
                and _extract_model_type(type_hints.get(param.name, param.annotation))
            ),
            None,
        )
        input_model = _resolve_model(
            payload_annotation,
            kind="payload",
            operator_key=key,
        )
        output_model = _resolve_model(
            type_hints.get("return", sig.return_annotation)
            if sig.return_annotation is not sig.empty
            else type_hints.get("return"),
            kind="return type",
            operator_key=key,
        )
        meta = OperatorMeta(
            key=key,
            title=title,
            side_effect=side_effect,
            queue=queue,
            input_model=input_model,
            output_model=output_model,
            handler=func,
            description=(func.__doc__ or None),
            is_async=iscoroutinefunction(func),
        )
        REGISTRY.register(meta)
        setattr(func, "__operator_meta__", meta)
        return func

    return wrap


@dataclass
class FlowTask:
    """Single node within a flow DAG."""

    id: str
    operator_key: str
    config: Dict[str, Any] = field(default_factory=dict)
    upstream: set[str] = field(default_factory=set)
    downstream: set[str] = field(default_factory=set)
    description: Optional[str] = None


@dataclass
class TaskHandle:
    """Light-weight reference returned by the DSL when adding tasks."""

    builder: "FlowBuilder"
    task_id: str

    def then(
        self,
        task_id: str,
        operator_key: str,
        *,
        config: Optional[Dict[str, Any]] = None,
        description: Optional[str] = None,
    ) -> "TaskHandle":
        return self.builder.task(
            task_id,
            operator_key,
            upstream=[self],
            config=config,
            description=description,
        )


@dataclass
class FlowDefinition:
    key: str
    title: str
    input_model: Type[BaseModel]
    output_model: Type[BaseModel]
    tasks: Dict[str, FlowTask]
    entry_task: str
    terminal_tasks: Tuple[str, ...]
    method: Literal["get", "post", "put", "patch", "delete"] = "post"
    path: Optional[str] = None
    description: Optional[str] = None
    tags: Tuple[str, ...] = ()

    def topological_order(self) -> Tuple[str, ...]:
        incoming = {task_id: len(task.upstream) for task_id, task in self.tasks.items()}
        queue = deque([n for n, count in incoming.items() if count == 0])
        ordered: list[str] = []
        while queue:
            current = queue.popleft()
            ordered.append(current)
            for downstream in self.tasks[current].downstream:
                incoming[downstream] -= 1
                if incoming[downstream] == 0:
                    queue.append(downstream)
        if len(ordered) != len(self.tasks):
            raise ValueError(f"Flow '{self.key}' contains a cycle")
        return tuple(ordered)

    def api_path(self) -> str:
        return self.path or f"/{self.key.replace('.', '/')}"

    def build_endpoint(
        self,
        orchestrate: Callable[["FlowDefinition", BaseModel, Any], Union[Awaitable[BaseModel], BaseModel]],
        *,
        runtime_dependency: Optional[Callable[..., Any]] = None,
    ) -> Callable[..., Awaitable[BaseModel]]:
        if runtime_dependency is not None and Depends is None:  # pragma: no cover
            raise RuntimeError("FastAPI is required to bind runtime dependencies")

        path_params = self.path_parameters()
        body_required = self.method not in {"get", "delete"}

        async def endpoint(**kwargs):
            runtime = kwargs.pop("runtime", None)
            path_values = {name: kwargs.pop(name) for name in path_params if name in kwargs}

            if body_required:
                # For POST/PUT/PATCH, use payload from request body
                payload_obj = kwargs.pop("payload", None)
                if payload_obj is None:
                    payload_obj = self.input_model()
            else:
                # For GET/DELETE, construct payload from query/path parameters
                payload_data = {**kwargs, **path_values}
                payload_obj = self.input_model(**payload_data)

            payload_obj = inject_persona_context(payload_obj)
            enriched_payload = _merge_payload_with_path(payload_obj, path_values)
            result = orchestrate(self, enriched_payload, runtime)
            if isawaitable(result):
                result = await result  # type: ignore[assignment]
            if isinstance(result, self.output_model):
                return result
            if isinstance(result, BaseModel):
                return self.output_model.parse_obj(result.dict())
            return self.output_model.parse_obj(result)

        # Build parameters in correct order: no-default params first, then default params
        params: list[Parameter] = []

        # Add path parameters first (never have defaults)
        for name in path_params:
            params.append(
                Parameter(
                    name,
                    kind=Parameter.POSITIONAL_OR_KEYWORD,
                    annotation=_field_annotation(self.input_model, name),
                )
            )

        if body_required:
            # For POST/PUT/PATCH, add payload as request body
            params.append(
                Parameter(
                    "payload",
                    kind=Parameter.POSITIONAL_OR_KEYWORD,
                    annotation=self.input_model,
                    default=Parameter.empty,
                )
            )
        else:
            # For GET/DELETE, add payload fields as query parameters
            model_fields = getattr(self.input_model, "model_fields", None) or getattr(self.input_model, "__fields__", {})
            for field_name, field_info in model_fields.items():
                if field_name not in path_params:  # Skip path parameters
                    # Handle both Pydantic v1 and v2
                    if hasattr(field_info, "annotation"):
                        annotation = field_info.annotation
                    else:
                        annotation = getattr(field_info, "type_", Any)

                    if hasattr(field_info, "default"):
                        default = field_info.default
                    else:
                        default = getattr(field_info, "default", Parameter.empty)

                    params.append(
                        Parameter(
                            field_name,
                            kind=Parameter.POSITIONAL_OR_KEYWORD,
                            annotation=annotation,
                            default=default,
                        )
                    )

        # Add runtime parameter last (always has default if present)
        if runtime_dependency is not None:
            runtime_annotation = getattr(runtime_dependency, "__annotations__", {}).get("return", Any)
            params.append(
                Parameter(
                    "runtime",
                    kind=Parameter.POSITIONAL_OR_KEYWORD,
                    annotation=runtime_annotation,
                    default=Depends(runtime_dependency),
                )
            )
        end_signature = Signature(parameters=params, return_annotation=self.output_model)
        endpoint.__signature__ = end_signature
        endpoint.__annotations__ = {
            param.name: param.annotation
            for param in params
            if param.annotation is not Parameter.empty
        }
        endpoint.__annotations__["return"] = self.output_model
        endpoint.__name__ = f"flow__{self.key.replace('.', '_')}"
        return endpoint

    def path_parameters(self) -> Tuple[str, ...]:
        pattern = re.compile(r"{([^{}:]+)}")
        return tuple(match.group(1) for match in pattern.finditer(self.api_path()))

    def openapi_operation(self) -> Dict[str, Any]:
        return {
            "path": self.api_path(),
            "method": self.method.upper(),
            "summary": self.title,
            "description": self.description,
            "request_model": self.input_model,
            "response_model": self.output_model,
            "tags": list(self.tags),
        }


class FlowBuilder:
    """DSL helper that incrementally assembles a DAG."""

    def __init__(
        self,
        *,
        key: str,
        title: str,
        input_model: Type[BaseModel],
        output_model: Type[BaseModel],
        operator_registry: OperatorRegistry,
        method: Literal["get", "post", "put", "patch", "delete"] = "post",
        path: Optional[str] = None,
        description: Optional[str] = None,
        tags: Optional[Sequence[str]] = None,
    ) -> None:
        self.key = key
        self.title = title
        self.input_model = input_model
        self.output_model = output_model
        self.operator_registry = operator_registry
        self.method = method.lower()
        self.path = path
        self.description = description
        self.tags = tuple(tags or ())
        self._tasks: Dict[str, FlowTask] = {}
        self._entry: Optional[str] = None
        self._terminal: set[str] = set()

    def _resolve_task_id(self, reference: TaskRef) -> str:
        if isinstance(reference, TaskHandle):
            reference = reference.task_id
        if reference not in self._tasks:
            raise KeyError(f"Unknown task '{reference}' in flow '{self.key}'")
        return reference

    def task(
        self,
        task_id: str,
        operator_key: str,
        *,
        upstream: Optional[Iterable[TaskRef]] = None,
        config: Optional[Dict[str, Any]] = None,
        description: Optional[str] = None,
    ) -> TaskHandle:
        if task_id in self._tasks:
            raise ValueError(f"Task '{task_id}' already exists in flow '{self.key}'")
        meta = self.operator_registry.ensure(operator_key)
        task = FlowTask(
            id=task_id,
            operator_key=meta.key,
            config=(config or {}),
            description=description,
        )
        upstream_refs = {self._resolve_task_id(ref) for ref in (upstream or [])}
        for upstream_id in upstream_refs:
            upstream_task = self._tasks[upstream_id]
            upstream_task.downstream.add(task_id)
            task.upstream.add(upstream_id)
            if upstream_id in self._terminal:
                self._terminal.remove(upstream_id)
        if not upstream_refs and self._entry is None:
            self._entry = task_id
        self._terminal.add(task_id)
        self._tasks[task_id] = task
        return TaskHandle(builder=self, task_id=task_id)

    def expect_entry(self, reference: TaskRef) -> None:
        self._entry = self._resolve_task_id(reference)

    def expect_terminal(self, *references: TaskRef) -> None:
        if not references:
            raise ValueError("expect_terminal requires at least one task reference")
        self._terminal = {self._resolve_task_id(ref) for ref in references}

    def compile(
        self,
        *,
        entry: Optional[TaskRef] = None,
        terminal: Optional[Sequence[TaskRef]] = None,
    ) -> FlowDefinition:
        if not self._tasks:
            raise ValueError(f"Flow '{self.key}' requires at least one task")
        entry_id = self._resolve_task_id(entry) if entry is not None else self._entry
        if entry_id is None:
            candidates = [task_id for task_id, task in self._tasks.items() if not task.upstream]
            if len(candidates) != 1:
                raise ValueError(
                    f"Flow '{self.key}' has ambiguous entry tasks: {candidates}."
                    " Call 'expect_entry' explicitly."
                )
            entry_id = candidates[0]
        terminal_ids: set[str]
        if terminal is not None:
            terminal_ids = {self._resolve_task_id(ref) for ref in terminal}
        elif self._terminal:
            terminal_ids = set(self._terminal)
        else:
            terminal_ids = {task_id for task_id, t in self._tasks.items() if not t.downstream}
        if not terminal_ids:
            raise ValueError(f"Flow '{self.key}' has no terminal tasks")
        # copy the tasks to detach from builder state
        copied_tasks = {
            task_id: FlowTask(
                id=task.id,
                operator_key=task.operator_key,
                config=dict(task.config),
                upstream=set(task.upstream),
                downstream=set(task.downstream),
                description=task.description,
            )
            for task_id, task in self._tasks.items()
        }
        definition = FlowDefinition(
            key=self.key,
            title=self.title,
            input_model=self.input_model,
            output_model=self.output_model,
            tasks=copied_tasks,
            entry_task=entry_id,
            terminal_tasks=tuple(sorted(terminal_ids)),
            method=self.method,
            path=self.path,
            description=self.description,
            tags=self.tags,
        )
        definition.topological_order()  # raises when invalid
        return definition


class FlowRegistry:
    """Central registry that holds all orchestrated flows."""

    def __init__(
        self,
        operator_registry: OperatorRegistry,
        *,
        autodiscover_package: Optional[str] = None,
    ) -> None:
        self.operator_registry = operator_registry
        self._flows: Dict[str, FlowDefinition] = {}
        self._autodiscover_package = autodiscover_package
        self._autodiscover_done = False
        self._autodiscover_in_progress = False

    def register(self, flow: FlowDefinition) -> FlowDefinition:
        if flow.key in self._flows:
            raise ValueError(f"Flow '{flow.key}' already registered")
        self._flows[flow.key] = flow
        return flow

    def get(self, key: str) -> FlowDefinition:
        self._ensure_discovery()
        return self._flows[key]

    def all(self) -> Tuple[FlowDefinition, ...]:
        self._ensure_discovery()
        return tuple(self._flows.values())

    def flow(
        self,
        *,
        key: str,
        title: str,
        input_model: Type[BaseModel],
        output_model: Type[BaseModel],
        method: Literal["get", "post", "put", "patch", "delete"] = "post",
        path: Optional[str] = None,
        description: Optional[str] = None,
        tags: Optional[Sequence[str]] = None,
    ) -> Callable[[Callable[[FlowBuilder], Any]], Callable[[FlowBuilder], Any]]:
        def decorator(builder_fn: Callable[[FlowBuilder], Any]):
            builder = FlowBuilder(
                key=key,
                title=title,
                input_model=input_model,
                output_model=output_model,
                operator_registry=self.operator_registry,
                method=method,
                path=path,
                description=description,
                tags=tags,
            )
            result = builder_fn(builder)
            if isinstance(result, FlowDefinition):
                flow = result
            elif isinstance(result, FlowBuilder):
                flow = result.compile()
            else:
                flow = builder.compile()
            self.register(flow)
            setattr(builder_fn, "__flow_definition__", flow)
            return builder_fn

        return decorator

    def build_router(
        self,
        orchestrate: Callable[[FlowDefinition, BaseModel, Any], Union[Awaitable[BaseModel], BaseModel]],
        *,
        prefix: str = "/orchestrator",
        tags: Optional[Sequence[str]] = None,
        runtime_dependency: Optional[Callable[..., Any]] = None,
        flow_filter: Optional[Callable[[FlowDefinition], bool]] = None,
    ) -> Any:
        self._ensure_discovery()
        if APIRouter is None:
            raise RuntimeError("FastAPI is required to materialize flow routes")
        router = APIRouter(prefix=prefix, tags=list(tags or ["orchestrator"]))
        flows = (
            flow
            for flow in self._flows.values()
            if flow_filter is None or flow_filter(flow)
        )
        for flow in flows:
            endpoint = flow.build_endpoint(orchestrate, runtime_dependency=runtime_dependency)
            router.add_api_route(
                flow.api_path(),
                endpoint,
                name=flow.key,
                summary=flow.title,
                description=flow.description,
                response_model=flow.output_model,
                methods=[flow.method.upper()],
                tags=list(flow.tags or tags or ["orchestrator"]),
            )
        return router

    def openapi_operations(self) -> Tuple[Dict[str, Any], ...]:
        self._ensure_discovery()
        return tuple(flow.openapi_operation() for flow in self._flows.values())

    def autodiscover(self) -> None:
        if (
            not self._autodiscover_package
            or self._autodiscover_done
            or self._autodiscover_in_progress
        ):
            return
        self._autodiscover_in_progress = True
        try:
            try:
                package = importlib.import_module(self._autodiscover_package)
            except ImportError as exc:  # pragma: no cover - optional dependency
                logger.debug("Flow autodiscovery skipped: %s", exc)
                return
            module_path = getattr(package, "__path__", None)
            if not module_path:
                return
            prefix = package.__name__ + "."
            for _, name, _ in pkgutil.walk_packages(module_path, prefix):
                if name.endswith(".registry") or name.endswith(".cards"):
                    continue
                try:
                    importlib.import_module(name)
                except Exception as exc:  # pragma: no cover - keep server alive
                    logger.warning(
                        "Failed to import %s during flow autodiscovery: %s", name, exc
                    )
                    continue
            self._autodiscover_done = True
        finally:
            self._autodiscover_in_progress = False

    def _ensure_discovery(self) -> None:
        if not self._autodiscover_done:
            self.autodiscover()


def _merge_payload_with_path(payload: BaseModel, updates: Dict[str, Any]) -> BaseModel:
    if not updates:
        return payload
    if hasattr(payload, "model_copy"):
        return payload.model_copy(update=updates)  # type: ignore[attr-defined]
    return payload.copy(update=updates)  # type: ignore[no-any-return]


def _field_annotation(model_cls: Type[BaseModel], field_name: str) -> Any:
    fields = getattr(model_cls, "model_fields", None)
    if fields and field_name in fields:
        field = fields[field_name]
        annotation = getattr(field, "annotation", None)
        if annotation is not None:
            return annotation
        return getattr(field, "outer_type_", Any)
    fields = getattr(model_cls, "__fields__", None)
    if fields and field_name in fields:
        field = fields[field_name]
        return getattr(field, "annotation", None) or getattr(field, "type_", Any)
    return Any


FLOWS = FlowRegistry(REGISTRY, autodiscover_package="apps.backend.src.orchestrator.flows")


__all__ = [
    "FLOWS",
    "FlowBuilder",
    "FlowDefinition",
    "FlowRegistry",
    "FlowTask",
    "OperatorMeta",
    "OperatorRegistry",
    "REGISTRY",
    "TaskHandle",
    "_extract_model_type",
    "operator",
]

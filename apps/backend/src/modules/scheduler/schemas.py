"""Pydantic schemas and utilities for schedule DAG specifications."""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class ScheduleDagNode(BaseModel):
    """Single node within a schedule DAG."""

    id: str = Field(..., description="Unique identifier within the DAG")
    flow: str = Field(..., description="Orchestrator flow key to execute")
    inputs: Dict[str, Any] = Field(default_factory=dict, alias="in")

    model_config = {
        "populate_by_name": True,
        "alias_generator": lambda x: "in" if x == "inputs" else x,
    }


class ScheduleDagEdge(BaseModel):
    """Directed connection between nodes."""

    source: str
    target: str


class ScheduleDagGraph(BaseModel):
    nodes: List[ScheduleDagNode]
    edges: List[ScheduleDagEdge] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_graph(self) -> "ScheduleDagGraph":
        ids = {node.id for node in self.nodes}
        if len(ids) != len(self.nodes):
            raise ValueError("Duplicate node ids are not allowed")
        for edge in self.edges:
            if edge.source not in ids or edge.target not in ids:
                raise ValueError("Edges must reference valid node ids")
        return self


class ScheduleDagSpec(BaseModel):
    """Full DAG specification including optional schedule payload."""

    dag: ScheduleDagGraph
    payload: Dict[str, Any] = Field(default_factory=dict)


class ScheduleTemplateKey(str, Enum):
    """Pre-defined template identifiers."""

    MAIL_TRENDS_WITH_REPLY = "mail.trends_with_reply"


class MailScheduleTemplateParams(BaseModel):
    """Parameters for the mail trends + reply template."""

    persona_id: int
    persona_account_id: int
    email_to: str
    country: str = "US"
    limit: int = 20
    wait_timeout_s: int = 7 * 24 * 3600
    pipeline_id: Optional[str] = None


class ScheduleCompileRequest(BaseModel):
    template: ScheduleTemplateKey
    mail: Optional[MailScheduleTemplateParams] = None

    @model_validator(mode="after")
    def _ensure_params(self) -> "ScheduleCompileRequest":
        if self.template == ScheduleTemplateKey.MAIL_TRENDS_WITH_REPLY:
            if self.mail is None:
                raise ValueError("mail parameters are required for the selected template")
        return self

    def extract_params(self) -> MailScheduleTemplateParams:
        if self.template == ScheduleTemplateKey.MAIL_TRENDS_WITH_REPLY:
            assert self.mail is not None
            return self.mail
        raise ValueError(f"Unsupported template '{self.template}'")


class ScheduleCompileResult(BaseModel):
    dag_spec: ScheduleDagSpec


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def payload_ref(path: str) -> str:
    return f"$.payload.{path}"


def node_ref(node_id: str, path: str) -> str:
    return f"$.nodes.{node_id}.{path}"


def resume_ref(path: str) -> str:
    return f"$.resume.{path}"


class ScheduleDagBuilder:
    """Convenience builder for DAG specifications."""

    def __init__(self) -> None:
        self._nodes: List[ScheduleDagNode] = []
        self._edges: List[ScheduleDagEdge] = []
        self._payload: Dict[str, Any] = {}
        self._counter = 0

    def add_node(self, flow: str, node_id: Optional[str] = None, **inputs: Any) -> str:
        node_id = node_id or self._generate_node_id(flow)
        node = ScheduleDagNode(id=node_id, flow=flow, inputs=_clean_dict(inputs))
        self._nodes.append(node)
        return node_id

    def connect(self, source: str, target: str) -> None:
        self._edges.append(ScheduleDagEdge(source=source, target=target))

    def payload(self, **values: Any) -> None:
        for key, value in values.items():
            if value is not None:
                self._payload[key] = value

    def build_model(self) -> ScheduleDagSpec:
        graph = ScheduleDagGraph(nodes=self._nodes, edges=self._edges)
        return ScheduleDagSpec(dag=graph, payload=self._payload)

    def build(self) -> Dict[str, Any]:
        return self.build_model().model_dump(by_alias=True, exclude_none=True)

    def _generate_node_id(self, flow: str) -> str:
        self._counter += 1
        suffix = flow.split(".")[-1]
        return f"{suffix}_{self._counter}"


def _clean_dict(mapping: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in mapping.items() if v is not None}


__all__ = [
    "ScheduleDagNode",
    "ScheduleDagEdge",
    "ScheduleDagGraph",
    "ScheduleDagSpec",
    "ScheduleTemplateKey",
    "MailScheduleTemplateParams",
    "ScheduleCompileRequest",
    "ScheduleCompileResult",
    "ScheduleDagBuilder",
    "payload_ref",
    "node_ref",
    "resume_ref",
]

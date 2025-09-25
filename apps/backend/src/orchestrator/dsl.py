"""Dynamic DAG parsing utilities for schedule-provided specifications."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, Iterable, List, Mapping, Optional

from apps.backend.src.orchestrator.registry import FLOWS, FlowDefinition


@dataclass
class DagNode:
    """Single node definition in a schedule-provided DAG."""

    id: str
    flow: FlowDefinition
    inputs: Dict[str, Any]
    payload_builder: Optional[Callable[[Mapping[str, Any]], Dict[str, Any]]] = None


@dataclass
class DagSpec:
    """Concrete, validated DAG specification."""

    nodes: Dict[str, DagNode]
    adjacency: Dict[str, List[str]]
    predecessors: Dict[str, List[str]]
    entry_nodes: List[str]
    topological_order: List[str]


def parse_dag_spec(spec: Dict[str, Any]) -> DagSpec:
    """Validate and expand a raw ``dag_spec`` payload."""

    if not isinstance(spec, dict):
        raise ValueError("dag_spec must be an object")

    dag_payload = spec.get("dag")
    if not isinstance(dag_payload, dict):
        raise ValueError("dag_spec requires a 'dag' object")

    raw_nodes = dag_payload.get("nodes")
    raw_edges = dag_payload.get("edges")

    if not isinstance(raw_nodes, list) or not raw_nodes:
        raise ValueError("dag.nodes must be a non-empty list")

    nodes: Dict[str, DagNode] = {}
    for item in raw_nodes:
        if not isinstance(item, dict):
            raise ValueError("dag.nodes entries must be objects")
        node_id = item.get("id")
        flow_key = item.get("flow") or item.get("op")
        if not node_id or not isinstance(node_id, str):
            raise ValueError("dag.nodes entries must include string 'id'")
        if node_id in nodes:
            raise ValueError(f"Duplicate node id '{node_id}' in dag.nodes")
        if not flow_key or not isinstance(flow_key, str):
            raise ValueError(f"Node '{node_id}' missing string 'flow'")
        try:
            flow = FLOWS.get(flow_key)
        except KeyError as exc:  # pragma: no cover - flow missing
            raise ValueError(f"Flow '{flow_key}' not registered") from exc
        inputs = item.get("in")
        if inputs is None:
            inputs = {}
        elif not isinstance(inputs, dict):
            raise ValueError(f"Node '{node_id}' input mapping must be an object")
        nodes[node_id] = DagNode(id=node_id, flow=flow, inputs=inputs)

    adjacency: Dict[str, List[str]] = {node_id: [] for node_id in nodes}
    predecessors: Dict[str, List[str]] = {node_id: [] for node_id in nodes}

    if raw_edges is None:
        raw_edges = []
    if not isinstance(raw_edges, list):
        raise ValueError("dag.edges must be a list")

    for edge in raw_edges:
        if not isinstance(edge, (list, tuple)) or len(edge) != 2:
            raise ValueError("dag.edges entries must be [source, target]")
        source, target = edge
        if source not in nodes:
            raise ValueError(f"Edge source '{source}' is not a node id")
        if target not in nodes:
            raise ValueError(f"Edge target '{target}' is not a node id")
        adjacency[source].append(target)
        predecessors[target].append(source)

    entry_nodes = [node_id for node_id, preds in predecessors.items() if not preds]
    if not entry_nodes:
        raise ValueError("dag must contain at least one entry node")

    order = _topological_sort(nodes.keys(), adjacency, predecessors)

    return DagSpec(
        nodes=nodes,
        adjacency=adjacency,
        predecessors=predecessors,
        entry_nodes=entry_nodes,
        topological_order=order,
    )


def _topological_sort(
    node_ids: Iterable[str],
    adjacency: Dict[str, List[str]],
    predecessors: Dict[str, List[str]],
) -> List[str]:
    remaining = {node_id: len(predecessors[node_id]) for node_id in node_ids}
    queue: List[str] = [node_id for node_id, count in remaining.items() if count == 0]
    order: List[str] = []

    while queue:
        node_id = queue.pop(0)
        order.append(node_id)
        for downstream in adjacency.get(node_id, []):
            remaining[downstream] -= 1
            if remaining[downstream] == 0:
                queue.append(downstream)

    if len(order) != len(list(node_ids)):
        raise ValueError("dag contains a cycle")

    return order


__all__ = ["DagNode", "DagSpec", "parse_dag_spec"]

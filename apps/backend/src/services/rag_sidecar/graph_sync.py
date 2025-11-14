from __future__ import annotations

import hashlib
import json
import logging
from typing import Iterable, Mapping, Optional, Sequence

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from apps.backend.src.modules.accounts.models import Persona
from apps.backend.src.modules.campaigns.models import Campaign
from apps.backend.src.modules.drafts.models import Draft, DraftVariant, PostPublication
from apps.backend.src.modules.insights.models import InsightComment
from apps.backend.src.modules.playbooks.models import Playbook
from apps.backend.src.modules.rag.models import GraphChunk, GraphEdge, GraphNode
from apps.backend.src.modules.rag.events import GraphRagRefreshEvent, publish_graph_rag_refresh
from apps.backend.src.modules.reactive.models import ReactionRule
from apps.backend.src.modules.trends.models import Trend
from apps.backend.src.services.embeddings import embed_texts_sync
from apps.backend.src.core.config import settings

from .chunker import chunk_sections
from .types import CanonicalPayload, EdgeReference, NodeReference

logger = logging.getLogger(__name__)

_SOURCE_MODEL_MAP: Mapping[str, type] = {
    "personas": Persona,
    "campaigns": Campaign,
    "playbooks": Playbook,
    "drafts": Draft,
    "draft_variants": DraftVariant,
    "post_publications": PostPublication,
    "trends": Trend,
    "insight_comments": InsightComment,
    "reaction_rules": ReactionRule,
}


class SyncResult:
    def __init__(self, node: GraphNode, chunks_synced: int, edges_synced: int, skipped: bool):
        self.node = node
        self.chunks_synced = chunks_synced
        self.edges_synced = edges_synced
        self.skipped = skipped


def sync_payload(session: Session, payload: CanonicalPayload) -> SyncResult:
    """
    Upsert GraphNode/chunks/edges for the supplied payload.
    """
    node = _get_or_create_node(session, payload)
    signature_hash = _signature(payload)

    if node.signature_hash == signature_hash:
        _ensure_source_ref(session, payload, node)
        session.commit()
        _publish_refresh_event(node, payload)
        return SyncResult(node=node, chunks_synced=0, edges_synced=0, skipped=True)

    body_chunks = chunk_sections(payload.body_sections)
    texts: list[str] = []
    if payload.summary:
        texts.append(payload.summary)
    texts.extend(body_chunks)

    embeddings: list[list[float]] = []
    if texts:
        embeddings = embed_texts_sync(texts)
        if any(len(vec) != settings.EMBED_DIM for vec in embeddings):
            logger.warning(
                "Embedding dimension mismatch detected for node_type=%s source=%s:%s; skipping embeddings.",
                payload.node_type,
                payload.source_table,
                payload.source_id,
            )
            embeddings = []

    node_embedding = None
    chunk_embeddings: list[list[float]] = []
    if embeddings:
        if payload.summary:
            node_embedding = embeddings[0]
            chunk_embeddings = embeddings[1:]
        else:
            node_embedding = embeddings[0]
            chunk_embeddings = embeddings

    node.embedding = node_embedding
    node.node_type = payload.node_type
    node.source_table = payload.source_table
    node.source_id = payload.source_id
    node.owner_user_id = payload.owner_user_id
    node.persona_id = payload.persona_id
    node.campaign_id = payload.campaign_id
    node.title = payload.title
    node.summary = payload.summary
    node.meta = dict(payload.meta)
    node.meta["embedding_provider"] = payload.embedding_provider
    node.meta["embedding_model"] = payload.embedding_model
    node.signature_hash = signature_hash

    session.add(node)
    session.flush()

    chunks_synced = _sync_chunks(session, node, body_chunks, chunk_embeddings)
    edges_synced = _sync_edges(session, node, payload.edges)

    _ensure_source_ref(session, payload, node)

    session.commit()
    _publish_refresh_event(node, payload)
    return SyncResult(node=node, chunks_synced=chunks_synced, edges_synced=edges_synced, skipped=False)


def _get_or_create_node(session: Session, payload: CanonicalPayload) -> GraphNode:
    stmt = select(GraphNode).where(
        GraphNode.node_type == payload.node_type,
        GraphNode.source_table == payload.source_table,
        GraphNode.source_id == payload.source_id,
    )
    existing = session.execute(stmt).scalar_one_or_none()
    if existing:
        return existing

    node = GraphNode(
        node_type=payload.node_type,
        source_table=payload.source_table,
        source_id=payload.source_id,
        owner_user_id=payload.owner_user_id,
        persona_id=payload.persona_id,
        campaign_id=payload.campaign_id,
        title=payload.title,
        summary=payload.summary,
        meta=dict(payload.meta),
    )
    session.add(node)
    session.flush()
    return node


def _sync_chunks(
    session: Session,
    node: GraphNode,
    chunk_texts: Sequence[str],
    chunk_embeddings: Sequence[Sequence[float]],
) -> int:
    session.execute(delete(GraphChunk).where(GraphChunk.node_id == node.id))
    session.flush()

    count = 0
    for idx, text in enumerate(chunk_texts or []):
        embedding = None
        if idx < len(chunk_embeddings):
            embedding = list(chunk_embeddings[idx])

        chunk = GraphChunk(
            node_id=node.id,
            chunk_index=idx,
            body_text=text,
            keywords=None,
            meta={},
            embedding=embedding,
        )
        session.add(chunk)
        count += 1
    return count


def _sync_edges(session: Session, node: GraphNode, edges: Sequence[EdgeReference]) -> int:
    if not edges:
        session.execute(delete(GraphEdge).where(GraphEdge.src_node_id == node.id))
        return 0

    session.execute(delete(GraphEdge).where(GraphEdge.src_node_id == node.id))
    session.flush()

    inserted = 0
    for edge in edges:
        dst_id = _resolve_node_id(session, edge.dst)
        if not dst_id:
            continue
        graph_edge = GraphEdge(
            src_node_id=node.id,
            dst_node_id=dst_id,
            edge_type=edge.edge_type,
            weight=edge.weight,
            meta=dict(edge.meta) if edge.meta else None,
        )
        session.add(graph_edge)
        inserted += 1
    return inserted


def _resolve_node_id(session: Session, ref: NodeReference) -> Optional[str]:
    stmt = select(GraphNode.id).where(
        GraphNode.node_type == ref.node_type,
        GraphNode.source_table == ref.source_table,
        GraphNode.source_id == ref.source_id,
    )
    result = session.execute(stmt).scalar_one_or_none()
    return str(result) if result else None


def _publish_refresh_event(node: GraphNode, payload: CanonicalPayload) -> None:
    try:
        publish_graph_rag_refresh(
            GraphRagRefreshEvent(
                trigger="graph_sync",
                persona_id=node.persona_id or payload.persona_id,
                campaign_id=node.campaign_id or payload.campaign_id,
            )
        )
    except Exception:
        logger.exception(
            "Failed to publish Graph RAG refresh event",
            extra={
                "persona_id": node.persona_id or payload.persona_id,
                "campaign_id": node.campaign_id or payload.campaign_id,
            },
        )


def _ensure_source_ref(session: Session, payload: CanonicalPayload, node: GraphNode) -> None:
    model_cls = _SOURCE_MODEL_MAP.get(payload.source_table)
    if not model_cls:
        return

    try:
        source_id_int = int(payload.source_id)
    except (TypeError, ValueError):
        source_id_int = payload.source_id

    source = session.get(model_cls, source_id_int)
    if not source:
        logger.debug(
            "Graph sidecar could not locate source record table=%s id=%s",
            payload.source_table,
            payload.source_id,
        )
        return

    if getattr(source, "graph_node_id", None) != node.id:
        setattr(source, "graph_node_id", node.id)
        session.add(source)


def _signature(payload: CanonicalPayload) -> str:
    signature_body = {
        "summary": payload.summary,
        "sections": list(payload.body_sections),
        "meta": payload.meta,
        "extras": payload.signature_extras,
    }
    serialized = json.dumps(signature_body, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

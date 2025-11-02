from __future__ import annotations

import logging
from typing import Any, Optional, Sequence
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.rag.models import GraphChunk, GraphEdge, GraphNode
from apps.backend.src.modules.rag.schemas import RagRelatedEdge, RagSearchItem
from apps.backend.src.services.embeddings import embed_texts

logger = logging.getLogger(__name__)


async def search_rag(
    db: AsyncSession,
    *,
    query_text: str,
    owner_user_id: Optional[int] = None,
    persona_ids: Optional[Sequence[int]] = None,
    campaign_ids: Optional[Sequence[int]] = None,
    limit: int = 6,
) -> list[RagSearchItem]:
    try:
        vectors = await embed_texts([query_text])
    except Exception:
        logger.exception("failed to embed RAG query")
        return []

    if not vectors:
        return []

    query_vec = vectors[0]
    distance = GraphNode.embedding.cosine_distance(query_vec)

    stmt: Select = (
        select(
            GraphNode.id,
            GraphNode.node_type,
            GraphNode.title,
            GraphNode.summary,
            GraphNode.meta,
            GraphNode.source_table,
            GraphNode.source_id,
            GraphNode.updated_at,
            distance.label("distance"),
        )
        .where(GraphNode.embedding.isnot(None))
    )

    if owner_user_id is not None:
        stmt = stmt.where(GraphNode.owner_user_id == owner_user_id)
    if persona_ids:
        stmt = stmt.where(GraphNode.persona_id.in_(persona_ids))
    if campaign_ids:
        stmt = stmt.where(GraphNode.campaign_id.in_(campaign_ids))

    stmt = stmt.order_by(distance.asc()).limit(max(limit * 3, limit))

    rows = (await db.execute(stmt)).all()
    if not rows:
        return []

    ranked: dict[tuple[str | None, str | None], tuple[Any, float]] = {}
    for row in rows:
        key = (row.source_table, row.source_id)
        current = ranked.get(key)
        if current is None or row.distance < current[1]:
            ranked[key] = (row, row.distance)

    selected_rows = sorted(
        (row for row, _ in ranked.values()),
        key=lambda r: r.distance,
    )[:limit]

    node_ids = [row.id for row in selected_rows]
    chunks_map = await _fetch_chunks(db, node_ids)
    related_map = await _fetch_related(db, node_ids)

    return [
        RagSearchItem(
            node_id=row.id,
            node_type=row.node_type,
            title=row.title,
            summary=row.summary,
            meta=row.meta or {},
            source_table=row.source_table,
            source_id=row.source_id,
            score=max(0.0, 1.0 - float(row.distance or 0.0)),
            chunks=chunks_map.get(row.id, []),
            related=related_map.get(row.id, []),
        )
        for row in selected_rows
    ]


async def _fetch_chunks(db: AsyncSession, node_ids: Sequence[UUID]) -> dict[UUID, list[str]]:
    if not node_ids:
        return {}

    stmt = (
        select(GraphChunk.node_id, GraphChunk.body_text, GraphChunk.chunk_index)
        .where(GraphChunk.node_id.in_(node_ids))
        .order_by(GraphChunk.node_id, GraphChunk.chunk_index)
    )
    rows = (await db.execute(stmt)).all()
    buckets: dict[UUID, list[str]] = {}
    for node_id, body_text, _idx in rows:
        bucket = buckets.setdefault(node_id, [])
        if len(bucket) >= 2:
            continue
        if isinstance(body_text, str):
            bucket.append(body_text)
    return buckets


async def _fetch_related(db: AsyncSession, node_ids: Sequence[UUID]) -> dict[UUID, list[RagRelatedEdge]]:
    if not node_ids:
        return {}

    stmt = (
        select(
            GraphEdge.src_node_id,
            GraphEdge.dst_node_id,
            GraphEdge.edge_type,
            GraphEdge.meta,
            GraphNode.node_type,
            GraphNode.title,
            GraphNode.summary,
            GraphNode.meta.label("dst_meta"),
        )
        .join(GraphNode, GraphNode.id == GraphEdge.dst_node_id, isouter=True)
        .where(GraphEdge.src_node_id.in_(node_ids))
    )

    rows = (await db.execute(stmt)).all()
    buckets: dict[UUID, list[RagRelatedEdge]] = {}
    for src_id, dst_id, edge_type, meta, dst_node_type, dst_title, dst_summary, dst_meta in rows:
        bucket = buckets.setdefault(src_id, [])
        bucket.append(
            RagRelatedEdge(
                dst_node_id=dst_id,
                edge_type=edge_type,
                meta=meta or {},
                node_type=dst_node_type,
                title=dst_title,
                summary=dst_summary,
                node_meta=dst_meta or {},
            )
        )
    return buckets


async def expand_neighbors(
    db: AsyncSession,
    *,
    node_id: UUID,
    limit: int = 20,
    edge_types: Optional[Sequence[str]] = None,
) -> list[RagRelatedEdge]:
    edges_map = await _fetch_related(db, [node_id])
    edges = edges_map.get(node_id, [])
    if edge_types:
        edges = [edge for edge in edges if edge.edge_type in edge_types]
    if limit:
        edges = edges[:limit]
    return edges

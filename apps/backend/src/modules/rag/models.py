from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from apps.backend.src.core.db import Base
from apps.backend.src.core.config import settings


class GraphNode(Base):
    """Graph RAG base node that represents a canonical entity snapshot."""

    __tablename__ = "rag_nodes"
    __table_args__ = (
        Index("ix_rag_nodes_owner_user_id", "owner_user_id"),
        Index("ix_rag_nodes_persona_campaign", "persona_id", "campaign_id"),
        Index("ix_rag_nodes_type_source", "node_type", "source_table"),
    )

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    node_type: Mapped[str] = mapped_column(String(64), index=True)
    source_table: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    source_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    owner_user_id: Mapped[Optional[int]] = mapped_column(Integer, index=True)
    persona_id: Mapped[Optional[int]] = mapped_column(Integer, index=True)
    campaign_id: Mapped[Optional[int]] = mapped_column(Integer, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(256))
    summary: Mapped[Optional[str]] = mapped_column(String(1500))
    meta: Mapped[dict | None] = mapped_column(JSON, default=dict)
    signature_hash: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(settings.EMBED_DIM), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    outgoing_edges: Mapped[list["GraphEdge"]] = relationship(
        "GraphEdge",
        back_populates="source",
        cascade="all, delete-orphan",
        foreign_keys="GraphEdge.src_node_id",
    )
    incoming_edges: Mapped[list["GraphEdge"]] = relationship(
        "GraphEdge",
        back_populates="target",
        cascade="all, delete-orphan",
        foreign_keys="GraphEdge.dst_node_id",
    )
    chunks: Mapped[list["GraphChunk"]] = relationship(
        "GraphChunk",
        back_populates="node",
        cascade="all, delete-orphan",
    )


class GraphEdge(Base):
    """Directed graph edge between two RAG nodes."""

    __tablename__ = "rag_edges"
    __table_args__ = (
        Index("ix_rag_edges_src_dst", "src_node_id", "dst_node_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    src_node_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("rag_nodes.id", ondelete="CASCADE"), index=True
    )
    dst_node_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("rag_nodes.id", ondelete="CASCADE"), index=True
    )
    edge_type: Mapped[str] = mapped_column(String(64), index=True)
    weight: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    meta: Mapped[dict | None] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    source: Mapped["GraphNode"] = relationship(
        "GraphNode",
        back_populates="outgoing_edges",
        foreign_keys=[src_node_id],
    )
    target: Mapped["GraphNode"] = relationship(
        "GraphNode",
        back_populates="incoming_edges",
        foreign_keys=[dst_node_id],
    )


class GraphChunk(Base):
    """Chunked text payload linked to a graph node."""

    __tablename__ = "rag_chunks"
    __table_args__ = (
        UniqueConstraint("node_id", "chunk_index", name="uq_rag_chunk_node_index"),
        Index("ix_rag_chunks_node_id", "node_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    node_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("rag_nodes.id", ondelete="CASCADE"), index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    body_text: Mapped[str] = mapped_column(String(4000))
    keywords: Mapped[list[str] | None] = mapped_column(JSON)
    meta: Mapped[dict | None] = mapped_column(JSON, default=dict)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(settings.EMBED_DIM), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    node: Mapped["GraphNode"] = relationship("GraphNode", back_populates="chunks")

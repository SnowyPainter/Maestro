"""add graph rag nodes and embeddings"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision = "202501050001"
down_revision = "202412180001"
branch_labels = None
depends_on = None

EMBED_DIM = 1024


def upgrade() -> None:
    # --- Core graph tables -------------------------------------------------
    op.create_table(
        "rag_nodes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("node_type", sa.String(length=64), nullable=False),
        sa.Column("source_table", sa.String(length=64), nullable=True),
        sa.Column("source_id", sa.String(length=128), nullable=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=True),
        sa.Column("persona_id", sa.Integer(), nullable=True),
        sa.Column("campaign_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=256), nullable=True),
        sa.Column("summary", sa.String(length=1500), nullable=True),
        sa.Column("meta", sa.JSON(), nullable=True),
        sa.Column("signature_hash", sa.String(length=64), nullable=True),
        sa.Column("embedding", Vector(EMBED_DIM), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("rag_nodes_pkey")),
    )
    op.create_index("ix_rag_nodes_node_type", "rag_nodes", ["node_type"], unique=False)
    op.create_index("ix_rag_nodes_source_id", "rag_nodes", ["source_id"], unique=False)
    op.create_index("ix_rag_nodes_owner_user_id", "rag_nodes", ["owner_user_id"], unique=False)
    op.create_index(
        "ix_rag_nodes_persona_campaign",
        "rag_nodes",
        ["persona_id", "campaign_id"],
        unique=False,
    )
    op.create_index(
        "ix_rag_nodes_type_source",
        "rag_nodes",
        ["node_type", "source_table"],
        unique=False,
    )
    op.create_index(
        "ix_rag_nodes_signature_hash", "rag_nodes", ["signature_hash"], unique=False
    )

    op.create_table(
        "rag_edges",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("src_node_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dst_node_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("edge_type", sa.String(length=64), nullable=False),
        sa.Column("weight", sa.Float(), nullable=True),
        sa.Column("meta", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["src_node_id"],
            ["rag_nodes.id"],
            name=op.f("rag_edges_src_node_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["dst_node_id"],
            ["rag_nodes.id"],
            name=op.f("rag_edges_dst_node_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("rag_edges_pkey")),
    )
    op.create_index("ix_rag_edges_src_node_id", "rag_edges", ["src_node_id"], unique=False)
    op.create_index("ix_rag_edges_dst_node_id", "rag_edges", ["dst_node_id"], unique=False)
    op.create_index("ix_rag_edges_edge_type", "rag_edges", ["edge_type"], unique=False)
    op.create_index(
        "ix_rag_edges_src_dst",
        "rag_edges",
        ["src_node_id", "dst_node_id"],
        unique=False,
    )

    op.create_table(
        "rag_chunks",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("node_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("body_text", sa.String(length=4000), nullable=False),
        sa.Column("keywords", sa.JSON(), nullable=True),
        sa.Column("meta", sa.JSON(), nullable=True),
        sa.Column("embedding", Vector(EMBED_DIM), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["node_id"],
            ["rag_nodes.id"],
            name=op.f("rag_chunks_node_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("rag_chunks_pkey")),
        sa.UniqueConstraint("node_id", "chunk_index", name=op.f("uq_rag_chunk_node_index")),
    )
    op.create_index("ix_rag_chunks_node_id", "rag_chunks", ["node_id"], unique=False)

    # --- Existing domain tables -------------------------------------------
    op.add_column(
        "drafts",
        sa.Column("graph_node_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("drafts", sa.Column("embedding", Vector(EMBED_DIM), nullable=True))
    op.create_index("ix_drafts_graph_node_id", "drafts", ["graph_node_id"], unique=False)

    op.add_column(
        "draft_variants",
        sa.Column("graph_node_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "draft_variants", sa.Column("embedding", Vector(EMBED_DIM), nullable=True)
    )
    op.create_index(
        "ix_draft_variants_graph_node_id",
        "draft_variants",
        ["graph_node_id"],
        unique=False,
    )

    op.add_column(
        "post_publications",
        sa.Column("graph_node_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "post_publications", sa.Column("embedding", Vector(EMBED_DIM), nullable=True)
    )
    op.create_index(
        "ix_post_publications_graph_node_id",
        "post_publications",
        ["graph_node_id"],
        unique=False,
    )

    op.add_column(
        "insight_samples",
        sa.Column("graph_node_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "insight_samples", sa.Column("embedding", Vector(EMBED_DIM), nullable=True)
    )
    op.create_index(
        "ix_insight_samples_graph_node_id",
        "insight_samples",
        ["graph_node_id"],
        unique=False,
    )

    op.add_column(
        "insight_comments",
        sa.Column("graph_node_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "insight_comments", sa.Column("embedding", Vector(EMBED_DIM), nullable=True)
    )
    op.create_index(
        "ix_insight_comments_graph_node_id",
        "insight_comments",
        ["graph_node_id"],
        unique=False,
    )

    op.add_column(
        "personas",
        sa.Column("graph_node_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("personas", sa.Column("embedding", Vector(EMBED_DIM), nullable=True))
    op.add_column("personas", sa.Column("keywords", sa.JSON(), nullable=True))
    op.create_index("ix_personas_graph_node_id", "personas", ["graph_node_id"], unique=False)

    op.add_column(
        "campaigns",
        sa.Column("graph_node_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("campaigns", sa.Column("embedding", Vector(EMBED_DIM), nullable=True))
    op.create_index("ix_campaigns_graph_node_id", "campaigns", ["graph_node_id"], unique=False)

    op.add_column("playbooks", sa.Column("summary", sa.Text(), nullable=True))
    op.add_column(
        "playbooks",
        sa.Column("graph_node_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("playbooks", sa.Column("embedding", Vector(EMBED_DIM), nullable=True))
    op.create_index("ix_playbooks_graph_node_id", "playbooks", ["graph_node_id"], unique=False)

    op.add_column(
        "trends",
        sa.Column("graph_node_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_trends_graph_node_id", "trends", ["graph_node_id"], unique=False)

    op.add_column(
        "reaction_rules",
        sa.Column("graph_node_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "reaction_rules", sa.Column("embedding", Vector(EMBED_DIM), nullable=True)
    )
    op.create_index(
        "ix_reaction_rules_graph_node_id",
        "reaction_rules",
        ["graph_node_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_reaction_rules_graph_node_id", table_name="reaction_rules")
    op.drop_column("reaction_rules", "embedding")
    op.drop_column("reaction_rules", "graph_node_id")

    op.drop_index("ix_trends_graph_node_id", table_name="trends")
    op.drop_column("trends", "graph_node_id")

    op.drop_index("ix_playbooks_graph_node_id", table_name="playbooks")
    op.drop_column("playbooks", "embedding")
    op.drop_column("playbooks", "graph_node_id")
    op.drop_column("playbooks", "summary")

    op.drop_index("ix_campaigns_graph_node_id", table_name="campaigns")
    op.drop_column("campaigns", "embedding")
    op.drop_column("campaigns", "graph_node_id")

    op.drop_index("ix_personas_graph_node_id", table_name="personas")
    op.drop_column("personas", "keywords")
    op.drop_column("personas", "embedding")
    op.drop_column("personas", "graph_node_id")

    op.drop_index("ix_insight_comments_graph_node_id", table_name="insight_comments")
    op.drop_column("insight_comments", "embedding")
    op.drop_column("insight_comments", "graph_node_id")

    op.drop_index("ix_insight_samples_graph_node_id", table_name="insight_samples")
    op.drop_column("insight_samples", "embedding")
    op.drop_column("insight_samples", "graph_node_id")

    op.drop_index("ix_post_publications_graph_node_id", table_name="post_publications")
    op.drop_column("post_publications", "embedding")
    op.drop_column("post_publications", "graph_node_id")

    op.drop_index("ix_draft_variants_graph_node_id", table_name="draft_variants")
    op.drop_column("draft_variants", "embedding")
    op.drop_column("draft_variants", "graph_node_id")

    op.drop_index("ix_drafts_graph_node_id", table_name="drafts")
    op.drop_column("drafts", "embedding")
    op.drop_column("drafts", "graph_node_id")

    op.drop_table("rag_chunks")
    op.drop_table("rag_edges")
    op.drop_table("rag_nodes")

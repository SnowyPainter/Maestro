"""Add insight_comments table for comment snapshots

Revision ID: 202409130001
Revises: 202409120001
Create Date: 2024-09-13 00:01:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

from apps.backend.src.modules.common.enums import PlatformKind


# revision identifiers, used by Alembic.
revision = "202409130001"
down_revision = "202409120001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    platform_enum = sa.Enum(PlatformKind, name="platformkind")

    op.create_table(
        "insight_comments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "post_publication_id",
            sa.Integer(),
            sa.ForeignKey("post_publications.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("platform", platform_enum, nullable=False),
        sa.Column("platform_post_id", sa.String(length=128), nullable=True),
        sa.Column(
            "account_persona_id",
            sa.Integer(),
            sa.ForeignKey("persona_accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("comment_external_id", sa.String(length=128), nullable=False),
        sa.Column("parent_external_id", sa.String(length=128), nullable=True),
        sa.Column("author_id", sa.String(length=128), nullable=True),
        sa.Column("author_username", sa.String(length=128), nullable=True),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("permalink", sa.String(length=512), nullable=True),
        sa.Column("comment_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "metrics",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'::json"),
        ),
        sa.Column(
            "ingested_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        sa.Column("raw", sa.JSON(), nullable=False),
        sa.UniqueConstraint("platform", "comment_external_id", name="uq_insight_comment_external"),
    )

    op.create_index("ix_insight_comments_owner_user_id", "insight_comments", ["owner_user_id"])
    op.create_index("ix_insight_comments_post_publication_id", "insight_comments", ["post_publication_id"])
    op.create_index("ix_insight_comments_account_persona_id", "insight_comments", ["account_persona_id"])
    op.create_index("ix_insight_comments_platform_post_id", "insight_comments", ["platform_post_id"])
    op.create_index("ix_insight_comments_ingested_at", "insight_comments", ["ingested_at"])
    op.create_index(
        "ix_insight_comment_post_created",
        "insight_comments",
        ["post_publication_id", "comment_created_at"],
    )
    op.create_index(
        "ix_insight_comment_platform_post",
        "insight_comments",
        ["platform", "platform_post_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_insight_comment_platform_post", table_name="insight_comments")
    op.drop_index("ix_insight_comment_post_created", table_name="insight_comments")
    op.drop_index("ix_insight_comments_ingested_at", table_name="insight_comments")
    op.drop_index("ix_insight_comments_platform_post_id", table_name="insight_comments")
    op.drop_index("ix_insight_comments_account_persona_id", table_name="insight_comments")
    op.drop_index("ix_insight_comments_post_publication_id", table_name="insight_comments")
    op.drop_index("ix_insight_comments_owner_user_id", table_name="insight_comments")
    op.drop_table("insight_comments")

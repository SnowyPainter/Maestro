"""add tracking links table"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202501150001"
down_revision = "202501050001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tracking_links",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("persona_id", sa.Integer(), nullable=False),
        sa.Column("variant_id", sa.Integer(), nullable=True),
        sa.Column("draft_id", sa.Integer(), nullable=True),
        sa.Column("target_url", sa.Text(), nullable=False),
        sa.Column("context", sa.JSON(), nullable=True),
        sa.Column("visit_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_visited_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["persona_id"],
            ["personas.id"],
            name=op.f("tracking_links_persona_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["variant_id"],
            ["draft_variants.id"],
            name=op.f("tracking_links_variant_id_fkey"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["draft_id"],
            ["drafts.id"],
            name=op.f("tracking_links_draft_id_fkey"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("tracking_links_pkey")),
        sa.UniqueConstraint("token", name=op.f("uq_tracking_link_token")),
    )
    op.create_index(
        "ix_tracking_links_owner_user_id",
        "tracking_links",
        ["owner_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_tracking_links_variant_id",
        "tracking_links",
        ["variant_id"],
        unique=False,
    )
    op.create_index(
        "ix_tracking_links_draft_id",
        "tracking_links",
        ["draft_id"],
        unique=False,
    )
    op.create_index(
        "ix_tracking_links_persona_created_at",
        "tracking_links",
        ["persona_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_tracking_links_persona_created_at", table_name="tracking_links")
    op.drop_index("ix_tracking_links_draft_id", table_name="tracking_links")
    op.drop_index("ix_tracking_links_variant_id", table_name="tracking_links")
    op.drop_index("ix_tracking_links_owner_user_id", table_name="tracking_links")
    op.drop_table("tracking_links")

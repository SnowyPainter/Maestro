"""Add is_owned_by_me column to insight_comments

Revision ID: 202412180001
Revises: 202409130001
Create Date: 2024-12-18 00:01:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "202412180001"
down_revision = "202409130001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_owned_by_me column to insight_comments table
    op.add_column(
        "insight_comments",
        sa.Column(
            "is_owned_by_me",
            sa.Boolean(),
            nullable=True,
            index=True,
        ),
    )


def downgrade() -> None:
    # Remove is_owned_by_me column from insight_comments table
    op.drop_column("insight_comments", "is_owned_by_me")

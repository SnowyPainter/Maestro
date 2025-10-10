"""Switch scheduler JSON columns to JSONB

Revision ID: 202409120001
Revises: 
Create Date: 2024-09-12 00:01:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "202409120001"
down_revision = None
branch_labels = None
depends_on = None


_SCHEDULE_COLUMNS = {
    "dag_spec": False,
    "payload": True,
    "context": True,
    "errors": True,
}


def _alter_schedule_columns(to_type: sa.types.TypeEngine, using: str) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("schedules"):
        return

    op.execute("DROP INDEX IF EXISTS idx_schedules_context")

    for column, nullable in _SCHEDULE_COLUMNS.items():
        op.alter_column(
            "schedules",
            column,
            type_=to_type,
            postgresql_using=f"{column}{using}",
            existing_nullable=nullable,
        )

    # recreate index with desired operator class when upgrading to JSONB
    if isinstance(to_type, postgresql.JSONB):
        op.create_index(
            "idx_schedules_context",
            "schedules",
            ["context"],
            postgresql_using="gin",
            postgresql_ops={"context": "jsonb_path_ops"},
        )


def upgrade() -> None:
    _alter_schedule_columns(postgresql.JSONB(), "::jsonb")
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("coworker_leases"):
        op.alter_column(
            "coworker_leases",
            "persona_account_ids",
            type_=postgresql.JSONB(),
            postgresql_using="persona_account_ids::jsonb",
            existing_nullable=False,
        )


def downgrade() -> None:
    _alter_schedule_columns(postgresql.JSON(), "::json")
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("coworker_leases"):
        op.alter_column(
            "coworker_leases",
            "persona_account_ids",
            type_=postgresql.JSON(),
            postgresql_using="persona_account_ids::json",
            existing_nullable=False,
        )

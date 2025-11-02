"""Change embedding dimension to 768

Revision ID: fa9b94d59f1b
Revises: 202501050001
Create Date: 2025-11-02 19:43:08.735223

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = 'fa9b94d59f1b'
down_revision: Union[str, Sequence[str], None] = '202501050001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Change embedding dimension from 1024 to 768."""
    # Change rag_nodes.embedding dimension
    op.execute("ALTER TABLE rag_nodes ALTER COLUMN embedding TYPE vector(768)")

    # Change rag_chunks.embedding dimension
    op.execute("ALTER TABLE rag_chunks ALTER COLUMN embedding TYPE vector(768)")

    # Change other tables' embedding dimensions
    op.execute("ALTER TABLE drafts ALTER COLUMN embedding TYPE vector(768)")
    op.execute("ALTER TABLE draft_variants ALTER COLUMN embedding TYPE vector(768)")
    op.execute("ALTER TABLE post_publications ALTER COLUMN embedding TYPE vector(768)")
    op.execute("ALTER TABLE insight_samples ALTER COLUMN embedding TYPE vector(768)")
    op.execute("ALTER TABLE insight_comments ALTER COLUMN embedding TYPE vector(768)")
    op.execute("ALTER TABLE personas ALTER COLUMN embedding TYPE vector(768)")
    op.execute("ALTER TABLE campaigns ALTER COLUMN embedding TYPE vector(768)")
    op.execute("ALTER TABLE playbooks ALTER COLUMN embedding TYPE vector(768)")
    op.execute("ALTER TABLE reaction_rules ALTER COLUMN embedding TYPE vector(768)")


def downgrade() -> None:
    """Downgrade schema: Change embedding dimension from 768 to 1024."""
    # Change back to 1024 dimensions
    op.execute("ALTER TABLE rag_nodes ALTER COLUMN embedding TYPE vector(1024)")
    op.execute("ALTER TABLE rag_chunks ALTER COLUMN embedding TYPE vector(1024)")
    op.execute("ALTER TABLE drafts ALTER COLUMN embedding TYPE vector(1024)")
    op.execute("ALTER TABLE draft_variants ALTER COLUMN embedding TYPE vector(1024)")
    op.execute("ALTER TABLE post_publications ALTER COLUMN embedding TYPE vector(1024)")
    op.execute("ALTER TABLE insight_samples ALTER COLUMN embedding TYPE vector(1024)")
    op.execute("ALTER TABLE insight_comments ALTER COLUMN embedding TYPE vector(1024)")
    op.execute("ALTER TABLE personas ALTER COLUMN embedding TYPE vector(1024)")
    op.execute("ALTER TABLE campaigns ALTER COLUMN embedding TYPE vector(1024)")
    op.execute("ALTER TABLE playbooks ALTER COLUMN embedding TYPE vector(1024)")
    op.execute("ALTER TABLE reaction_rules ALTER COLUMN embedding TYPE vector(1024)")

"""service definition graphs + generated + block_versions (CB04)

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-07-24 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, Sequence[str], None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for col in ('graphs', 'generated', 'block_versions'):
        op.add_column(
            'service_definition',
            sa.Column(col, postgresql.JSONB(), nullable=False, server_default='{}'),
        )


def downgrade() -> None:
    for col in ('block_versions', 'generated', 'graphs'):
        op.drop_column('service_definition', col)

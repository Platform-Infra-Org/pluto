"""service definition id_field (per-service resource id path, E08)

Revision ID: b1c2d3e4f5a6
Revises: d9cd752dbb34
Create Date: 2026-07-25 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, Sequence[str], None] = 'd9cd752dbb34'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'service_definition',
        sa.Column('id_field', sa.String(), nullable=False, server_default='metadata.name'),
    )


def downgrade() -> None:
    op.drop_column('service_definition', 'id_field')

"""service definition + pinned versioning (E08)

Revision ID: d4e5f6a7b8c9
Revises: b2c3d4e5f6a7
Create Date: 2026-07-24 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'service_definition',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('owner_team', sa.String(), nullable=False),
        sa.Column('form_schema', postgresql.JSONB(), nullable=False),
        sa.Column('ui_schema', postgresql.JSONB(), nullable=False),
        sa.Column('workflow_binding', postgresql.JSONB(), nullable=False),
        sa.Column('approval_policy', postgresql.JSONB(), nullable=False),
        sa.Column('git_path', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_service_definition_name', 'service_definition', ['name'])
    op.add_column(
        'resource_index',
        sa.Column('definition_version', sa.Integer(), nullable=False, server_default='1'),
    )


def downgrade() -> None:
    op.drop_column('resource_index', 'definition_version')
    op.drop_index('ix_service_definition_name', table_name='service_definition')
    op.drop_table('service_definition')

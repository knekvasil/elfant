"""add draft capital to players

Revision ID: a3f7c2e91b40
Revises: d2e331360665
Create Date: 2026-08-20 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a3f7c2e91b40'
down_revision: Union[str, Sequence[str], None] = 'd2e331360665'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('players', sa.Column('draft_round', sa.Integer(), nullable=True))
    op.add_column('players', sa.Column('draft_ovr', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('players', 'draft_ovr')
    op.drop_column('players', 'draft_round')

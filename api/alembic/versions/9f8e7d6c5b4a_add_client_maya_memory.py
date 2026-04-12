"""add maya_memory to clients

Revision ID: 9f8e7d6c5b4a
Revises: e2f3a4b5c6d7
Create Date: 2026-04-12
"""
from alembic import op
import sqlalchemy as sa

revision = '9f8e7d6c5b4a'
down_revision = 'e2f3a4b5c6d7'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('clients', sa.Column('maya_memory', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('clients', 'maya_memory')

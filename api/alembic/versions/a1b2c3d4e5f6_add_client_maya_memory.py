"""add maya_memory to clients

Revision ID: a1b2c3d4e5f6
Revises: f01457e6f4d8
Create Date: 2026-04-12
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'f01457e6f4d8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('clients', sa.Column('maya_memory', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('clients', 'maya_memory')

"""add photo_reference and rating to stays

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-04-12

"""
from alembic import op
import sqlalchemy as sa

revision = 'e2f3a4b5c6d7'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('stays', sa.Column('photo_reference', sa.String(500), nullable=True))
    op.add_column('stays', sa.Column('rating', sa.Float(), nullable=True))


def downgrade():
    op.drop_column('stays', 'rating')
    op.drop_column('stays', 'photo_reference')

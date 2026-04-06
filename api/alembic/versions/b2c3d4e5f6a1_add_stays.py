"""add_stays

Revision ID: b2c3d4e5f6a1
Revises: a1b2c3d4e5f6
Create Date: 2026-03-29 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'b2c3d4e5f6a1'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'stays',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('trip_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('stay_order', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('check_in', sa.DateTime(), nullable=False),
        sa.Column('check_out', sa.DateTime(), nullable=False),
        sa.Column('confirmation_number', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_stays_trip_id'), 'stays', ['trip_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_stays_trip_id'), table_name='stays')
    op.drop_table('stays')

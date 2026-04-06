"""add_flights

Revision ID: a1b2c3d4e5f6
Revises: f01457e6f4d8
Create Date: 2026-03-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f01457e6f4d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'flights',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('trip_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('leg_order', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('flight_number', sa.String(length=20), nullable=False),
        sa.Column('airline', sa.String(length=255), nullable=False),
        sa.Column('departure_airport', sa.String(length=10), nullable=False),
        sa.Column('arrival_airport', sa.String(length=10), nullable=False),
        sa.Column('departure_time', sa.DateTime(), nullable=False),
        sa.Column('arrival_time', sa.DateTime(), nullable=False),
        sa.Column('terminal_departure', sa.String(length=50), nullable=True),
        sa.Column('terminal_arrival', sa.String(length=50), nullable=True),
        sa.Column('booking_ref', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_flights_trip_id'), 'flights', ['trip_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_flights_trip_id'), table_name='flights')
    op.drop_table('flights')

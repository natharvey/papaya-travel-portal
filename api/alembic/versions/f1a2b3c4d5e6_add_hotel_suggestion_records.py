"""add hotel_suggestion_records table

Revision ID: f1a2b3c4d5e6
Revises: 9f8e7d6c5b4a
Create Date: 2026-04-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'f1a2b3c4d5e6'
down_revision = '9f8e7d6c5b4a'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'hotel_suggestion_records',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('trip_id', UUID(as_uuid=True), sa.ForeignKey('trips.id'), nullable=False, index=True),
        sa.Column('destination', sa.String(255), nullable=False),
        sa.Column('hotel_data', sa.JSON(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='suggestion'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_hotel_suggestion_records_trip_id', 'hotel_suggestion_records', ['trip_id'])


def downgrade():
    op.drop_index('ix_hotel_suggestion_records_trip_id', 'hotel_suggestion_records')
    op.drop_table('hotel_suggestion_records')

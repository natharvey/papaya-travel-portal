"""add_stay_map_fields

Revision ID: c3d4e5f6a1b2
Revises: b2c3d4e5f6a1
Create Date: 2026-04-11 00:00:00.000000

Adds latitude, longitude, website, and google_place_id to the stays table.
latitude/longitude are used for map pins.
website is used for the "Book direct" button on the hotel card.
google_place_id is reserved for Google Places photo fetching (hotel card phase).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a1b2'
down_revision: Union[str, None] = 'b2c3d4e5f6a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('stays', sa.Column('latitude', sa.Float(), nullable=True))
    op.add_column('stays', sa.Column('longitude', sa.Float(), nullable=True))
    op.add_column('stays', sa.Column('website', sa.String(length=500), nullable=True))
    op.add_column('stays', sa.Column('google_place_id', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('stays', 'google_place_id')
    op.drop_column('stays', 'website')
    op.drop_column('stays', 'longitude')
    op.drop_column('stays', 'latitude')

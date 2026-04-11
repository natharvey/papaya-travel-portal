"""simplify trip statuses

Revision ID: d1e2f3a4b5c6
Revises: c3d4e5f6a1b2
Create Date: 2026-04-11

"""
from alembic import op

revision = 'd1e2f3a4b5c6'
down_revision = 'c3d4e5f6a1b2'
branch_labels = None
depends_on = None


def upgrade():
    # Migrate old statuses to new simplified pipeline
    op.execute("UPDATE trips SET status = 'ACTIVE' WHERE status IN ('REVIEW', 'CONFIRMED', 'DRAFT')")
    op.execute("UPDATE trips SET status = 'COMPLETED' WHERE status = 'ARCHIVED'")
    op.execute("UPDATE trips SET status = 'GENERATING' WHERE status = 'INTAKE'")


def downgrade():
    op.execute("UPDATE trips SET status = 'REVIEW' WHERE status = 'ACTIVE'")
    op.execute("UPDATE trips SET status = 'ARCHIVED' WHERE status = 'COMPLETED'")
    op.execute("UPDATE trips SET status = 'INTAKE' WHERE status = 'GENERATING'")

"""add_election_paused_fields

Revision ID: a1b2c3d4e5f6
Revises: f6805a57ae2e
Create Date: 2026-11-06 22:50:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'a1b2c3d4e5f6'
down_revision: str | Sequence[str] | None = 'f6805a57ae2e'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade(engine_name: str) -> None:
    """Upgrade schema for engine."""
    fn = globals().get(f"upgrade_{engine_name}")
    if fn:
        fn()


def downgrade(engine_name: str) -> None:
    """Downgrade schema for engine."""
    fn = globals().get(f"downgrade_{engine_name}")
    if fn:
        fn()


def upgrade_identity() -> None:
    pass


def downgrade_identity() -> None:
    pass


def upgrade_election() -> None:
    op.add_column('elections', sa.Column('paused_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('elections', sa.Column('pause_reason', sa.Text(), nullable=True))


def downgrade_election() -> None:
    op.drop_column('elections', 'pause_reason')
    op.drop_column('elections', 'paused_at')


def upgrade_ballot() -> None:
    pass


def downgrade_ballot() -> None:
    pass

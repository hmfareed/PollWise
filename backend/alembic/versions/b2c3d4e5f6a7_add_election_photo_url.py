"""add_election_photo_url

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-11-07 12:15:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'b2c3d4e5f6a7'
down_revision: str | Sequence[str] | None = 'a1b2c3d4e5f6'
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
    op.add_column('elections', sa.Column('photo_url', sa.String(length=1024), nullable=True))


def downgrade_election() -> None:
    op.drop_column('elections', 'photo_url')


def upgrade_ballot() -> None:
    pass


def downgrade_ballot() -> None:
    pass

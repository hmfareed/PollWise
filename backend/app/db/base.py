from datetime import UTC, datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""


class IdentityBase(DeclarativeBase):
    """Base class for Identity database models (identity_db)."""


class ElectionBase(DeclarativeBase):
    """Base class for Election management database models (election_db)."""


class BallotBase(DeclarativeBase):
    """Base class for Ballot-box database models (ballot_db)."""


class TimestampMixin:
    """Standard timestamp tracking mixin."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

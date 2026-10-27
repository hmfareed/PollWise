"""
Pollwise Ballot Database Models (ballot_db)

Architectural Invariant:
This database stores strictly anonymous ballot submissions and credential redemptions.
Under no circumstances may any column, index, constraint, or foreign key link to:
- user_id
- voter_id
- email / identity provider subjects
- network IP addresses or session tokens
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import BallotBase
from app.models.identity import GUID


class BallotCredentialRedemption(BallotBase):
    """
    Enforces atomic, one-time credential redemption inside ballot_db.
    The credential_hash is an election-scoped keyed HMAC to prevent
    cross-database join correlation with identity_db.
    """
    __tablename__ = "ballot_credential_redemptions"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID(), primary_key=True, default=uuid.uuid4
    )
    election_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), nullable=False, index=True
    )
    credential_hash: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )
    redeemed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(32), default="accepted", nullable=False
    )

    __table_args__ = (
        UniqueConstraint("election_id", "credential_hash", name="uq_redemption_election_hash"),
    )


class Ballot(BallotBase):
    """
    Secret ballot record.
    Must never contain or reference voter identity fields.
    """
    __tablename__ = "ballots"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID(), primary_key=True, default=uuid.uuid4
    )
    election_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), nullable=False, index=True
    )
    configuration_hash: Mapped[str] = mapped_column(
        String(64), nullable=False
    )
    ballot_payload: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
    )
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=True,
    )
    integrity_metadata: Mapped[dict[str, Any] | None] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )

    choices: Mapped[list["BallotChoice"]] = relationship(
        "BallotChoice",
        back_populates="ballot",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class BallotChoice(BallotBase):
    """
    Normalized individual position selections for fast, deterministic tallying.
    """
    __tablename__ = "ballot_choices"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID(), primary_key=True, default=uuid.uuid4
    )
    ballot_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("ballots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), nullable=False, index=True
    )
    candidate_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), nullable=True, index=True
    )
    is_abstain: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    ballot: Mapped["Ballot"] = relationship("Ballot", back_populates="choices")

    __table_args__ = (
        Index("ix_ballot_choices_tally", "position_id", "candidate_id"),
    )

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import ElectionBase, TimestampMixin
from app.models.identity import GUID


class ElectionVoterAuthConfig(ElectionBase, TimestampMixin):
    __tablename__ = "election_voter_auth_configs"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    election_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("elections.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    identifier_type: Mapped[str] = mapped_column(
        String(50), default="institutional_email", nullable=False
    )
    identifier_label: Mapped[str] = mapped_column(
        String(100), default="Institutional Email", nullable=False
    )
    identifier_normalization_rules: Mapped[dict[str, Any] | None] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=True
    )
    otp_length: Mapped[int] = mapped_column(Integer, default=6, nullable=False)
    otp_expiry_seconds: Mapped[int] = mapped_column(Integer, default=300, nullable=False)
    otp_max_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    otp_regeneration_cooldown_seconds: Mapped[int] = mapped_column(
        Integer, default=30, nullable=False
    )
    session_idle_timeout_seconds: Mapped[int] = mapped_column(
        Integer, default=600, nullable=False
    )
    session_max_duration_seconds: Mapped[int] = mapped_column(
        Integer, default=3600, nullable=False
    )
    allow_session_resume: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    allow_position_skip: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    configuration_locked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __init__(self, **kwargs):
        kwargs.setdefault("id", uuid.uuid4())
        kwargs.setdefault("identifier_type", "institutional_email")
        kwargs.setdefault("identifier_label", "Institutional Email")
        kwargs.setdefault("otp_length", 6)
        kwargs.setdefault("otp_expiry_seconds", 300)
        kwargs.setdefault("otp_max_attempts", 5)
        kwargs.setdefault("otp_regeneration_cooldown_seconds", 30)
        kwargs.setdefault("session_idle_timeout_seconds", 600)
        kwargs.setdefault("session_max_duration_seconds", 3600)
        kwargs.setdefault("allow_session_resume", True)
        kwargs.setdefault("allow_position_skip", True)
        super().__init__(**kwargs)


class ElectionVoterRecord(ElectionBase, TimestampMixin):
    __tablename__ = "election_voter_records"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    election_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    identifier_type: Mapped[str] = mapped_column(String(50), nullable=False)
    normalized_identifier: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    voter_reference_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), nullable=True, index=True
    )
    eligibility_status: Mapped[str] = mapped_column(
        String(50), default="eligible", nullable=False, index=True
    )
    voter_group: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source: Mapped[str] = mapped_column(String(50), default="manual_entry", nullable=False)

    def __init__(self, **kwargs):
        kwargs.setdefault("id", uuid.uuid4())
        kwargs.setdefault("eligibility_status", "eligible")
        kwargs.setdefault("source", "manual_entry")
        super().__init__(**kwargs)

    __table_args__ = (
        UniqueConstraint(
            "election_id",
            "identifier_type",
            "normalized_identifier",
            name="uq_election_voter_identifier",
        ),
    )


class VoterOTPChallenge(ElectionBase):
    __tablename__ = "voter_otp_challenges"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    election_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    voter_record_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("election_voter_records.id", ondelete="CASCADE"), nullable=False, index=True
    )
    challenge_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    otp_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    def __init__(self, **kwargs):
        kwargs.setdefault("id", uuid.uuid4())
        kwargs.setdefault("attempt_count", 0)
        kwargs.setdefault("created_at", datetime.now(UTC))
        super().__init__(**kwargs)


class VotingSession(ElectionBase):
    __tablename__ = "voting_sessions"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    election_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    voter_record_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("election_voter_records.id", ondelete="CASCADE"), nullable=False, index=True
    )
    terminal_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True, index=True)
    session_token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    session_status: Mapped[str] = mapped_column(
        String(50), default="active", nullable=False, index=True
    )
    draft_payload: Mapped[dict[str, Any] | None] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=True
    )
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    confirmation_reference: Mapped[str | None] = mapped_column(String(64), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_activity_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    def __init__(self, **kwargs):
        kwargs.setdefault("id", uuid.uuid4())
        kwargs.setdefault("session_status", "active")
        kwargs.setdefault("created_at", datetime.now(UTC))
        kwargs.setdefault("last_activity_at", datetime.now(UTC))
        super().__init__(**kwargs)


class ElectionParticipation(ElectionBase):
    __tablename__ = "election_participation"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    election_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    voter_record_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("election_voter_records.id", ondelete="CASCADE"), nullable=False, index=True
    )
    participation_status: Mapped[str] = mapped_column(String(50), default="submitted", nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    confirmation_reference: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)

    def __init__(self, **kwargs):
        kwargs.setdefault("id", uuid.uuid4())
        kwargs.setdefault("participation_status", "submitted")
        kwargs.setdefault("submitted_at", datetime.now(UTC))
        super().__init__(**kwargs)

    __table_args__ = (
        UniqueConstraint("election_id", "voter_record_id", name="uq_election_voter_participation"),
    )


class VotingCentre(ElectionBase, TimestampMixin):
    __tablename__ = "voting_centres"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    institution_id: Mapped[uuid.UUID] = mapped_column(GUID(), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    location_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)

    def __init__(self, **kwargs):
        kwargs.setdefault("id", uuid.uuid4())
        kwargs.setdefault("status", "active")
        super().__init__(**kwargs)

    terminals: Mapped[list["VotingTerminal"]] = relationship(
        "VotingTerminal", back_populates="centre", cascade="all, delete-orphan", lazy="selectin"
    )


class VotingTerminal(ElectionBase, TimestampMixin):
    __tablename__ = "voting_terminals"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    voting_centre_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("voting_centres.id", ondelete="CASCADE"), nullable=False, index=True
    )
    institution_id: Mapped[uuid.UUID] = mapped_column(GUID(), nullable=False, index=True)
    terminal_name: Mapped[str] = mapped_column(String(100), nullable=False)
    authorized_election_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True, index=True)
    terminal_status: Mapped[str] = mapped_column(String(50), default="idle", nullable=False)
    auth_token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __init__(self, **kwargs):
        kwargs.setdefault("id", uuid.uuid4())
        kwargs.setdefault("terminal_status", "idle")
        super().__init__(**kwargs)

    centre: Mapped["VotingCentre"] = relationship("VotingCentre", back_populates="terminals")

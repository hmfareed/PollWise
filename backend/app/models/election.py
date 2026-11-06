import enum
import hashlib
import json
import uuid
from datetime import UTC, datetime
from typing import Any, ClassVar

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import ElectionBase, TimestampMixin
from app.models.identity import GUID


class ElectionStatus:
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    OPEN = "open"
    PAUSED = "paused"
    CLOSED = "closed"
    TALLIED = "tallied"
    PUBLISHED = "published"
    CANCELED = "canceled"

    ALL_STATUSES: ClassVar[list[str]] = [DRAFT, SCHEDULED, OPEN, PAUSED, CLOSED, TALLIED, PUBLISHED, CANCELED]


class ApprovalType:
    LAUNCH = "launch"
    TALLY = "tally"
    PUBLICATION = "publication"


class ApprovalDecision:
    APPROVED = "approved"
    REJECTED = "rejected"


class Election(ElectionBase, TimestampMixin):
    __tablename__ = "elections"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(GUID(), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default=ElectionStatus.DRAFT, nullable=False, index=True
    )
    opens_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)
    voting_method: Mapped[str] = mapped_column(
        String(50), default="single_choice_per_position", nullable=False
    )
    configuration_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    configuration_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    pause_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(GUID(), nullable=False)

    positions: Mapped[list["Position"]] = relationship(
        "Position",
        back_populates="election",
        cascade="all, delete-orphan",
        order_by="Position.display_order",
        lazy="selectin",
    )
    approvals: Mapped[list["ElectionApproval"]] = relationship(
        "ElectionApproval",
        back_populates="election",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    reports: Mapped[list["ReportExport"]] = relationship(
        "ReportExport",
        back_populates="election",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    recount_requests: Mapped[list["RecountRequest"]] = relationship(
        "RecountRequest",
        back_populates="election",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def compute_configuration_hash(self) -> str:
        """Compute SHA-256 canonical hash of the frozen ballot definition (Doc 05 & 08)."""
        ballot_structure: dict[str, Any] = {
            "election_id": str(self.id),
            "voting_method": self.voting_method,
            "positions": [],
        }

        # Sort positions deterministically by display_order, then id
        sorted_positions = sorted(self.positions, key=lambda p: (p.display_order, str(p.id)))
        for pos in sorted_positions:
            pos_dict: dict[str, Any] = {
                "position_id": str(pos.id),
                "title": pos.title,
                "min_selections": pos.min_selections,
                "max_selections": pos.max_selections,
                "candidates": [],
            }
            # Only active candidates are included in the frozen ballot
            active_cands = [c for c in pos.candidates if c.status == "active"]
            sorted_cands = sorted(active_cands, key=lambda c: (c.display_order, str(c.id)))
            for cand in sorted_cands:
                pos_dict["candidates"].append(
                    {
                        "candidate_id": str(cand.id),
                        "name": cand.name,
                    }
                )
            ballot_structure["positions"].append(pos_dict)

        canonical_json = json.dumps(ballot_structure, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


class Position(ElectionBase):
    __tablename__ = "positions"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    election_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    max_selections: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    min_selections: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    election: Mapped["Election"] = relationship("Election", back_populates="positions")
    candidates: Mapped[list["Candidate"]] = relationship(
        "Candidate",
        back_populates="position",
        cascade="all, delete-orphan",
        order_by="Candidate.display_order",
        lazy="selectin",
    )


class Candidate(ElectionBase):
    __tablename__ = "candidates"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    position_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("positions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    biography: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    position: Mapped["Position"] = relationship("Position", back_populates="candidates")


class ElectionApproval(ElectionBase):
    __tablename__ = "election_approvals"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    election_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    approval_type: Mapped[str] = mapped_column(String(50), nullable=False)
    approver_actor_id: Mapped[uuid.UUID] = mapped_column(GUID(), nullable=False)
    decision: Mapped[str] = mapped_column(String(50), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    election: Mapped["Election"] = relationship("Election", back_populates="approvals")


class ElectionResult(ElectionBase):
    __tablename__ = "election_results"
    __table_args__ = (UniqueConstraint("election_id", "result_version", name="uq_election_result_version"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    election_id: Mapped[uuid.UUID] = mapped_column(GUID(), nullable=False, index=True)
    result_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    configuration_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    tally_algorithm_version: Mapped[str] = mapped_column(String(50), default="1.0", nullable=False)
    ballot_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    result_data: Mapped[str] = mapped_column(Text, nullable=False)  # JSON serialized totals
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    computed_by: Mapped[str] = mapped_column(String(255), nullable=False)
    approval_status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditEvent(ElectionBase):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True, index=True)
    election_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True, index=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    outcome: Mapped[str] = mapped_column(String(50), default="success", nullable=False)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )


class ReportExport(ElectionBase):
    __tablename__ = "report_exports"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    election_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    report_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    file_format: Mapped[str] = mapped_column(String(10), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    checksum: Mapped[str | None] = mapped_column(String(64), nullable=True)
    generated_by: Mapped[uuid.UUID] = mapped_column(GUID(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )

    election: Mapped["Election"] = relationship("Election", back_populates="reports")


class RecountStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    REJECTED = "rejected"


class RecountRequest(ElectionBase):
    __tablename__ = "recount_requests"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    election_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    requester_user_id: Mapped[uuid.UUID] = mapped_column(GUID(), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default=RecountStatus.PENDING, nullable=False)
    resulting_result_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("election_results.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    election: Mapped["Election"] = relationship("Election", back_populates="recount_requests")
    resulting_result: Mapped["ElectionResult | None"] = relationship("ElectionResult")



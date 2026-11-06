"""
Tests for Election Emergency Operational Controls (Pause, Resume, Emergency Close).
"""

import uuid
from datetime import UTC, datetime, timedelta
import pytest
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException, ErrorCode
from app.models.election import Election, ElectionStatus
from app.models.identity import Organization, OrganizationMembership, User
from app.schemas.election import PauseElectionRequest, ResumeElectionRequest
from app.services.election_service import ElectionService


def test_election_status_includes_paused():
    assert hasattr(ElectionStatus, "PAUSED")
    assert ElectionStatus.PAUSED == "paused"
    assert ElectionStatus.PAUSED in ElectionStatus.ALL_STATUSES


def test_pause_election_schema_validation():
    # Valid reason
    valid = PauseElectionRequest(reason="Emergency maintenance on ballot ingress network")
    assert valid.reason == "Emergency maintenance on ballot ingress network"

    # Strips whitespace
    padded = PauseElectionRequest(reason="   Emergency maintenance on ballot ingress network   ")
    assert padded.reason == "Emergency maintenance on ballot ingress network"

    # Too short (< 5 chars)
    with pytest.raises(ValidationError):
        PauseElectionRequest(reason="net")

    # Empty
    with pytest.raises(ValidationError):
        PauseElectionRequest(reason="")

    # Whitespace only
    with pytest.raises(ValidationError):
        PauseElectionRequest(reason="      ")


@pytest.mark.asyncio
async def test_pause_and_resume_election_service(
    test_identity_session: AsyncSession,
    test_election_session: AsyncSession,
):
    # Setup admin user & election
    admin = User(
        id=uuid.uuid4(),
        email_normalized="admin.emergency@polytechnic.edu",
        password_hash="hash",
        display_name="Emergency Admin",
        account_status="active",
    )
    org = Organization(id=uuid.uuid4(), name="Emergency Org", slug="emergency-org", status="active")
    test_identity_session.add_all([admin, org])
    await test_identity_session.flush()

    election_id = uuid.uuid4()
    election = Election(
        id=election_id,
        organization_id=org.id,
        title="Student Council Emergency Election",
        status=ElectionStatus.OPEN,
        opens_at=datetime.now(UTC) - timedelta(hours=2),
        closes_at=datetime.now(UTC) + timedelta(hours=5),
        timezone="UTC",
        configuration_version=1,
        configuration_hash="e" * 64,
        created_by=admin.id,
    )
    test_election_session.add(election)
    await test_election_session.commit()

    # 1. Pause election from OPEN state
    paused_election = await ElectionService.pause_election(
        test_election_session,
        election_id,
        actor=admin,
        reason="Kiosk network connectivity failure at North Campus",
    )
    assert paused_election.status == ElectionStatus.PAUSED
    assert paused_election.paused_at is not None
    assert paused_election.pause_reason == "Kiosk network connectivity failure at North Campus"

    # 2. Cannot pause an election that is already paused
    with pytest.raises(AppException) as exc_info:
        await ElectionService.pause_election(
            test_election_session,
            election_id,
            actor=admin,
            reason="Another pause attempt",
        )
    assert exc_info.value.status_code == 409

    # 3. Resume election from PAUSED state
    resumed_election = await ElectionService.resume_election(
        test_election_session,
        election_id,
        actor=admin,
        reason="Network connectivity restored",
    )
    assert resumed_election.status == ElectionStatus.OPEN
    assert resumed_election.paused_at is None
    assert resumed_election.pause_reason is None

    # 4. Cannot resume an election that is OPEN
    with pytest.raises(AppException) as exc_info:
        await ElectionService.resume_election(
            test_election_session,
            election_id,
            actor=admin,
            reason="Redundant resume",
        )
    assert exc_info.value.status_code == 409

    # 5. Emergency Close from PAUSED state
    await ElectionService.pause_election(
        test_election_session,
        election_id,
        actor=admin,
        reason="Terminating election early due to force majeure",
    )
    closed_election = await ElectionService.close_election(
        test_election_session,
        election_id,
        actor_id=admin.id,
    )
    assert closed_election.status == ElectionStatus.CLOSED

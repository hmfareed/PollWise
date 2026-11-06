"""
Tests for Emergency REST Endpoints (/pause, /resume) and Live Monitoring Service.
"""

import uuid
from datetime import UTC, datetime, timedelta
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.ballot import Ballot
from app.models.election import Candidate, Election, ElectionStatus, Position
from app.models.identity import Organization, OrganizationMembership, User
from app.models.voter_auth import ElectionVoterRecord


@pytest.mark.asyncio
async def test_emergency_rest_endpoints_lifecycle_and_rbac(
    test_client: AsyncClient,
    test_identity_session: AsyncSession,
    test_election_session: AsyncSession,
):
    # 1. Setup Admin and Voter
    admin = User(
        id=uuid.uuid4(),
        email_normalized="admin.mon@polytechnic.edu",
        password_hash=hash_password("AdminSecure123!"),
        display_name="Admin Mon",
        account_status="active",
    )
    voter = User(
        id=uuid.uuid4(),
        email_normalized="voter.mon@polytechnic.edu",
        password_hash=hash_password("VoterSecure123!"),
        display_name="Voter Mon",
        account_status="active",
    )
    org = Organization(id=uuid.uuid4(), name="Mon Org", slug="mon-org", status="active")
    test_identity_session.add_all([admin, voter, org])
    await test_identity_session.flush()

    admin_membership = OrganizationMembership(
        organization_id=org.id,
        user_id=admin.id,
        role="organization_admin",
        status="active",
    )
    voter_membership = OrganizationMembership(
        organization_id=org.id,
        user_id=voter.id,
        role="voter",
        status="active",
    )
    test_identity_session.add_all([admin_membership, voter_membership])
    await test_identity_session.flush()

    # 2. Setup Open Election
    election_id = uuid.uuid4()
    election = Election(
        id=election_id,
        organization_id=org.id,
        title="Student Union Monitoring Election",
        status=ElectionStatus.OPEN,
        opens_at=datetime.now(UTC) - timedelta(hours=2),
        closes_at=datetime.now(UTC) + timedelta(hours=6),
        timezone="UTC",
        configuration_version=1,
        configuration_hash="m" * 64,
        created_by=admin.id,
    )
    test_election_session.add(election)
    await test_election_session.commit()

    # 3. Unauthorized Voter Attempt -> 403 Forbidden
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "voter.mon@polytechnic.edu", "password": "VoterSecure123!"},
    )
    unauth_resp = await test_client.post(
        f"/api/v1/elections/{election_id}/pause",
        json={"reason": "Voter trying to pause election"},
    )
    assert unauth_resp.status_code == 403

    # 4. Login as Admin
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "admin.mon@polytechnic.edu", "password": "AdminSecure123!"},
    )

    # 5. Validation failure: short / whitespace reason -> 422
    bad_resp = await test_client.post(
        f"/api/v1/elections/{election_id}/pause",
        json={"reason": "     "},
    )
    assert bad_resp.status_code == 422

    # 6. Successful Pause
    pause_resp = await test_client.post(
        f"/api/v1/elections/{election_id}/pause",
        json={"reason": "Unscheduled network outage reported at Campus Library kiosk terminal"},
    )
    assert pause_resp.status_code == 200
    pdata = pause_resp.json()["data"]
    assert pdata["status"] == "paused"
    assert pdata["paused_at"] is not None
    assert "outage reported" in pdata["pause_reason"]

    # 7. Redundant Pause -> 409
    dup_pause = await test_client.post(
        f"/api/v1/elections/{election_id}/pause",
        json={"reason": "Another pause reason"},
    )
    assert dup_pause.status_code == 409

    # 8. Successful Resume
    resume_resp = await test_client.post(
        f"/api/v1/elections/{election_id}/resume",
        json={"reason": "Kiosk terminal network restored"},
    )
    assert resume_resp.status_code == 200
    rdata = resume_resp.json()["data"]
    assert rdata["status"] == "open"
    assert rdata["paused_at"] is None
    assert rdata["pause_reason"] is None


@pytest.mark.asyncio
async def test_live_monitoring_dashboard_and_privacy_threshold(
    test_client: AsyncClient,
    test_identity_session: AsyncSession,
    test_election_session: AsyncSession,
    test_ballot_session: AsyncSession,
):
    # Setup Admin
    admin = User(
        id=uuid.uuid4(),
        email_normalized="admin.live@polytechnic.edu",
        password_hash=hash_password("AdminSecure123!"),
        display_name="Live Admin",
        account_status="active",
    )
    org = Organization(id=uuid.uuid4(), name="Live Org", slug="live-org", status="active")
    test_identity_session.add_all([admin, org])
    await test_identity_session.flush()

    membership = OrganizationMembership(
        organization_id=org.id,
        user_id=admin.id,
        role="organization_admin",
        status="active",
    )
    test_identity_session.add(membership)
    await test_identity_session.flush()

    # Login as admin
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "admin.live@polytechnic.edu", "password": "AdminSecure123!"},
    )

    # Setup Election
    election_id = uuid.uuid4()
    pos_id = uuid.uuid4()
    c1_id = uuid.uuid4()

    election = Election(
        id=election_id,
        organization_id=org.id,
        title="Live Monitoring Privacy Test Election",
        status=ElectionStatus.OPEN,
        opens_at=datetime.now(UTC) - timedelta(hours=3),
        closes_at=datetime.now(UTC) + timedelta(hours=5),
        timezone="UTC",
        configuration_version=1,
        configuration_hash="l" * 64,
        created_by=admin.id,
    )
    pos = Position(id=pos_id, election_id=election_id, title="Chair", min_selections=1, max_selections=1, display_order=0)
    c1 = Candidate(id=c1_id, position_id=pos_id, name="Secret Candidate", display_order=0, status="active")
    test_election_session.add_all([election, pos, c1])
    await test_election_session.commit()

    # Setup Voter Roster with Departments:
    # Dept A: Engineering (15 voters -> >= 10, shown individually)
    # Dept B: Music (3 voters -> < 10, MUST be suppressed per Spec §11.2)
    # Dept C: Art (4 voters -> < 10, MUST be suppressed per Spec §11.2)
    voters = []
    for i in range(15):
        voters.append(
            ElectionVoterRecord(
                id=uuid.uuid4(),
                election_id=election_id,
                identifier_type="email",
                normalized_identifier=f"eng_{i}@poly.edu",
                voter_group="Engineering",
                eligibility_status="eligible",
            )
        )
    for i in range(3):
        voters.append(
            ElectionVoterRecord(
                id=uuid.uuid4(),
                election_id=election_id,
                identifier_type="email",
                normalized_identifier=f"mus_{i}@poly.edu",
                voter_group="Music",
                eligibility_status="eligible",
            )
        )
    for i in range(4):
        voters.append(
            ElectionVoterRecord(
                id=uuid.uuid4(),
                election_id=election_id,
                identifier_type="email",
                normalized_identifier=f"art_{i}@poly.edu",
                voter_group="Art",
                eligibility_status="eligible",
            )
        )
    test_election_session.add_all(voters)
    await test_election_session.commit()

    # Add 2 ballots to ballot_db
    now = datetime.now(UTC)
    b1 = Ballot(
        id=uuid.uuid4(),
        election_id=election_id,
        configuration_hash="l" * 64,
        ballot_payload={"selections": [{"position_id": str(pos_id), "candidate_ids": [str(c1_id)]}]},
        accepted_at=now - timedelta(hours=1),
    )
    b2 = Ballot(
        id=uuid.uuid4(),
        election_id=election_id,
        configuration_hash="l" * 64,
        ballot_payload={"selections": [{"position_id": str(pos_id), "candidate_ids": [str(c1_id)]}]},
        accepted_at=now - timedelta(minutes=20),
    )
    test_ballot_session.add_all([b1, b2])
    await test_ballot_session.commit()

    # Query GET /api/v1/elections/{id}/monitoring
    resp = await test_client.get(f"/api/v1/elections/{election_id}/monitoring")
    assert resp.status_code == 200
    data = resp.json()["data"]

    # 1. Summary checks
    assert data["election_id"] == str(election_id)
    assert data["total_eligible"] == 22  # 15 + 3 + 4
    assert data["ballots_cast"] == 2
    assert data["status"] == "open"

    # 2. Velocity checks (must return points with timestamps and ballot counts)
    assert len(data["velocity"]) >= 1

    # 3. Privacy Threshold Rule (Spec §11.2):
    # Engineering (15 voters) should be present
    # Music (3) and Art (4) must be aggregated under a suppressed group (< 10 voters)
    dept_names = [d["department"] for d in data["departmental_turnout"]]
    assert "Engineering" in dept_names
    assert "Music" not in dept_names
    assert "Art" not in dept_names
    # Suppressed bucket must exist
    suppressed_entry = next((d for d in data["departmental_turnout"] if d.get("is_suppressed")), None)
    assert suppressed_entry is not None
    assert suppressed_entry["eligible_count"] == 7  # 3 + 4

    # 4. Zero Interim Counts Invariant:
    # Candidate names, totals, and winner IDs must NEVER be present!
    assert "candidates" not in data
    assert "Secret Candidate" not in str(data)
    assert "winner_ids" not in str(data)

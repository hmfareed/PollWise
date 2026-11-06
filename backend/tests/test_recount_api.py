"""
Tests for Recount REST API endpoints (/api/v1/elections/{id}/recount).
"""

import uuid
from datetime import UTC, datetime, timedelta
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.ballot import Ballot
from app.models.election import Candidate, Election, Position
from app.models.identity import Organization, OrganizationMembership, User
from app.services.tally_service import TallyService


@pytest.mark.asyncio
async def test_recount_api_full_flow(
    test_client: AsyncClient,
    test_identity_session: AsyncSession,
    test_election_session: AsyncSession,
    test_ballot_session: AsyncSession,
):
    # 1. Setup Admin, Organization and Membership
    admin = User(
        id=uuid.uuid4(),
        email_normalized="auditor.api@polytechnic.edu",
        password_hash=hash_password("AuditorSecure123!"),
        display_name="Auditor API",
        email_verified_at=datetime.now(UTC),
        account_status="active",
    )
    org = Organization(id=uuid.uuid4(), name="Polytechnic Org", slug="polytechnic-org", status="active")
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

    # Login to set session cookie
    login_resp = await test_client.post(
        "/api/v1/auth/login",
        json={"email": "auditor.api@polytechnic.edu", "password": "AuditorSecure123!"},
    )
    assert login_resp.status_code == 200

    # 2. Setup Election, Position, Candidate
    election_id = uuid.uuid4()
    pos_id = uuid.uuid4()
    c1_id = uuid.uuid4()

    election = Election(
        id=election_id,
        organization_id=org.id,
        title="Student Union Presidential Election 2026",
        status="closed",
        opens_at=datetime.now(UTC) - timedelta(days=2),
        closes_at=datetime.now(UTC) - timedelta(hours=1),
        timezone="UTC",
        configuration_version=1,
        configuration_hash="a" * 64,
        created_by=admin.id,
    )
    pos = Position(id=pos_id, election_id=election_id, title="President", min_selections=1, max_selections=1, display_order=0)
    c1 = Candidate(id=c1_id, position_id=pos_id, name="Candidate One", display_order=0, status="active")
    test_election_session.add_all([election, pos, c1])
    await test_election_session.commit()

    # 3. Add a ballot
    ballot = Ballot(
        id=uuid.uuid4(),
        election_id=election_id,
        configuration_hash="a" * 64,
        ballot_payload={"selections": [{"position_id": str(pos_id), "candidate_ids": [str(c1_id)]}]},
    )
    test_ballot_session.add(ballot)
    await test_ballot_session.commit()

    # Initial tally
    await TallyService.compute_tally(test_ballot_session, test_election_session, election_id, admin)

    # 4. Test validation failure on empty/short or whitespace reason (Review Focus #2)
    bad_resp = await test_client.post(
        f"/api/v1/elections/{election_id}/recount",
        json={"reason": "ab"},
    )
    assert bad_resp.status_code == 422

    whitespace_resp = await test_client.post(
        f"/api/v1/elections/{election_id}/recount",
        json={"reason": "      "},
    )
    assert whitespace_resp.status_code == 422

    # 5. Test successful recount (version 2)
    recount_resp = await test_client.post(
        f"/api/v1/elections/{election_id}/recount",
        json={"reason": "Formal dispute lodged by student council regarding tie margins."},
    )
    assert recount_resp.status_code == 200
    res_data = recount_resp.json()["data"]
    assert res_data["result"]["result_version"] == 2
    assert res_data["result"]["ballot_count"] == 1
    assert res_data["result"]["approval_status"] == "pending"
    assert res_data["recount"]["status"] == "completed"
    assert "student council" in res_data["recount"]["reason"]

    # 6. Test consecutive recount produces version 3 (Review Focus #4)
    recount_v3_resp = await test_client.post(
        f"/api/v1/elections/{election_id}/recount",
        json={"reason": "Second audit recount requested after candidate complaint."},
    )
    assert recount_v3_resp.status_code == 200
    res_v3_data = recount_v3_resp.json()["data"]
    assert res_v3_data["result"]["result_version"] == 3
    assert res_v3_data["result"]["approval_status"] == "pending"
    assert res_v3_data["recount"]["id"] != res_data["recount"]["id"]

    # 7. Test GET recounts history returns all requests
    history_resp = await test_client.get(
        f"/api/v1/elections/{election_id}/recounts",
    )
    assert history_resp.status_code == 200
    history_data = history_resp.json()["data"]
    assert len(history_data) == 2
    history_ids = [r["id"] for r in history_data]
    assert res_data["recount"]["id"] in history_ids
    assert res_v3_data["recount"]["id"] in history_ids


@pytest.mark.asyncio
async def test_recount_api_unauthorized_voter_forbidden(
    test_client: AsyncClient,
    test_identity_session: AsyncSession,
    test_election_session: AsyncSession,
):
    """Review Focus #3: Unauthorized voter attempting recount receives 403 Forbidden."""
    # Setup Voter User
    voter = User(
        id=uuid.uuid4(),
        email_normalized="voter.user@polytechnic.edu",
        password_hash=hash_password("VoterSecure123!"),
        display_name="Voter User",
        email_verified_at=datetime.now(UTC),
        account_status="active",
    )
    org = Organization(id=uuid.uuid4(), name="Poly Voter Org", slug="poly-voter-org", status="active")
    test_identity_session.add_all([voter, org])
    await test_identity_session.flush()

    membership = OrganizationMembership(
        organization_id=org.id,
        user_id=voter.id,
        role="voter",
        status="active",
    )
    test_identity_session.add(membership)
    await test_identity_session.flush()

    # Login as voter
    login_resp = await test_client.post(
        "/api/v1/auth/login",
        json={"email": "voter.user@polytechnic.edu", "password": "VoterSecure123!"},
    )
    assert login_resp.status_code == 200

    # Create election in tallied status
    election_id = uuid.uuid4()
    election = Election(
        id=election_id,
        organization_id=org.id,
        title="Faculty Senate Election",
        status="tallied",
        opens_at=datetime.now(UTC) - timedelta(days=2),
        closes_at=datetime.now(UTC) - timedelta(hours=1),
        timezone="UTC",
        configuration_version=1,
        configuration_hash="b" * 64,
        created_by=uuid.uuid4(),
    )
    test_election_session.add(election)
    await test_election_session.commit()

    # Attempt recount as voter
    recount_resp = await test_client.post(
        f"/api/v1/elections/{election_id}/recount",
        json={"reason": "I am an ordinary voter requesting a recount."},
    )
    assert recount_resp.status_code == 403


@pytest.mark.asyncio
async def test_recount_resets_approval_and_blocks_publication(
    test_client: AsyncClient,
    test_identity_session: AsyncSession,
    test_election_session: AsyncSession,
    test_ballot_session: AsyncSession,
):
    """Review Focus #5: Recount produces pending result and blocks publication until re-approved."""
    admin = User(
        id=uuid.uuid4(),
        email_normalized="admin.approval@polytechnic.edu",
        password_hash=hash_password("AdminSecure123!"),
        display_name="Admin Approver",
        email_verified_at=datetime.now(UTC),
        account_status="active",
    )
    org = Organization(id=uuid.uuid4(), name="Poly Admin Org", slug="poly-admin-org", status="active")
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
    login_resp = await test_client.post(
        "/api/v1/auth/login",
        json={"email": "admin.approval@polytechnic.edu", "password": "AdminSecure123!"},
    )
    assert login_resp.status_code == 200

    election_id = uuid.uuid4()
    pos_id = uuid.uuid4()
    c1_id = uuid.uuid4()

    election = Election(
        id=election_id,
        organization_id=org.id,
        title="Department Chair Election",
        status="closed",
        opens_at=datetime.now(UTC) - timedelta(days=2),
        closes_at=datetime.now(UTC) - timedelta(hours=1),
        timezone="UTC",
        configuration_version=1,
        configuration_hash="c" * 64,
        created_by=admin.id,
    )
    pos = Position(id=pos_id, election_id=election_id, title="Chair", min_selections=1, max_selections=1, display_order=0)
    c1 = Candidate(id=c1_id, position_id=pos_id, name="Candidate Alpha", display_order=0, status="active")
    test_election_session.add_all([election, pos, c1])
    await test_election_session.commit()

    ballot = Ballot(
        id=uuid.uuid4(),
        election_id=election_id,
        configuration_hash="c" * 64,
        ballot_payload={"selections": [{"position_id": str(pos_id), "candidate_ids": [str(c1_id)]}]},
    )
    test_ballot_session.add(ballot)
    await test_ballot_session.commit()

    # 1. Compute initial tally
    await TallyService.compute_tally(test_ballot_session, test_election_session, election_id, admin)

    # 2. Approve initial tally
    approve_resp = await test_client.post(
        f"/api/v1/elections/{election_id}/results/approve",
        json={"decision": "approved", "reason": "Initial tally verified"},
    )
    assert approve_resp.status_code == 200

    # 3. Publish initial results -> status becomes published
    pub_resp = await test_client.post(f"/api/v1/elections/{election_id}/publish")
    assert pub_resp.status_code == 200

    # 4. Request recount on published election
    recount_resp = await test_client.post(
        f"/api/v1/elections/{election_id}/recount",
        json={"reason": "Audit request after candidate flagged potential margin discrepancy"},
    )
    assert recount_resp.status_code == 200
    assert recount_resp.json()["data"]["result"]["result_version"] == 2
    assert recount_resp.json()["data"]["result"]["approval_status"] == "pending"

    # 5. Attempt publication before approving version 2 -> must fail with 409 APPROVAL_REQUIRED
    pub_blocked_resp = await test_client.post(f"/api/v1/elections/{election_id}/publish")
    assert pub_blocked_resp.status_code == 409
    assert pub_blocked_resp.json()["error"]["code"] == "APPROVAL_REQUIRED"

    # 6. Approve latest version (without explicit result_id, testing multiple version handling)
    approve_v2_resp = await test_client.post(
        f"/api/v1/elections/{election_id}/results/approve",
        json={"decision": "approved", "reason": "Recounted tally re-audited and approved"},
    )
    assert approve_v2_resp.status_code == 200

    # 7. Now publication succeeds
    pub_success_resp = await test_client.post(f"/api/v1/elections/{election_id}/publish")
    assert pub_success_resp.status_code == 200


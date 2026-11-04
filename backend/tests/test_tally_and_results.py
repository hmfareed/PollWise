import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.ballot import Ballot
from app.models.election import Candidate, Election, Position
from app.models.identity import Organization, OrganizationMembership, User


@pytest.mark.asyncio
async def test_closed_election_tally_and_publication_pipeline(
    test_client: AsyncClient,
    test_identity_session: AsyncSession,
    test_election_session: AsyncSession,
    test_ballot_session: AsyncSession,
):
    # 1. Setup Admin and Organization
    admin = User(
        id=uuid.uuid4(),
        email_normalized="auditor@polytechnic.edu",
        password_hash=hash_password("AuditorSecure123!"),
        display_name="Auditor General",
        email_verified_at=datetime.now(UTC),
        account_status="active",
    )
    org = Organization(
        id=uuid.uuid4(),
        name="Faculty Board",
        slug="faculty-board",
        status="active",
    )
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

    # 2. Setup Election with positions and candidates
    election_id = uuid.uuid4()
    pos_id = uuid.uuid4()
    cand1_id = uuid.uuid4()
    cand2_id = uuid.uuid4()

    election = Election(
        id=election_id,
        organization_id=org.id,
        title="Dean of Academic Affairs Election 2026",
        status="closed",  # Already closed and ready for tally
        opens_at=datetime.now(UTC) - timedelta(days=2),
        closes_at=datetime.now(UTC) - timedelta(hours=1),
        timezone="UTC",
        configuration_version=1,
        configuration_hash="e"*64,
        created_by=admin.id,
    )
    position = Position(
        id=pos_id,
        election_id=election_id,
        title="Dean Position",
        min_selections=1,
        max_selections=1,
        display_order=0,
    )
    cand1 = Candidate(
        id=cand1_id,
        position_id=pos_id,
        name="Dr. Sarah Connor",
        display_order=0,
        status="active",
    )
    cand2 = Candidate(
        id=cand2_id,
        position_id=pos_id,
        name="Dr. John Smith",
        display_order=1,
        status="active",
    )
    test_election_session.add_all([election, position, cand1, cand2])
    await test_election_session.flush()

    # 3. Insert 3 Anonymous Ballots directly in ballot_db (2 for Sarah, 1 for John)
    ballot1 = Ballot(
        id=uuid.uuid4(),
        election_id=election_id,
        configuration_hash="e"*64,
        ballot_payload={
            "election_id": str(election_id),
            "selections": [
                {"position_id": str(pos_id), "candidate_ids": [str(cand1_id)], "is_abstain": False}
            ],
        },
    )
    ballot2 = Ballot(
        id=uuid.uuid4(),
        election_id=election_id,
        configuration_hash="e"*64,
        ballot_payload={
            "election_id": str(election_id),
            "selections": [
                {"position_id": str(pos_id), "candidate_ids": [str(cand1_id)], "is_abstain": False}
            ],
        },
    )
    ballot3 = Ballot(
        id=uuid.uuid4(),
        election_id=election_id,
        configuration_hash="e"*64,
        ballot_payload={
            "election_id": str(election_id),
            "selections": [
                {"position_id": str(pos_id), "candidate_ids": [str(cand2_id)], "is_abstain": False}
            ],
        },
    )
    test_ballot_session.add_all([ballot1, ballot2, ballot3])
    await test_ballot_session.commit()

    # 4. Public access before tally -> 404 (no results computed)
    unauth_resp = await test_client.get(f"/api/v1/elections/{election_id}/results")
    assert unauth_resp.status_code == 403

    # 5. Admin logs in and triggers tally
    login_resp = await test_client.post(
        "/api/v1/auth/login",
        json={"email": "auditor@polytechnic.edu", "password": "AuditorSecure123!"},
    )
    assert login_resp.status_code == 200

    tally_resp = await test_client.post(f"/api/v1/elections/{election_id}/tally")
    assert tally_resp.status_code == 200
    tally_data = tally_resp.json()["data"]
    result_id = tally_data["id"]
    assert tally_data["ballot_count"] == 3
    assert tally_data["approval_status"] == "pending"

    # Verify candidate vote distributions
    pos_res = tally_data["positions"][0]
    assert pos_res["total_votes"] == 3
    cand_map = {c["name"]: c["votes"] for c in pos_res["candidates"]}
    assert cand_map["Dr. Sarah Connor"] == 2
    assert cand_map["Dr. John Smith"] == 1
    assert pos_res["winner_ids"] == [str(cand1_id)]

    # 6. Secrecy Gate: Unauthenticated or ordinary voter still receives 403 because status is 'tallied', not yet 'published'
    test_client.cookies.clear()
    interim_resp = await test_client.get(f"/api/v1/elections/{election_id}/results")
    assert interim_resp.status_code == 403
    assert interim_resp.json()["error"]["code"] == "RESULTS_NOT_PUBLISHED"

    # 7. Publishing Gate: Re-login admin and attempt to publish without prior approval -> 409 APPROVAL_REQUIRED
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "auditor@polytechnic.edu", "password": "AuditorSecure123!"},
    )

    unapproved_pub = await test_client.post(f"/api/v1/elections/{election_id}/publish")
    assert unapproved_pub.status_code == 409
    assert unapproved_pub.json()["error"]["code"] == "APPROVAL_REQUIRED"

    # 8. Record formal managerial publication approval
    approve_resp = await test_client.post(
        f"/api/v1/elections/{election_id}/results/{result_id}/approve",
        json={"decision": "approved", "reason": "Tally verified against paper audit receipts"},
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["data"]["decision"] == "approved"

    # 9. Formally publish results
    publish_resp = await test_client.post(f"/api/v1/elections/{election_id}/publish")
    assert publish_resp.status_code == 200
    assert publish_resp.json()["data"]["published"] is True

    # 10. Public Transparency Verification: Anyone (even unauthenticated) can view published results
    test_client.cookies.clear()
    public_resp = await test_client.get(f"/api/v1/elections/{election_id}/results")
    assert public_resp.status_code == 200
    pub_data = public_resp.json()["data"]
    assert pub_data["ballot_count"] == 3
    assert pub_data["published_at"] is not None
    assert pub_data["positions"][0]["candidates"][0]["name"] == "Dr. Sarah Connor"


@pytest.mark.asyncio
async def test_voter_booth_ballot_tally_and_approval_endpoints(
    test_client: AsyncClient,
    test_identity_session: AsyncSession,
    test_election_session: AsyncSession,
    test_ballot_session: AsyncSession,
):
    # 1. Register admin & create election
    reg_res = await test_client.post(
        "/api/v1/auth/register",
        json={
            "email": "tally_voter_admin@pollwise.edu",
            "password": "Password123!",
            "display_name": "Tally Voter Admin",
        },
    )
    admin_id = uuid.UUID(reg_res.json()["data"]["id"])
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "tally_voter_admin@pollwise.edu", "password": "Password123!"},
    )

    org_id = uuid.uuid4()
    org = Organization(
        id=org_id,
        name="Student Union",
        slug="student-union",
        status="active",
    )
    membership = OrganizationMembership(
        organization_id=org_id,
        user_id=admin_id,
        role="organization_admin",
        status="active",
    )
    test_identity_session.add_all([org, membership])
    await test_identity_session.flush()
    now = datetime.now(UTC)

    create_res = await test_client.post(
        "/api/v1/elections",
        json={
            "organization_id": str(org_id),
            "title": "Voter Booth Tally Election",
            "opens_at": (now - timedelta(hours=1)).isoformat(),
            "closes_at": (now + timedelta(days=2)).isoformat(),
            "timezone": "UTC",
        },
    )
    election_id = create_res.json()["data"]["id"]

    # Configure voter auth
    await test_client.put(
        f"/api/v1/elections/{election_id}/voter-auth-config",
        json={"identifier_type": "institutional_id", "identifier_label": "Student ID"},
    )

    # Position: President
    p1_res = await test_client.post(
        f"/api/v1/elections/{election_id}/positions",
        json={"title": "President", "min_selections": 1, "max_selections": 1, "display_order": 1},
    )
    p1_id = p1_res.json()["data"]["id"]
    c1_res = await test_client.post(
        f"/api/v1/positions/{p1_id}/candidates",
        json={"name": "Alice Winner", "display_order": 1},
    )
    c1_id = c1_res.json()["data"]["id"]
    c2_res = await test_client.post(
        f"/api/v1/positions/{p1_id}/candidates",
        json={"name": "Bob Runner", "display_order": 2},
    )
    c2_id = c2_res.json()["data"]["id"]

    # Approve, Schedule, and Open election
    await test_client.post(
        f"/api/v1/elections/{election_id}/approve-launch",
        json={"decision": "approved", "reason": "Ready"},
    )
    await test_client.post(f"/api/v1/elections/{election_id}/schedule")
    await test_client.post(f"/api/v1/elections/{election_id}/open")

    # Add voter & authenticate
    await test_client.post(
        f"/api/v1/elections/{election_id}/voters",
        json={"identifier": "STU-9999", "voter_group": "Sciences"},
    )
    chal_res = await test_client.post(
        f"/api/v1/elections/{election_id}/voter-auth/request-challenge",
        json={"identifier": "STU-9999"},
    )
    chal_data = chal_res.json()["data"]
    verify_res = await test_client.post(
        f"/api/v1/elections/{election_id}/voter-auth/verify-challenge",
        json={"challenge_id": chal_data["challenge_id"], "entered_otp": chal_data["otp_code"]},
    )
    session_token = verify_res.json()["data"]["session_token"]

    # Submit ballot through voting booth endpoint
    submit_res = await test_client.post(
        f"/api/v1/elections/{election_id}/ballot/submit",
        headers={"X-Voting-Session": session_token},
        json={
            "selections": [{"position_id": p1_id, "candidate_id": c1_id, "skipped": False}],
            "idempotency_key": "idemp-test-999",
        },
    )
    assert submit_res.status_code == 200

    # Verify participation summary reflects the vote
    part_summary_res = await test_client.get(f"/api/v1/elections/{election_id}/participation-summary")
    assert part_summary_res.status_code == 200
    part_summary = part_summary_res.json()["data"]
    assert part_summary["ballots_cast"] == 1
    assert part_summary["total_eligible"] == 1
    assert part_summary["turnout_percentage"] == 100.0

    # Close election and compute tally
    close_res = await test_client.post(f"/api/v1/elections/{election_id}/close")
    assert close_res.status_code == 200

    tally_res = await test_client.post(f"/api/v1/elections/{election_id}/tally")
    assert tally_res.status_code == 200
    tally_data = tally_res.json()["data"]
    assert tally_data["ballot_count"] == 1

    # Verify candidate vote reflects the voter booth choice!
    alice_votes = next(c["votes"] for c in tally_data["positions"][0]["candidates"] if c["name"] == "Alice Winner")
    assert alice_votes == 1

    # Test approve tally without result_id in URL and with { approved: true }
    approve_res1 = await test_client.post(
        f"/api/v1/elections/{election_id}/results/approve",
        json={"approved": True},
    )
    assert approve_res1.status_code == 200
    assert approve_res1.json()["data"]["decision"] == "approved"

    # Test legacy alias route /results/elections/{id}/approve
    approve_alias = await test_client.post(
        f"/api/v1/results/elections/{election_id}/approve",
        json={"approved": True},
    )
    assert approve_alias.status_code == 200
    assert approve_alias.json()["data"]["decision"] == "approved"

    # Publish results
    pub_res = await test_client.post(f"/api/v1/elections/{election_id}/publish")
    assert pub_res.status_code == 200
    assert pub_res.json()["data"]["published"] is True


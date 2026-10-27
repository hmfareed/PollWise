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

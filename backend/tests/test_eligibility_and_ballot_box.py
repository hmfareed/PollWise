import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.ballot import Ballot
from app.models.election import Candidate, Election, Position
from app.models.identity import (
    Organization,
    OrganizationMembership,
    User,
)


@pytest.mark.asyncio
async def test_full_eligibility_and_ballot_box_lifecycle(
    test_client: AsyncClient,
    test_identity_session: AsyncSession,
    test_election_session: AsyncSession,
    test_ballot_session: AsyncSession,
):
    # 1. Setup Admin, Voter 1 (verified), and Voter 2 (unverified)
    admin = User(
        id=uuid.uuid4(),
        email_normalized="manager@polytechnic.edu",
        password_hash=hash_password("ManagerSecure123!"),
        display_name="Election Manager",
        email_verified_at=datetime.now(UTC),
        account_status="active",
    )
    voter1 = User(
        id=uuid.uuid4(),
        email_normalized="alice.voter@polytechnic.edu",
        password_hash=hash_password("AliceSecure123!"),
        display_name="Alice Voter",
        email_verified_at=datetime.now(UTC),
        account_status="active",
    )
    voter2_unverified = User(
        id=uuid.uuid4(),
        email_normalized="bob.unverified@polytechnic.edu",
        password_hash=hash_password("BobSecure123!"),
        display_name="Bob Unverified",
        email_verified_at=None,
        account_status="active",
    )
    org = Organization(
        id=uuid.uuid4(),
        name="Faculty of Engineering",
        slug="faculty-eng",
        status="active",
    )
    test_identity_session.add_all([admin, voter1, voter2_unverified, org])
    await test_identity_session.flush()

    membership = OrganizationMembership(
        organization_id=org.id,
        user_id=admin.id,
        role="election_manager",
        status="active",
    )
    test_identity_session.add(membership)
    await test_identity_session.flush()

    # 2. Setup Election in 'open' status with frozen configuration
    election_id = uuid.uuid4()
    pos_id = uuid.uuid4()
    cand1_id = uuid.uuid4()
    cand2_id = uuid.uuid4()

    election = Election(
        id=election_id,
        organization_id=org.id,
        title="Engineering Council 2026",
        status="open",
        opens_at=datetime.now(UTC) - timedelta(hours=1),
        closes_at=datetime.now(UTC) + timedelta(days=2),
        timezone="UTC",
        configuration_version=1,
        configuration_hash="a"*64,
        created_by=admin.id,
    )
    position = Position(
        id=pos_id,
        election_id=election_id,
        title="Department Representative",
        min_selections=1,
        max_selections=1,
        display_order=0,
    )
    cand1 = Candidate(
        id=cand1_id,
        position_id=pos_id,
        name="Candidate Alpha",
        display_order=0,
        status="active",
    )
    cand2 = Candidate(
        id=cand2_id,
        position_id=pos_id,
        name="Candidate Beta",
        display_order=1,
        status="active",
    )
    test_election_session.add_all([election, position, cand1, cand2])
    await test_election_session.flush()

    # 3. Manager logs in and adds Alice to eligibility roll
    login_resp = await test_client.post(
        "/api/v1/auth/login",
        json={"email": "manager@polytechnic.edu", "password": "ManagerSecure123!"},
    )
    assert login_resp.status_code == 200

    add_elig_resp = await test_client.post(
        f"/api/v1/elections/{election_id}/eligibility",
        json={"email": "alice.voter@polytechnic.edu"},
    )
    assert add_elig_resp.status_code == 201
    assert add_elig_resp.json()["data"]["eligibility_status"] == "eligible"
    assert add_elig_resp.json()["data"]["entitlement_status"] == "unused"

    # Also test bulk import endpoint
    bulk_resp = await test_client.post(
        f"/api/v1/elections/{election_id}/eligibility/import",
        json={"emails": ["alice.voter@polytechnic.edu", "bob.unverified@polytechnic.edu", "unknown@test.com"]},
    )
    assert bulk_resp.status_code == 200
    assert bulk_resp.json()["data"]["added"] == 1  # Bob added
    assert bulk_resp.json()["data"]["already_eligible"] == 1  # Alice already eligible
    assert bulk_resp.json()["data"]["not_found"] == ["unknown@test.com"]

    # 4. Bob (unverified email) tries to obtain voting credential -> 403 EMAIL_NOT_VERIFIED
    login_bob = await test_client.post(
        "/api/v1/auth/login",
        json={"email": "bob.unverified@polytechnic.edu", "password": "BobSecure123!"},
    )
    assert login_bob.status_code == 200

    cred_bob = await test_client.post(f"/api/v1/elections/{election_id}/voting-credential")
    assert cred_bob.status_code == 403
    assert cred_bob.json()["error"]["code"] == "EMAIL_NOT_VERIFIED"

    # 5. Alice logs in and obtains single-use credential
    login_alice = await test_client.post(
        "/api/v1/auth/login",
        json={"email": "alice.voter@polytechnic.edu", "password": "AliceSecure123!"},
    )
    assert login_alice.status_code == 200

    cred_alice = await test_client.post(f"/api/v1/elections/{election_id}/voting-credential")
    assert cred_alice.status_code == 200
    credential_token = cred_alice.json()["data"]["credential"]
    assert credential_token is not None
    assert len(credential_token) > 30

    # Attempting to request a second credential fails with 409 CREDENTIAL_ALREADY_ISSUED
    cred_alice_retry = await test_client.post(f"/api/v1/elections/{election_id}/voting-credential")
    assert cred_alice_retry.status_code == 409
    assert cred_alice_retry.json()["error"]["code"] == "CREDENTIAL_ALREADY_ISSUED"

    # 6. Ballot-Box Hygiene & Boundary Enforcement
    # 6a. Rejection if request carries session cookie (credentials not omitted)
    ballot_with_cookie = await test_client.post(
        "/ballot-box/v1/ballots",
        json={
            "election_id": str(election_id),
            "credential": credential_token,
            "selections": [
                {"position_id": str(pos_id), "candidate_ids": [str(cand1_id)], "is_abstain": False}
            ],
        },
    )
    # Since test_client holds the cookie from Alice's login, it must be rejected!
    assert ballot_with_cookie.status_code == 422
    assert ballot_with_cookie.json()["error"]["code"] == "IDENTITY_FIELD_REJECTED"

    # 6b. Clean ballot client (no cookies, mimicking credentials: 'omit')
    test_client.cookies.clear()

    # 6c. Rejection if voter identity fields are embedded in the body
    identity_in_body = await test_client.post(
        "/ballot-box/v1/ballots",
        json={
            "election_id": str(election_id),
            "credential": credential_token,
            "voter_id": str(voter1.id),
            "selections": [
                {"position_id": str(pos_id), "candidate_ids": [str(cand1_id)], "is_abstain": False}
            ],
        },
    )
    assert identity_in_body.status_code == 422

    # 6d. Rejection if credential has invalid signature
    fake_token = "invalid.signature.token"
    invalid_cred = await test_client.post(
        "/ballot-box/v1/ballots",
        json={
            "election_id": str(election_id),
            "credential": fake_token,
            "selections": [
                {"position_id": str(pos_id), "candidate_ids": [str(cand1_id)], "is_abstain": False}
            ],
        },
    )
    assert invalid_cred.status_code == 401
    assert invalid_cred.json()["error"]["code"] == "CREDENTIAL_INVALID"

    # 7. Successful Anonymous Ballot Submission
    valid_submission = await test_client.post(
        "/ballot-box/v1/ballots",
        json={
            "election_id": str(election_id),
            "credential": credential_token,
            "selections": [
                {"position_id": str(pos_id), "candidate_ids": [str(cand1_id)], "is_abstain": False}
            ],
        },
    )
    assert valid_submission.status_code == 201
    ballot_data = valid_submission.json()["data"]
    assert ballot_data["status"] == "accepted"
    receipt_ref = ballot_data["receipt_reference"]
    assert receipt_ref.startswith("PW-")

    # 8. Replay Attack Prevention: Attempting to submit the same credential again fails!
    duplicate_submission = await test_client.post(
        "/ballot-box/v1/ballots",
        json={
            "election_id": str(election_id),
            "credential": credential_token,
            "selections": [
                {"position_id": str(pos_id), "candidate_ids": [str(cand2_id)], "is_abstain": False}
            ],
        },
    )
    assert duplicate_submission.status_code == 409
    assert duplicate_submission.json()["error"]["code"] == "BALLOT_ALREADY_ACCEPTED"

    # 9. Verify Ballot-Box DB Isolation: Zero voter identity fields in `ballots` table
    ballots_stmt = select(Ballot)
    ballots = (await test_ballot_session.execute(ballots_stmt)).scalars().all()
    assert len(ballots) == 1
    stored_ballot = ballots[0]
    assert not hasattr(stored_ballot, "user_id")
    assert not hasattr(stored_ballot, "voter_id")
    assert not hasattr(stored_ballot, "email")
    assert "user_id" not in stored_ballot.ballot_payload
    assert "email" not in stored_ballot.ballot_payload

    # 10. Confirmation of Redemption to Identity DB
    # Re-login Alice and confirm receipt
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "alice.voter@polytechnic.edu", "password": "AliceSecure123!"},
    )
    confirm_resp = await test_client.post(
        f"/api/v1/elections/{election_id}/confirm-redemption",
        json={"receipt_reference": receipt_ref},
    )
    assert confirm_resp.status_code == 200

    participation_resp = await test_client.get(f"/api/v1/elections/{election_id}/participation/me")
    assert participation_resp.status_code == 200
    part_data = participation_resp.json()["data"]
    assert part_data["is_eligible"] is True
    assert part_data["entitlement_status"] == "redeemed"
    assert part_data["has_voted"] is True

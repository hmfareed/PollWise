import uuid
from datetime import UTC, datetime, timedelta
import pytest
from httpx import AsyncClient
from sqlalchemy import text
from app.db.session import ballot_session_maker


@pytest.mark.asyncio
async def test_ballot_draft_and_atomic_submission(test_client: AsyncClient, test_ballot_session):
    # 1. Setup Admin, Organization, Election
    await test_client.post(
        "/api/v1/auth/register",
        json={
            "email": "ballot_admin@pollwise.edu",
            "password": "Password123!",
            "display_name": "Ballot Admin",
        },
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "ballot_admin@pollwise.edu", "password": "Password123!"},
    )

    org_id = uuid.uuid4()
    now = datetime.now(UTC)

    create_res = await test_client.post(
        "/api/v1/elections",
        json={
            "organization_id": str(org_id),
            "title": "2026 General Student Election",
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

    # Position 1: President
    p1_res = await test_client.post(
        f"/api/v1/elections/{election_id}/positions",
        json={"title": "President", "min_selections": 1, "max_selections": 1, "display_order": 1},
    )
    p1_id = p1_res.json()["data"]["id"]
    c1_res = await test_client.post(
        f"/api/v1/positions/{p1_id}/candidates",
        json={"name": "Sarah Connor", "display_order": 1},
    )
    c1_id = c1_res.json()["data"]["id"]

    # Position 2: Treasurer (Optional, can be skipped)
    p2_res = await test_client.post(
        f"/api/v1/elections/{election_id}/positions",
        json={"title": "Treasurer", "min_selections": 0, "max_selections": 1, "display_order": 2},
    )
    p2_id = p2_res.json()["data"]["id"]
    c2_res = await test_client.post(
        f"/api/v1/positions/{p2_id}/candidates",
        json={"name": "John Connor", "display_order": 1},
    )
    c2_id = c2_res.json()["data"]["id"]

    # Approve, Schedule, and Open election
    await test_client.post(
        f"/api/v1/elections/{election_id}/approve-launch",
        json={"decision": "approved", "reason": "Ready for election"},
    )
    await test_client.post(f"/api/v1/elections/{election_id}/schedule")
    open_res = await test_client.post(f"/api/v1/elections/{election_id}/open")
    assert open_res.status_code == 200

    # Add Eligible Voter
    await test_client.post(
        f"/api/v1/elections/{election_id}/voters",
        json={"identifier": "STU-1001", "voter_group": "Sciences"},
    )

    # 2. Voter Authenticates
    chal_res = await test_client.post(
        f"/api/v1/elections/{election_id}/voter-auth/request-challenge",
        json={"identifier": "STU-1001"},
    )
    chal_data = chal_res.json()["data"]
    
    verify_res = await test_client.post(
        f"/api/v1/elections/{election_id}/voter-auth/verify-challenge",
        json={"challenge_id": chal_data["challenge_id"], "entered_otp": chal_data["otp_code"]},
    )
    session_token = verify_res.json()["data"]["session_token"]
    auth_header = {"X-Voting-Session": session_token}

    # 3. GET Ballot
    ballot_res = await test_client.get(
        f"/api/v1/elections/{election_id}/ballot",
        headers=auth_header,
    )
    assert ballot_res.status_code == 200
    b_data = ballot_res.json()["data"]
    positions = b_data["positions"]
    assert len(positions) == 2
    assert positions[0]["id"] == p1_id
    assert positions[1]["id"] == p2_id

    # 4. Save Draft
    draft_payload = {
        "selections": [
            {"position_id": p1_id, "candidate_id": c1_id, "skipped": False},
            {"position_id": p2_id, "candidate_id": None, "skipped": True},
        ]
    }
    draft_res = await test_client.put(
        f"/api/v1/elections/{election_id}/ballot/draft",
        headers=auth_header,
        json=draft_payload,
    )
    assert draft_res.status_code == 200

    # 5. Submit Ballot (Atomic submission)
    submit_res = await test_client.post(
        f"/api/v1/elections/{election_id}/ballot/submit",
        headers=auth_header,
        json={
            "selections": draft_payload["selections"],
            "idempotency_key": "idemp-001",
        },
    )
    assert submit_res.status_code == 200
    receipt = submit_res.json()["data"]
    assert "confirmation_reference" in receipt
    assert receipt["confirmation_reference"].startswith("PW-")
    conf_ref = receipt["confirmation_reference"]

    # 6. Idempotency Retry returns same receipt
    retry_res = await test_client.post(
        f"/api/v1/elections/{election_id}/ballot/submit",
        headers=auth_header,
        json={
            "selections": draft_payload["selections"],
            "idempotency_key": "idemp-001",
        },
    )
    assert retry_res.status_code == 200
    assert retry_res.json()["data"]["confirmation_reference"] == conf_ref

    # 7. Duplicate voting prevention: voter requests challenge again -> 409
    dup_chal = await test_client.post(
        f"/api/v1/elections/{election_id}/voter-auth/request-challenge",
        json={"identifier": "STU-1001"},
    )
    assert dup_chal.status_code == 409
    assert "ALREADY_SUBMITTED" in str(dup_chal.json()).upper()

    # 8. Secret Ballot Invariant Check in ballot_db
    res = await test_ballot_session.execute(text("SELECT * FROM ballots"))
    rows = res.fetchall()
    assert len(rows) == 1
    b_row = rows[0]
    # Verify no voter identity in ballot row
    row_str = str(b_row).lower()
    assert "stu-1001" not in row_str
    assert "voter_record" not in row_str

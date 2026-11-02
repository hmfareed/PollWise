import uuid
from datetime import UTC, datetime, timedelta
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_voter_authentication_and_on_screen_otp_flow(test_client: AsyncClient):
    # 1. Setup Admin, Organization and Election
    await test_client.post(
        "/api/v1/auth/register",
        json={
            "email": "auth_admin@pollwise.edu",
            "password": "Password123!",
            "display_name": "Auth Admin",
        },
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "auth_admin@pollwise.edu", "password": "Password123!"},
    )

    org_id = uuid.uuid4()
    now = datetime.now(UTC)
    opens_at = (now - timedelta(hours=1)).isoformat()
    closes_at = (now + timedelta(days=2)).isoformat()

    create_res = await test_client.post(
        "/api/v1/elections",
        json={
            "organization_id": str(org_id),
            "title": "2026 Student Union Election",
            "opens_at": opens_at,
            "closes_at": closes_at,
            "timezone": "UTC",
        },
    )
    election_id = create_res.json()["data"]["id"]

    # Configure voter auth with Institutional ID
    await test_client.put(
        f"/api/v1/elections/{election_id}/voter-auth-config",
        json={"identifier_type": "institutional_id", "identifier_label": "Student ID"},
    )

    # Add Position and Candidate
    pos_res = await test_client.post(
        f"/api/v1/elections/{election_id}/positions",
        json={"title": "President", "min_selections": 1, "max_selections": 1},
    )
    pos_id = pos_res.json()["data"]["id"]
    await test_client.post(
        f"/api/v1/positions/{pos_id}/candidates",
        json={"name": "Alice Walker"},
    )

    # Approve, Schedule, and Open election
    await test_client.post(
        f"/api/v1/elections/{election_id}/approve-launch",
        json={"decision": "approved", "reason": "Approved for voting"},
    )
    await test_client.post(f"/api/v1/elections/{election_id}/schedule")
    open_res = await test_client.post(f"/api/v1/elections/{election_id}/open")
    assert open_res.status_code == 200

    # Add an eligible voter to the roll
    await test_client.post(
        f"/api/v1/elections/{election_id}/voters",
        json={"identifier": "STU-9999", "voter_group": "Sciences"},
    )

    # 2. Public Voter Auth: Request challenge for unknown identifier -> 403
    unkn_res = await test_client.post(
        f"/api/v1/elections/{election_id}/voter-auth/request-challenge",
        json={"identifier": "UNKNOWN-ID"},
    )
    assert unkn_res.status_code == 403

    # 3. Request challenge for eligible identifier -> returns 6-digit OTP directly
    chal_res = await test_client.post(
        f"/api/v1/elections/{election_id}/voter-auth/request-challenge",
        json={"identifier": "STU-9999"},
    )
    assert chal_res.status_code == 200
    chal_data = chal_res.json()["data"]
    assert "challenge_id" in chal_data
    assert "otp_code" in chal_data
    otp_code = chal_data["otp_code"]
    challenge_id = chal_data["challenge_id"]
    assert len(otp_code) == 6
    assert otp_code.isdigit()
    assert chal_data["identifier_label"] == "Student ID"

    # 4. Verify with wrong OTP -> 400
    bad_verify = await test_client.post(
        f"/api/v1/elections/{election_id}/voter-auth/verify-challenge",
        json={"challenge_id": challenge_id, "entered_otp": "000000"},
    )
    assert bad_verify.status_code == 400

    # 5. Verify with correct OTP -> 200 & session token
    ok_verify = await test_client.post(
        f"/api/v1/elections/{election_id}/voter-auth/verify-challenge",
        json={"challenge_id": challenge_id, "entered_otp": otp_code},
    )
    assert ok_verify.status_code == 200
    sess_data = ok_verify.json()["data"]
    assert "session_token" in sess_data
    assert sess_data["status"] == "active"
    session_token = sess_data["session_token"]

    # 6. Attempting to reuse consumed challenge -> 400
    reuse_res = await test_client.post(
        f"/api/v1/elections/{election_id}/voter-auth/verify-challenge",
        json={"challenge_id": challenge_id, "entered_otp": otp_code},
    )
    assert reuse_res.status_code == 400
    assert "already been used" in str(reuse_res.json()).lower() or "already_used" in str(reuse_res.json()).lower()

    # 7. End session
    end_res = await test_client.post(
        f"/api/v1/elections/{election_id}/voter-auth/end-session",
        headers={"X-Voting-Session": session_token},
    )
    assert end_res.status_code == 200

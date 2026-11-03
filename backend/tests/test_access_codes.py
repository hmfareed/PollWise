import uuid
from datetime import UTC, datetime, timedelta
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_access_code_full_lifecycle(test_client: AsyncClient):
    # 1. Register & Login Admin
    admin_email = f"admin_{uuid.uuid4().hex[:6]}@pollwise.edu"
    await test_client.post(
        "/api/v1/auth/register",
        json={"email": admin_email, "password": "Password123!", "display_name": "Slip Admin"},
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": admin_email, "password": "Password123!"},
    )

    org_id = uuid.uuid4()
    now = datetime.now(UTC)
    opens_at = (now - timedelta(hours=1)).isoformat()
    closes_at = (now + timedelta(days=2)).isoformat()

    # Create election
    create_res = await test_client.post(
        "/api/v1/elections",
        json={
            "organization_id": str(org_id),
            "title": "Faculty Representative Election",
            "opens_at": opens_at,
            "closes_at": closes_at,
            "timezone": "UTC",
        },
    )
    election_id = create_res.json()["data"]["id"]

    # Add position and candidate
    pos_res = await test_client.post(
        f"/api/v1/elections/{election_id}/positions",
        json={"title": "Faculty Rep", "min_selections": 1, "max_selections": 1},
    )
    pos_id = pos_res.json()["data"]["id"]
    cand_res = await test_client.post(
        f"/api/v1/positions/{pos_id}/candidates",
        json={"name": "Sarah Connor"},
    )
    cand_id = cand_res.json()["data"]["id"]

    # Launch & open election
    await test_client.post(
        f"/api/v1/elections/{election_id}/approve-launch",
        json={"decision": "approved", "reason": "Ready"},
    )
    await test_client.post(f"/api/v1/elections/{election_id}/schedule")
    await test_client.post(f"/api/v1/elections/{election_id}/open")

    # 2. Admin Generates Access Codes (10 codes)
    gen_res = await test_client.post(
        f"/api/v1/elections/{election_id}/access-codes/generate",
        json={"count": 10},
    )
    assert gen_res.status_code == 200
    gen_data = gen_res.json()["data"]
    assert gen_data["total_count"] == 10
    assert gen_data["unused_count"] == 10
    assert gen_data["used_count"] == 0
    assert len(gen_data["items"]) == 10

    code1 = gen_data["items"][0]["code"]
    code2 = gen_data["items"][1]["code"]
    assert code1.startswith("PW-")
    assert code2.startswith("PW-")
    assert code1 != code2

    # 3. List access codes via Admin endpoint
    list_res = await test_client.get(f"/api/v1/elections/{election_id}/access-codes")
    assert list_res.status_code == 200
    assert list_res.json()["data"]["total_count"] == 10

    # 4. Export CSV
    export_res = await test_client.get(f"/api/v1/elections/{election_id}/access-codes/export")
    assert export_res.status_code == 200
    assert "Access Code,Status,Used By Student ID,Used At,Created At" in export_res.text
    assert code1 in export_res.text

    # 5. Voter Verifies code1
    verify_res = await test_client.post(
        f"/api/v1/elections/{election_id}/access-codes/verify",
        json={"code": code1},
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["data"]["valid"] is True
    assert verify_res.json()["data"]["code"] == code1

    # Verify also handles lowercase / missing hyphens
    flexible_code = code1.replace("-", "").lower()
    flex_res = await test_client.post(
        f"/api/v1/elections/{election_id}/access-codes/verify",
        json={"code": flexible_code},
    )
    assert flex_res.status_code == 200
    assert flex_res.json()["data"]["code"] == code1

    # Invalid code
    bad_verify = await test_client.post(
        f"/api/v1/elections/{election_id}/access-codes/verify",
        json={"code": "PW-INVALID-CODE"},
    )
    assert bad_verify.status_code == 400

    # 6. Voter Claims code1 with Student ID "STU-1001"
    claim_res = await test_client.post(
        f"/api/v1/elections/{election_id}/access-codes/claim",
        json={"code": code1, "student_id": "STU-1001"},
    )
    assert claim_res.status_code == 200
    session_token = claim_res.json()["data"]["session_token"]
    assert session_token is not None

    # 7. Voter retrieves ballot structure
    ballot_struct = await test_client.get(
        f"/api/v1/elections/{election_id}/ballot",
        headers={"X-Voting-Session": session_token},
    )
    assert ballot_struct.status_code == 200
    assert len(ballot_struct.json()["data"]["positions"]) == 1

    # 8. Voter submits ballot
    idempotency_key = str(uuid.uuid4())
    sub_res = await test_client.post(
        f"/api/v1/elections/{election_id}/ballot/submit",
        headers={"X-Voting-Session": session_token},
        json={
            "selections": [{"position_id": pos_id, "candidate_id": cand_id, "skipped": False}],
            "idempotency_key": idempotency_key,
        },
    )
    assert sub_res.status_code == 200
    assert sub_res.json()["data"]["status"] == "accepted"

    # 9. Verify Invalidation 1: code1 is now used and expired
    reuse_code_verify = await test_client.post(
        f"/api/v1/elections/{election_id}/access-codes/verify",
        json={"code": code1},
    )
    assert reuse_code_verify.status_code == 400
    assert "already been used" in reuse_code_verify.json()["error"]["message"].lower()

    # 10. Verify Invalidation 2: STU-1001 cannot vote again even with fresh code2
    reuse_stu_claim = await test_client.post(
        f"/api/v1/elections/{election_id}/access-codes/claim",
        json={"code": code2, "student_id": "STU-1001"},
    )
    assert reuse_stu_claim.status_code == 409
    assert "already voted" in reuse_stu_claim.json()["error"]["message"].lower()

    # 11. Fresh student "STU-2002" CAN use fresh code2
    fresh_stu_claim = await test_client.post(
        f"/api/v1/elections/{election_id}/access-codes/claim",
        json={"code": code2, "student_id": "STU-2002"},
    )
    assert fresh_stu_claim.status_code == 200
    assert fresh_stu_claim.json()["data"]["session_token"] is not None

    # 12. Check updated counts in Admin list
    list_res_after = await test_client.get(f"/api/v1/elections/{election_id}/access-codes")
    data_after = list_res_after.json()["data"]
    assert data_after["total_count"] == 10
    assert data_after["used_count"] == 1
    assert data_after["unused_count"] == 9

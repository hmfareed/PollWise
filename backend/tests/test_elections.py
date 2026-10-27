import uuid
from datetime import UTC, datetime, timedelta

import pytest


@pytest.mark.asyncio
async def test_full_election_lifecycle_and_configuration_locking(test_client):
    # 1. Register & Login Administrator
    await test_client.post(
        "/api/v1/auth/register",
        json={
            "email": "admin@pollwise.edu",
            "password": "Password123!",
            "display_name": "Admin User",
        },
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@pollwise.edu", "password": "Password123!"},
    )

    org_id = uuid.uuid4()
    now = datetime.now(UTC)
    opens_at = (now + timedelta(days=1)).isoformat()
    closes_at = (now + timedelta(days=7)).isoformat()

    # 2. Create Draft Election
    res_create = await test_client.post(
        "/api/v1/elections",
        json={
            "organization_id": str(org_id),
            "title": "2026 Student Senate Election",
            "description": "Annual elections for student leadership positions",
            "opens_at": opens_at,
            "closes_at": closes_at,
            "timezone": "UTC",
        },
    )
    assert res_create.status_code == 201
    election = res_create.json()["data"]
    election_id = election["id"]
    assert election["status"] == "draft"
    assert election["configuration_hash"] is None

    # 3. Add Position 1: President
    res_pos1 = await test_client.post(
        f"/api/v1/elections/{election_id}/positions",
        json={
            "title": "President",
            "description": "Student Union President",
            "max_selections": 1,
            "min_selections": 1,
            "display_order": 1,
        },
    )
    assert res_pos1.status_code == 201
    pos1_id = res_pos1.json()["data"]["id"]

    # 4. Add Candidate for Position 1
    res_c1 = await test_client.post(
        f"/api/v1/positions/{pos1_id}/candidates",
        json={
            "name": "Alice Walker",
            "biography": "Platform for accessible tuition",
            "display_order": 1,
        },
    )
    assert res_c1.status_code == 201

    # 5. Add Position 2: Vice President
    res_pos2 = await test_client.post(
        f"/api/v1/elections/{election_id}/positions",
        json={
            "title": "Vice President",
            "max_selections": 1,
            "min_selections": 1,
            "display_order": 2,
        },
    )
    assert res_pos2.status_code == 201
    pos2_id = res_pos2.json()["data"]["id"]

    # Attempt to schedule without candidates in Position 2 -> Fails validation
    res_sched_fail1 = await test_client.post(f"/api/v1/elections/{election_id}/schedule")
    assert res_sched_fail1.status_code == 422
    assert "no active candidates" in res_sched_fail1.json()["error"]["message"]

    # Add Candidate for Position 2
    res_c2 = await test_client.post(
        f"/api/v1/positions/{pos2_id}/candidates",
        json={"name": "Bob Martinez", "display_order": 1},
    )
    assert res_c2.status_code == 201

    # Attempt to schedule without launch approval -> Fails with APPROVAL_REQUIRED (409)
    res_sched_fail2 = await test_client.post(f"/api/v1/elections/{election_id}/schedule")
    assert res_sched_fail2.status_code == 409
    assert res_sched_fail2.json()["error"]["code"] == "APPROVAL_REQUIRED"

    # 6. Record Launch Approval
    res_app = await test_client.post(
        f"/api/v1/elections/{election_id}/approve-launch",
        json={"decision": "approved", "reason": "Ballot approved by election committee"},
    )
    assert res_app.status_code == 200
    assert res_app.json()["data"]["decision"] == "approved"

    # 7. Schedule Election (Locks configuration and computes hash)
    res_sched = await test_client.post(f"/api/v1/elections/{election_id}/schedule")
    assert res_sched.status_code == 200
    scheduled_election = res_sched.json()["data"]
    assert scheduled_election["status"] == "scheduled"
    assert scheduled_election["configuration_hash"] is not None
    config_hash = scheduled_election["configuration_hash"]
    assert len(config_hash) == 64

    # 8. Verify Configuration Locking (Gate M3 constraint)
    # Attempting to add a new candidate in scheduled state MUST fail with CONFIG_LOCKED (409)
    res_lock_check = await test_client.post(
        f"/api/v1/positions/{pos1_id}/candidates",
        json={"name": "Late Candidate", "display_order": 99},
    )
    assert res_lock_check.status_code == 409
    assert res_lock_check.json()["error"]["code"] == "CONFIG_LOCKED"

    # 9. Open Election
    res_open = await test_client.post(f"/api/v1/elections/{election_id}/open")
    assert res_open.status_code == 200
    assert res_open.json()["data"]["status"] == "open"
    assert res_open.json()["data"]["configuration_hash"] == config_hash

    # 10. Close Election
    res_close = await test_client.post(f"/api/v1/elections/{election_id}/close")
    assert res_close.status_code == 200
    assert res_close.json()["data"]["status"] == "closed"

    # 11. Verify Audit Event Trail
    res_audit = await test_client.get(f"/api/v1/elections/{election_id}/audit")
    assert res_audit.status_code == 200
    audit_events = res_audit.json()["data"]
    event_types = [ev["event_type"] for ev in audit_events]
    assert "ELECTION_CREATED" in event_types
    assert "POSITION_ADDED" in event_types
    assert "CANDIDATE_ADDED" in event_types
    assert "ELECTION_LAUNCH_APPROVAL_RECORDED" in event_types
    assert "ELECTION_SCHEDULED" in event_types
    assert "ELECTION_OPENED" in event_types
    assert "ELECTION_CLOSED" in event_types

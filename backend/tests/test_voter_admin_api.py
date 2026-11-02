import uuid
from datetime import UTC, datetime, timedelta
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_voter_auth_config_crud_and_lock(test_client: AsyncClient):
    # 1. Register & Login Administrator
    await test_client.post(
        "/api/v1/auth/register",
        json={
            "email": "voter_admin@pollwise.edu",
            "password": "Password123!",
            "display_name": "Voter Admin",
        },
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "voter_admin@pollwise.edu", "password": "Password123!"},
    )

    org_id = uuid.uuid4()
    now = datetime.now(UTC)

    # 2. Create Election
    create_res = await test_client.post(
        "/api/v1/elections",
        json={
            "organization_id": str(org_id),
            "title": "2026 Campus Election",
            "description": "Student Government elections",
            "opens_at": (now + timedelta(days=1)).isoformat(),
            "closes_at": (now + timedelta(days=7)).isoformat(),
            "timezone": "UTC",
        },
    )
    assert create_res.status_code == 201
    election_id = create_res.json()["data"]["id"]

    # 3. GET default auth config
    get_res = await test_client.get(f"/api/v1/elections/{election_id}/voter-auth-config")
    assert get_res.status_code == 200
    cfg = get_res.json()["data"]
    assert cfg["identifier_type"] == "institutional_email"
    assert cfg["otp_length"] == 6

    # 4. PUT updated auth config
    put_res = await test_client.put(
        f"/api/v1/elections/{election_id}/voter-auth-config",
        json={
            "identifier_type": "institutional_id",
            "identifier_label": "Student ID",
            "allow_position_skip": False,
        },
    )
    assert put_res.status_code == 200
    updated_cfg = put_res.json()["data"]
    assert updated_cfg["identifier_type"] == "institutional_id"
    assert updated_cfg["identifier_label"] == "Student ID"
    assert updated_cfg["allow_position_skip"] is False

    # 5. Lock config
    lock_res = await test_client.post(f"/api/v1/elections/{election_id}/voter-auth-config/lock")
    assert lock_res.status_code == 200
    assert lock_res.json()["data"]["configuration_locked_at"] is not None

    # 6. Attempt update after lock -> 400
    fail_put = await test_client.put(
        f"/api/v1/elections/{election_id}/voter-auth-config",
        json={"identifier_type": "institutional_email"},
    )
    assert fail_put.status_code == 400


@pytest.mark.asyncio
async def test_voter_roll_csv_preview_and_import(test_client: AsyncClient):
    # Register & Login
    await test_client.post(
        "/api/v1/auth/register",
        json={
            "email": "roster_admin@pollwise.edu",
            "password": "Password123!",
            "display_name": "Roster Admin",
        },
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "roster_admin@pollwise.edu", "password": "Password123!"},
    )

    org_id = uuid.uuid4()
    now = datetime.now(UTC)

    create_res = await test_client.post(
        "/api/v1/elections",
        json={
            "organization_id": str(org_id),
            "title": "Faculty Election",
            "opens_at": (now + timedelta(days=1)).isoformat(),
            "closes_at": (now + timedelta(days=7)).isoformat(),
            "timezone": "UTC",
        },
    )
    election_id = create_res.json()["data"]["id"]

    # Preview CSV
    csv_content = "identifier,voter_group\nprof_a@pollwise.edu,Science\nprof_b@pollwise.edu,Arts\nprof_a@pollwise.edu,Duplicate\ninvalid-email,None\n"
    files = {"file": ("voters.csv", csv_content.encode("utf-8"), "text/csv")}
    
    prev_res = await test_client.post(
        f"/api/v1/elections/{election_id}/voters/preview",
        files=files,
    )
    assert prev_res.status_code == 200
    report = prev_res.json()["data"]
    assert report["valid_count"] == 2
    assert report["duplicate_count"] == 1
    assert report["invalid_count"] == 1

    # Import CSV
    files_import = {"file": ("voters.csv", csv_content.encode("utf-8"), "text/csv")}
    imp_res = await test_client.post(
        f"/api/v1/elections/{election_id}/voters/import",
        files=files_import,
    )
    assert imp_res.status_code == 200
    assert imp_res.json()["data"]["imported_count"] == 2

    # List voters
    list_res = await test_client.get(f"/api/v1/elections/{election_id}/voters")
    assert list_res.status_code == 200
    voters = list_res.json()["data"]
    assert len(voters) == 2

    # Manually add single voter
    manual_res = await test_client.post(
        f"/api/v1/elections/{election_id}/voters",
        json={"identifier": "prof_c@pollwise.edu", "voter_group": "Law"},
    )
    assert manual_res.status_code == 201
    voter_id = manual_res.json()["data"]["id"]

    # Delete voter
    del_res = await test_client.delete(f"/api/v1/elections/{election_id}/voters/{voter_id}")
    assert del_res.status_code == 200

import uuid
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_voting_centre_and_terminal_lifecycle(test_client: AsyncClient):
    # 1. Register & Login Administrator
    await test_client.post(
        "/api/v1/auth/register",
        json={
            "email": "centre_admin@pollwise.edu",
            "password": "Password123!",
            "display_name": "Centre Admin",
        },
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "centre_admin@pollwise.edu", "password": "Password123!"},
    )

    institution_id = uuid.uuid4()

    # 2. Create voting centre
    c_resp = await test_client.post(
        "/api/v1/voting-centres",
        json={
            "institution_id": str(institution_id),
            "name": "Main Library Hub",
            "location_description": "First Floor East Wing",
        },
    )
    assert c_resp.status_code == 201
    centre_data = c_resp.json()["data"]
    centre_id = centre_data["id"]
    assert centre_data["name"] == "Main Library Hub"

    # 3. List centres
    list_resp = await test_client.get(f"/api/v1/voting-centres?institution_id={institution_id}")
    assert list_resp.status_code == 200
    assert len(list_resp.json()["data"]) == 1

    # 4. Register Terminal
    t_resp = await test_client.post(
        f"/api/v1/voting-centres/{centre_id}/terminals",
        json={"terminal_name": "Terminal 01"},
    )
    assert t_resp.status_code == 201
    term_data = t_resp.json()["data"]
    assert "token" in term_data
    terminal_id = term_data["id"]
    terminal_token = term_data["token"]
    assert term_data["terminal_status"] == "idle"

    # 5. Heartbeat without token -> 401
    bad_hb = await test_client.post(
        f"/api/v1/voting-terminals/{terminal_id}/heartbeat",
        json={"current_status": "idle"},
    )
    assert bad_hb.status_code == 401

    # 6. Heartbeat with valid token -> 200 & command "none"
    ok_hb = await test_client.post(
        f"/api/v1/voting-terminals/{terminal_id}/heartbeat",
        headers={"X-Terminal-Token": terminal_token},
        json={"current_status": "voting"},
    )
    assert ok_hb.status_code == 200
    assert ok_hb.json()["data"]["command"] == "none"

    # 7. Supervisor triggers reset
    reset_resp = await test_client.post(f"/api/v1/voting-terminals/{terminal_id}/reset")
    assert reset_resp.status_code == 200

    # 8. Next heartbeat receives command "reset"
    reset_hb = await test_client.post(
        f"/api/v1/voting-terminals/{terminal_id}/heartbeat",
        headers={"X-Terminal-Token": terminal_token},
        json={"current_status": "voting"},
    )
    assert reset_hb.status_code == 200
    assert reset_hb.json()["data"]["command"] == "reset"

    # 9. Terminal reports reset complete (idle) -> command resets to "none"
    idle_hb = await test_client.post(
        f"/api/v1/voting-terminals/{terminal_id}/heartbeat",
        headers={"X-Terminal-Token": terminal_token},
        json={"current_status": "idle"},
    )
    assert idle_hb.status_code == 200
    assert idle_hb.json()["data"]["command"] == "none"

import uuid
import pytest
from httpx import AsyncClient

from app.db.session import get_identity_session
from app.models.identity import User
from app.services.notification_service import NotificationService


@pytest.mark.asyncio
async def test_notifications_api_full_flow(test_client: AsyncClient, test_identity_session):
    # 1. Unauthenticated request must return 401
    unauth_res = await test_client.get("/api/v1/notifications")
    assert unauth_res.status_code == 401

    # 2. Register and login User 1
    u1_email = f"user1_{uuid.uuid4().hex[:6]}@pollwise.edu"
    reg1 = await test_client.post(
        "/api/v1/auth/register",
        json={"email": u1_email, "password": "Password123!", "display_name": "User One"},
    )
    assert reg1.status_code in (200, 201)
    login1 = await test_client.post(
        "/api/v1/auth/login",
        json={"email": u1_email, "password": "Password123!"},
    )
    assert login1.status_code == 200
    user1_id = uuid.UUID(login1.json()["data"]["user"]["id"])

    # Initial list is empty
    res = await test_client.get("/api/v1/notifications")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["notifications"] == []
    assert data["total_count"] == 0
    assert data["unread_count"] == 0

    # 3. Create notifications directly via NotificationService
    notif1 = await NotificationService.create_notification(
        session=test_identity_session,
        user_id=user1_id,
        title="Election Live",
        message="Voting has started for Student Union.",
        notification_type="election_status",
        action_url="/elections/su-2026",
    )
    notif2 = await NotificationService.create_notification(
        session=test_identity_session,
        user_id=user1_id,
        title="Ballot Cast",
        message="Your ballot receipt code is RC-8891.",
        notification_type="voting",
    )
    notif3 = await NotificationService.create_notification(
        session=test_identity_session,
        user_id=user1_id,
        title="Welcome",
        message="Welcome to PollWise.",
        notification_type="system",
    )
    # Mark notif3 as read directly for setup
    notif3.is_read = True
    await test_identity_session.commit()

    # 4. Fetch notifications for User 1
    res = await test_client.get("/api/v1/notifications")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["total_count"] == 3
    assert data["unread_count"] == 2
    assert len(data["notifications"]) == 3

    # 5. Filter unread only
    res_unread = await test_client.get("/api/v1/notifications?unread_only=true")
    assert res_unread.status_code == 200
    unread_data = res_unread.json()["data"]
    assert len(unread_data["notifications"]) == 2
    assert all(not n["is_read"] for n in unread_data["notifications"])

    # 6. Mark single notification as read
    res_mark = await test_client.patch(f"/api/v1/notifications/{notif1.id}/read")
    assert res_mark.status_code == 200
    marked_data = res_mark.json()["data"]
    assert marked_data["is_read"] is True
    assert marked_data["read_at"] is not None

    # Check unread count is now 1
    res_after = await test_client.get("/api/v1/notifications")
    assert res_after.json()["data"]["unread_count"] == 1

    # 7. User isolation check: User 2
    u2_email = f"user2_{uuid.uuid4().hex[:6]}@pollwise.edu"
    await test_client.post(
        "/api/v1/auth/register",
        json={"email": u2_email, "password": "Password123!", "display_name": "User Two"},
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": u2_email, "password": "Password123!"},
    )

    # User 2 sees 0 notifications
    res_u2 = await test_client.get("/api/v1/notifications")
    assert res_u2.status_code == 200
    assert res_u2.json()["data"]["total_count"] == 0

    # User 2 cannot mark User 1's notification as read
    res_forbidden = await test_client.patch(f"/api/v1/notifications/{notif2.id}/read")
    assert res_forbidden.status_code == 404

    # 8. Switch back to User 1 and mark all read
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": u1_email, "password": "Password123!"},
    )
    mark_all = await test_client.post("/api/v1/notifications/mark-all-read")
    assert mark_all.status_code == 200
    assert mark_all.json()["data"]["marked_count"] == 1

    res_final = await test_client.get("/api/v1/notifications")
    assert res_final.json()["data"]["unread_count"] == 0

import uuid
from datetime import UTC, datetime
import pytest
from httpx import AsyncClient

from app.models.election import Election, ElectionStatus
from app.models.identity import Organization, OrganizationMembership, OrganizationRole


@pytest.mark.asyncio
async def test_personal_registration_emits_welcome_notification(test_client: AsyncClient):
    email = f"welcome_{uuid.uuid4().hex[:6]}@pollwise.edu"
    reg = await test_client.post(
        "/api/v1/auth/register/personal",
        json={
            "email": email,
            "password": "Password123!",
            "first_name": "New",
            "last_name": "Voter",
            "terms_accepted": True,
        },
    )
    assert reg.status_code in (200, 201), reg.text

    # Log in and check notifications
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )

    res = await test_client.get("/api/v1/notifications")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["total_count"] >= 1
    assert data["unread_count"] >= 1
    welcome = next((n for n in data["notifications"] if "Welcome" in n["title"]), None)
    assert welcome is not None
    assert welcome["notification_type"] == "system"
    assert welcome["is_read"] is False


@pytest.mark.asyncio
async def test_report_generation_emits_notification(
    test_client: AsyncClient, test_identity_session, test_election_session
):
    # Register & login admin
    email = f"report_admin_{uuid.uuid4().hex[:6]}@pollwise.edu"
    reg = await test_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "display_name": "Report Admin"},
    )
    assert reg.status_code in (200, 201)
    login = await test_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    admin_id = uuid.UUID(login.json()["data"]["user"]["id"])

    # Create org & membership
    org = Organization(name="Test University", slug=f"test-uni-{uuid.uuid4().hex[:6]}")
    test_identity_session.add(org)
    await test_identity_session.flush()

    mem = OrganizationMembership(
        user_id=admin_id,
        organization_id=org.id,
        role=OrganizationRole.ORGANIZATION_ADMIN.value,
    )
    test_identity_session.add(mem)
    await test_identity_session.commit()

    # Create election
    election = Election(
        id=uuid.uuid4(),
        organization_id=org.id,
        title="Student Council 2026",
        status="published",
        opens_at=datetime.now(UTC),
        closes_at=datetime.now(UTC),
        timezone="UTC",
        created_by=admin_id,
    )
    test_election_session.add(election)
    await test_election_session.commit()

    # Generate summary report
    rep_res = await test_client.post(
        f"/api/v1/elections/{election.id}/reports/generate",
        json={"report_type": "summary", "file_format": "csv"},
    )
    assert rep_res.status_code == 200, rep_res.text

    # Check notification for admin
    notif_res = await test_client.get("/api/v1/notifications")
    assert notif_res.status_code == 200
    data = notif_res.json()["data"]
    report_notif = next((n for n in data["notifications"] if "Report Generated" in n["title"]), None)
    assert report_notif is not None
    assert report_notif["notification_type"] == "report_certified"
    assert "Student Council 2026" in report_notif["message"]
    assert report_notif["is_read"] is False

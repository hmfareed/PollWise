import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_organization_management_and_rbac(test_client):
    # 1. Register User A (Org Admin)
    await test_client.post(
        "/api/v1/auth/register",
        json={"email": "alice@org.edu", "password": "Password123!", "display_name": "Alice Admin"},
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "alice@org.edu", "password": "Password123!"},
    )

    # 2. Alice creates Organization A
    res_org = await test_client.post(
        "/api/v1/organizations",
        json={"name": "Engineering Faculty Senate", "slug": "eng-senate"},
    )
    assert res_org.status_code == 201
    org_a = res_org.json()["data"]
    org_a_id = org_a["id"]
    assert org_a["name"] == "Engineering Faculty Senate"

    # 3. Register User B (Member)
    # Using a separate client instance to simulate independent browser session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client_b:
        await client_b.post(
            "/api/v1/auth/register",
            json={"email": "bob@org.edu", "password": "Password123!", "display_name": "Bob Member"},
        )
        await client_b.post(
            "/api/v1/auth/login",
            json={"email": "bob@org.edu", "password": "Password123!"},
        )

        # Bob attempts to view Org A before being added -> 403 Forbidden
        res_bob_early = await client_b.get(f"/api/v1/organizations/{org_a_id}")
        assert res_bob_early.status_code == 403

        # Alice adds Bob as a member
        res_add = await test_client.post(
            f"/api/v1/organizations/{org_a_id}/members",
            json={"email": "bob@org.edu", "role": "member"},
        )
        assert res_add.status_code == 201
        assert res_add.json()["data"]["role"] == "member"

        # Bob can now view Org A
        res_bob_view = await client_b.get(f"/api/v1/organizations/{org_a_id}")
        assert res_bob_view.status_code == 200

        # Bob (member) tries to update Org A -> 403 Forbidden (RBAC enforcement)
        res_bob_update = await client_b.patch(
            f"/api/v1/organizations/{org_a_id}",
            json={"name": "Hacked Name"},
        )
        assert res_bob_update.status_code == 403

        # Bob (member) tries to add a member to Org A -> 403 Forbidden
        res_bob_add = await client_b.post(
            f"/api/v1/organizations/{org_a_id}/members",
            json={"email": "anyone@org.edu", "role": "member"},
        )
        assert res_bob_add.status_code == 403


@pytest.mark.asyncio
async def test_cross_organization_isolation(test_client):
    # Register & Login User A (Admin of Org A)
    await test_client.post(
        "/api/v1/auth/register",
        json={"email": "owner-a@univ.edu", "password": "Password123!", "display_name": "Owner A"},
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "owner-a@univ.edu", "password": "Password123!"},
    )
    res_a = await test_client.post(
        "/api/v1/organizations",
        json={"name": "Medical Student Union", "slug": "med-union"},
    )
    org_a_id = res_a.json()["data"]["id"]

    # Register & Login User B (Admin of Org B)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client_b:
        await client_b.post(
            "/api/v1/auth/register",
            json={
                "email": "owner-b@univ.edu",
                "password": "Password123!",
                "display_name": "Owner B",
            },
        )
        await client_b.post(
            "/api/v1/auth/login",
            json={"email": "owner-b@univ.edu", "password": "Password123!"},
        )
        res_b = await client_b.post(
            "/api/v1/organizations",
            json={"name": "Law Student Society", "slug": "law-society"},
        )
        org_b_id = res_b.json()["data"]["id"]

        # Owner B tries to access Org A -> 403 Forbidden
        res_cross_get = await client_b.get(f"/api/v1/organizations/{org_a_id}")
        assert res_cross_get.status_code == 403

        # Owner B tries to update Org A -> 403 Forbidden
        res_cross_patch = await client_b.patch(
            f"/api/v1/organizations/{org_a_id}",
            json={"name": "Law Takeover"},
        )
        assert res_cross_patch.status_code == 403

        # Owner A tries to access Org B -> 403 Forbidden
        res_a_cross = await test_client.get(f"/api/v1/organizations/{org_b_id}")
        assert res_a_cross.status_code == 403


@pytest.mark.asyncio
async def test_institution_onboarding_wizard_workflow(test_client):
    # 1. Register new institution admin
    inst_reg = {
        "account_type": "institution",
        "first_name": "Chancellor",
        "last_name": "Sterling",
        "email": "sterling@cambridge-tech.edu",
        "password": "ChancellorPass2026!",
        "institution_name": "Cambridge Institute of Advanced Technology",
        "institution_type": "University",
        "country": "United Kingdom",
        "terms_accepted": True,
    }
    reg_res = await test_client.post("/api/v1/auth/register", json=inst_reg)
    assert reg_res.status_code == 201

    # 2. Login
    login_res = await test_client.post(
        "/api/v1/auth/login",
        json={"email": "sterling@cambridge-tech.edu", "password": "ChancellorPass2026!"},
    )
    assert login_res.status_code == 200
    me = login_res.json()["data"]
    org_id = me["memberships"][0]["organization_id"]

    # Organization is initially in draft state
    org_res = await test_client.get(f"/api/v1/organizations/{org_id}")
    assert org_res.status_code == 200
    assert org_res.json()["data"]["status"] == "draft"

    # 3. Submit complete multi-step onboarding wizard
    onboarding_payload = {
        "institution_name": "Cambridge Institute of Advanced Technology",
        "abbreviation": "CIAT",
        "institution_type": "University",
        "country": "United Kingdom",
        "city": "Cambridge",
        "website": "https://ciat.ac.uk",
        "contact_email": "admin@ciat.ac.uk",
        "contact_phone": "+44 1223 123456",
        "description": "Leading research and technical education institution.",
        "approximate_members": 12500,
        "department_count": 8,
        "admin_title": "Chancellor & Electoral Oversight Chair",
        "admin_department": "Office of the Vice-Chancellor",
        "structure_units": [
            {"name": "Faculty of Computer Science", "unit_type": "faculty"},
            {"name": "Department of Artificial Intelligence", "unit_type": "department"},
            {"name": "Student Union Board", "unit_type": "student_union"},
        ],
        "mfa_policy": "recommended",
        "approved_domains": ["ciat.ac.uk", "alumni.ciat.ac.uk"],
        "invitation_permission": "admin_only",
        "session_idle_minutes": 60,
        "session_absolute_hours": 12,
        "require_dual_approval_for_launch": True,
        "is_completed": True,
    }

    onboard_res = await test_client.post(
        f"/api/v1/organizations/{org_id}/onboarding",
        json=onboarding_payload,
    )
    assert onboard_res.status_code == 200
    data = onboard_res.json()["data"]
    assert data["status"] == "active"
    assert data["metadata"]["abbreviation"] == "CIAT"
    assert len(data["metadata"]["structure_units"]) == 3
    assert data["metadata"]["structure_units"][0]["name"] == "Faculty of Computer Science"

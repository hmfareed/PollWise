from datetime import UTC, datetime, timedelta
import uuid

from httpx import ASGITransport, AsyncClient
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.main import app
from app.models.election import (
    AuditEvent,
    Candidate,
    Election,
    ElectionStatus,
    Position,
)
from app.models.identity import (
    AccountStatus,
    ElectionEligibility,
    EligibilityStatus,
    Organization,
    OrganizationMembership,
    User,
)


@pytest.mark.asyncio
async def test_dashboard_summary_unauthenticated(test_client: AsyncClient):
    """Unauthenticated requests must be rejected with 401 Unauthorized."""
    org_id = uuid.uuid4()
    res = await test_client.get(f"/api/v1/organizations/{org_id}/dashboard/summary")
    assert res.status_code == 401
    payload = res.json()
    assert payload["data"] is None
    assert payload["error"]["code"] == "UNAUTHENTICATED"


@pytest.mark.asyncio
async def test_dashboard_summary_forbidden_non_member(test_client: AsyncClient):
    """User not belonging to the organization must be rejected with 403 Forbidden."""
    # Alice registers and creates Org A
    await test_client.post(
        "/api/v1/auth/register",
        json={"email": "alice@org-a.edu", "password": "Password123!", "display_name": "Alice Admin"},
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "alice@org-a.edu", "password": "Password123!"},
    )
    res_org = await test_client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
    )
    org_a_id = res_org.json()["data"]["id"]

    # Bob logs in on separate client session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client_b:
        await client_b.post(
            "/api/v1/auth/register",
            json={"email": "bob@outsider.edu", "password": "Password123!", "display_name": "Bob Outsider"},
        )
        await client_b.post(
            "/api/v1/auth/login",
            json={"email": "bob@outsider.edu", "password": "Password123!"},
        )

        res_bob = await client_b.get(f"/api/v1/organizations/{org_a_id}/dashboard/summary")
        assert res_bob.status_code == 403
        payload = res_bob.json()
        assert payload["data"] is None
        assert payload["error"]["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_dashboard_summary_forbidden_unauthorized_role(test_client: AsyncClient):
    """User with 'member' role must be rejected with 403 Forbidden."""
    # Alice creates Org
    await test_client.post(
        "/api/v1/auth/register",
        json={"email": "admin@org-rbac.edu", "password": "Password123!", "display_name": "Org Admin"},
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@org-rbac.edu", "password": "Password123!"},
    )
    res_org = await test_client.post(
        "/api/v1/organizations",
        json={"name": "Org RBAC", "slug": "org-rbac"},
    )
    org_id = res_org.json()["data"]["id"]

    # Member user registers
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client_member:
        await client_member.post(
            "/api/v1/auth/register",
            json={"email": "regular@org-rbac.edu", "password": "Password123!", "display_name": "Regular Member"},
        )
        await client_member.post(
            "/api/v1/auth/login",
            json={"email": "regular@org-rbac.edu", "password": "Password123!"},
        )

        # Admin adds user with role "member"
        res_add = await test_client.post(
            f"/api/v1/organizations/{org_id}/members",
            json={"email": "regular@org-rbac.edu", "role": "member"},
        )
        assert res_add.status_code == 201

        # Member attempts to view admin dashboard summary -> 403 Forbidden
        res = await client_member.get(f"/api/v1/organizations/{org_id}/dashboard/summary")
        assert res.status_code == 403
        payload = res.json()
        assert payload["data"] is None
        assert payload["error"]["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_dashboard_summary_allowed_roles(test_client: AsyncClient):
    """Users with election_manager and auditor roles must have access (200 OK)."""
    # Admin creates Org
    await test_client.post(
        "/api/v1/auth/register",
        json={"email": "owner@roles-test.edu", "password": "Password123!", "display_name": "Owner Admin"},
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "owner@roles-test.edu", "password": "Password123!"},
    )
    res_org = await test_client.post(
        "/api/v1/organizations",
        json={"name": "Roles Test University", "slug": "roles-test-uni"},
    )
    org_id = res_org.json()["data"]["id"]

    transport = ASGITransport(app=app)

    # Test Election Manager
    async with AsyncClient(transport=transport, base_url="http://test") as client_mgr:
        await client_mgr.post(
            "/api/v1/auth/register",
            json={"email": "mgr@roles-test.edu", "password": "Password123!", "display_name": "Election Manager"},
        )
        await client_mgr.post(
            "/api/v1/auth/login",
            json={"email": "mgr@roles-test.edu", "password": "Password123!"},
        )
        await test_client.post(
            f"/api/v1/organizations/{org_id}/members",
            json={"email": "mgr@roles-test.edu", "role": "election_manager"},
        )
        res_mgr = await client_mgr.get(f"/api/v1/organizations/{org_id}/dashboard/summary")
        assert res_mgr.status_code == 200

    # Test Auditor
    async with AsyncClient(transport=transport, base_url="http://test") as client_aud:
        await client_aud.post(
            "/api/v1/auth/register",
            json={"email": "auditor@roles-test.edu", "password": "Password123!", "display_name": "Auditor"},
        )
        await client_aud.post(
            "/api/v1/auth/login",
            json={"email": "auditor@roles-test.edu", "password": "Password123!"},
        )
        await test_client.post(
            f"/api/v1/organizations/{org_id}/members",
            json={"email": "auditor@roles-test.edu", "role": "auditor"},
        )
        res_aud = await client_aud.get(f"/api/v1/organizations/{org_id}/dashboard/summary")
        assert res_aud.status_code == 200


@pytest.mark.asyncio
async def test_dashboard_summary_empty_institution(test_client: AsyncClient):
    """Empty institution returns 200 OK with zero-fake-data policy verified."""
    await test_client.post(
        "/api/v1/auth/register",
        json={"email": "dean@empty-inst.edu", "password": "Password123!", "display_name": "Dean Admin"},
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "dean@empty-inst.edu", "password": "Password123!"},
    )
    res_org = await test_client.post(
        "/api/v1/organizations",
        json={"name": "Empty Institute of Technology", "slug": "empty-tech"},
    )
    org_id = res_org.json()["data"]["id"]

    res = await test_client.get(f"/api/v1/organizations/{org_id}/dashboard/summary")
    assert res.status_code == 200
    payload = res.json()
    assert payload["error"] is None
    data = payload["data"]

    assert data["organization_id"] == org_id
    assert data["organization_name"] == "Empty Institute of Technology"
    assert data["period"] == "last_12_months"

    # KPI counts: zero
    assert data["metrics"]["total_elections"]["value"] == 0
    assert data["metrics"]["total_elections"]["change_pct"] is None
    assert data["metrics"]["eligible_voters"]["value"] == 0
    assert data["metrics"]["eligible_voters"]["change_pct"] is None
    assert data["metrics"]["registered_candidates"]["value"] == 0
    assert data["metrics"]["registered_candidates"]["change_pct"] is None
    assert data["metrics"]["active_elections"]["value"] == 0
    assert data["metrics"]["active_elections"]["change_pct"] is None

    # Donut total: zero
    assert data["election_status"]["total"] == 0
    assert data["election_status"]["draft"] == 0
    assert data["election_status"]["open"] == 0

    # Lists: empty
    assert data["upcoming_deadlines"] == []
    assert data["recent_activity"] == []

    # Chart points: 12 buckets
    assert len(data["election_overview"]["points"]) == 12
    for pt in data["election_overview"]["points"]:
        assert pt["created"] == 0
        assert pt["closed"] == 0
        assert pt["published"] == 0


@pytest.mark.asyncio
async def test_dashboard_summary_populated_institution(
    test_client: AsyncClient,
    test_identity_session: AsyncSession,
    test_election_session: AsyncSession,
):
    """Populated institution returns real metrics, deadlines, and activity."""
    # Create admin user and org via API
    await test_client.post(
        "/api/v1/auth/register",
        json={"email": "president@populated-inst.edu", "password": "Password123!", "display_name": "President"},
    )
    res_login = await test_client.post(
        "/api/v1/auth/login",
        json={"email": "president@populated-inst.edu", "password": "Password123!"},
    )
    user_id = uuid.UUID(res_login.json()["data"]["user"]["id"])
    res_org = await test_client.post(
        "/api/v1/organizations",
        json={"name": "Populated State College", "slug": "populated-state"},
    )
    org_id_str = res_org.json()["data"]["id"]
    org_id = uuid.UUID(org_id_str)

    now = datetime.now(UTC)

    # Add Elections to election_session
    elec1 = Election(
        id=uuid.uuid4(),
        organization_id=org_id,
        title="Student Council General Election",
        status=ElectionStatus.OPEN,
        opens_at=now - timedelta(days=1),
        closes_at=now + timedelta(days=3),
        created_by=user_id,
    )
    elec2 = Election(
        id=uuid.uuid4(),
        organization_id=org_id,
        title="Faculty Senate Special Election",
        status=ElectionStatus.DRAFT,
        opens_at=now + timedelta(days=10),
        closes_at=now + timedelta(days=14),
        created_by=user_id,
    )
    test_election_session.add_all([elec1, elec2])
    await test_election_session.flush()

    # Positions and Candidates
    pos1 = Position(
        id=uuid.uuid4(),
        election_id=elec1.id,
        title="President",
        max_selections=1,
    )
    pos2 = Position(
        id=uuid.uuid4(),
        election_id=elec2.id,
        title="Senator",
        max_selections=1,
    )
    test_election_session.add_all([pos1, pos2])
    await test_election_session.flush()

    cand1 = Candidate(
        id=uuid.uuid4(),
        position_id=pos1.id,
        name="Candidate Alpha",
        status="active",
    )
    cand2 = Candidate(
        id=uuid.uuid4(),
        position_id=pos1.id,
        name="Candidate Beta",
        status="active",
    )
    cand3 = Candidate(
        id=uuid.uuid4(),
        position_id=pos2.id,
        name="Candidate Gamma",
        status="active",
    )
    test_election_session.add_all([cand1, cand2, cand3])

    # Audit Event
    audit_event = AuditEvent(
        id=uuid.uuid4(),
        organization_id=org_id,
        election_id=elec1.id,
        event_type="election_opened",
        metadata_json='{"title": "Student Council General Election"}',
        outcome="success",
        created_at=now - timedelta(hours=2),
    )
    test_election_session.add(audit_event)
    await test_election_session.commit()

    # Add 2 distinct voters to identity_session (one eligible in both elections, one in elec1)
    voter1 = User(
        id=uuid.uuid4(),
        email_normalized="voter1@populated-inst.edu",
        password_hash=hash_password("Pass123!"),
        display_name="Voter 1",
        account_status=AccountStatus.ACTIVE.value,
        email_verified_at=now,
    )
    voter2 = User(
        id=uuid.uuid4(),
        email_normalized="voter2@populated-inst.edu",
        password_hash=hash_password("Pass123!"),
        display_name="Voter 2",
        account_status=AccountStatus.ACTIVE.value,
        email_verified_at=now,
    )
    test_identity_session.add_all([voter1, voter2])
    await test_identity_session.flush()

    el1 = ElectionEligibility(
        id=uuid.uuid4(),
        election_id=elec1.id,
        user_id=voter1.id,
        eligibility_status=EligibilityStatus.ELIGIBLE.value,
    )
    el2 = ElectionEligibility(
        id=uuid.uuid4(),
        election_id=elec2.id,
        user_id=voter1.id,
        eligibility_status=EligibilityStatus.ELIGIBLE.value,
    )
    el3 = ElectionEligibility(
        id=uuid.uuid4(),
        election_id=elec1.id,
        user_id=voter2.id,
        eligibility_status=EligibilityStatus.ELIGIBLE.value,
    )
    test_identity_session.add_all([el1, el2, el3])
    await test_identity_session.commit()

    # Fetch summary via API
    res = await test_client.get(f"/api/v1/organizations/{org_id}/dashboard/summary")
    assert res.status_code == 200
    data = res.json()["data"]

    # KPI assertions
    assert data["metrics"]["total_elections"]["value"] == 2
    assert data["metrics"]["active_elections"]["value"] == 1
    assert data["metrics"]["registered_candidates"]["value"] == 3
    assert data["metrics"]["eligible_voters"]["value"] == 2  # deduplicated across elections

    # Status distribution
    assert data["election_status"]["total"] == 2
    assert data["election_status"]["open"] == 1
    assert data["election_status"]["draft"] == 1

    # Upcoming deadlines
    assert len(data["upcoming_deadlines"]) >= 1
    assert data["upcoming_deadlines"][0]["election_id"] == str(elec1.id)
    assert data["upcoming_deadlines"][0]["deadline_type"] == "Voting Closes"

    # Recent activity
    assert len(data["recent_activity"]) >= 1
    assert data["recent_activity"][0]["event_type"] == "election_opened"


@pytest.mark.asyncio
async def test_dashboard_summary_period_parameter_and_fallback(test_client: AsyncClient):
    """Query parameter period is propagated and invalid values fallback gracefully."""
    await test_client.post(
        "/api/v1/auth/register",
        json={"email": "chair@period-test.edu", "password": "Password123!", "display_name": "Chair"},
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "chair@period-test.edu", "password": "Password123!"},
    )
    res_org = await test_client.post(
        "/api/v1/organizations",
        json={"name": "Period Test Org", "slug": "period-test"},
    )
    org_id = res_org.json()["data"]["id"]

    # 1. period=last_30_days -> 30 buckets
    res_30d = await test_client.get(f"/api/v1/organizations/{org_id}/dashboard/summary?period=last_30_days")
    assert res_30d.status_code == 200
    assert res_30d.json()["data"]["period"] == "last_30_days"
    assert len(res_30d.json()["data"]["election_overview"]["points"]) == 30

    # 2. period=last_3_months -> 3 buckets
    res_3m = await test_client.get(f"/api/v1/organizations/{org_id}/dashboard/summary?period=last_3_months")
    assert res_3m.status_code == 200
    assert res_3m.json()["data"]["period"] == "last_3_months"
    assert len(res_3m.json()["data"]["election_overview"]["points"]) == 3

    # 3. period=last_6_months -> 6 buckets
    res_6m = await test_client.get(f"/api/v1/organizations/{org_id}/dashboard/summary?period=last_6_months")
    assert res_6m.status_code == 200
    assert res_6m.json()["data"]["period"] == "last_6_months"
    assert len(res_6m.json()["data"]["election_overview"]["points"]) == 6

    # 4. period=invalid_random_string -> defaults to last_12_months (12 buckets)
    res_invalid = await test_client.get(f"/api/v1/organizations/{org_id}/dashboard/summary?period=invalid_period_foo")
    assert res_invalid.status_code == 200
    assert res_invalid.json()["data"]["period"] == "last_12_months"
    assert len(res_invalid.json()["data"]["election_overview"]["points"]) == 12

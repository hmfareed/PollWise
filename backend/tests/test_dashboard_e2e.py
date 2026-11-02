"""
PollWise Admin Dashboard End-to-End Real Lifecycle Integration Test

Verifies the complete real-data institutional election lifecycle and its reflection
in the Admin Dashboard summary API:
1. User registration and Institution A creation
2. Initial empty state verification (zero-fake-data policy: 0s for all KPIs, 0 donut total, empty deadlines/activity)
3. Election 1 creation in draft -> total_elections == 1, draft == 1
4. Position & 2 active candidates creation -> registered_candidates == 2
5. Voter eligibility enrollment for 2 users -> eligible_voters == 2
6. Election 2 creation and voter eligibility addition with 1 existing user and 1 new user ->
   deduplication verification (eligible_voters == 3 across both elections)
7. Formal launch approval, configuration lock, and election opening ->
   active_elections == 1, open == 1, deadline appears in upcoming_deadlines, audit event in recent_activity
8. Multi-tenant isolation verification -> Institution B has clean 0s and mutual 403 Forbidden enforcement
"""

from datetime import UTC, datetime, timedelta
import uuid

from httpx import ASGITransport, AsyncClient
import pytest

from app.main import app


@pytest.mark.asyncio
async def test_complete_dashboard_lifecycle_e2e(test_client: AsyncClient):
    """Full E2E verification of real lifecycle actions reflecting accurately in the dashboard."""
    transport = ASGITransport(app=app)

    # -------------------------------------------------------------------------
    # STEP 1: Register User & Create Institution A
    # -------------------------------------------------------------------------
    reg_admin_a = await test_client.post(
        "/api/v1/auth/register",
        json={
            "email": "dean.alpha@alpha-university.edu",
            "password": "AlphaAdminSecure2026!",
            "display_name": "Dean Eleanor Alpha",
        },
    )
    assert reg_admin_a.status_code == 201

    login_admin_a = await test_client.post(
        "/api/v1/auth/login",
        json={
            "email": "dean.alpha@alpha-university.edu",
            "password": "AlphaAdminSecure2026!",
        },
    )
    assert login_admin_a.status_code == 200

    create_org_a = await test_client.post(
        "/api/v1/organizations",
        json={
            "name": "Alpha University",
            "slug": "alpha-univ",
        },
    )
    assert create_org_a.status_code == 201
    org_a_id = create_org_a.json()["data"]["id"]

    # -------------------------------------------------------------------------
    # STEP 2: Verify Initial Empty State (Zero-Fake-Data Policy)
    # -------------------------------------------------------------------------
    res_empty = await test_client.get(f"/api/v1/organizations/{org_a_id}/dashboard/summary")
    assert res_empty.status_code == 200
    empty_data = res_empty.json()["data"]

    assert empty_data["organization_id"] == org_a_id
    assert empty_data["organization_name"] == "Alpha University"
    assert empty_data["period"] == "last_12_months"

    # All 4 KPIs clean 0s with no percentage change
    assert empty_data["metrics"]["total_elections"]["value"] == 0
    assert empty_data["metrics"]["total_elections"]["change_pct"] is None
    assert empty_data["metrics"]["eligible_voters"]["value"] == 0
    assert empty_data["metrics"]["eligible_voters"]["change_pct"] is None
    assert empty_data["metrics"]["registered_candidates"]["value"] == 0
    assert empty_data["metrics"]["registered_candidates"]["change_pct"] is None
    assert empty_data["metrics"]["active_elections"]["value"] == 0
    assert empty_data["metrics"]["active_elections"]["change_pct"] is None

    # Donut total 0
    assert empty_data["election_status"]["total"] == 0
    assert empty_data["election_status"]["draft"] == 0
    assert empty_data["election_status"]["scheduled"] == 0
    assert empty_data["election_status"]["open"] == 0
    assert empty_data["election_status"]["closed"] == 0
    assert empty_data["election_status"]["published"] == 0
    assert empty_data["election_status"]["canceled"] == 0

    # Deadlines and activity empty
    assert empty_data["upcoming_deadlines"] == []
    assert empty_data["recent_activity"] == []

    # Overview chart points: 12 monthly buckets all 0s
    assert len(empty_data["election_overview"]["points"]) == 12
    for pt in empty_data["election_overview"]["points"]:
        assert pt["created"] == 0
        assert pt["closed"] == 0
        assert pt["published"] == 0

    # -------------------------------------------------------------------------
    # STEP 3: Create Election 1 in Draft -> total_elections == 1, draft == 1
    # -------------------------------------------------------------------------
    now = datetime.now(UTC)
    opens_at_e1 = (now - timedelta(hours=1)).isoformat()
    closes_at_e1 = (now + timedelta(days=7)).isoformat()

    create_e1 = await test_client.post(
        "/api/v1/elections",
        json={
            "organization_id": org_a_id,
            "title": "Alpha Student Council Election 2026",
            "description": "General election for undergraduate student leadership.",
            "opens_at": opens_at_e1,
            "closes_at": closes_at_e1,
            "timezone": "UTC",
        },
    )
    assert create_e1.status_code == 201
    elec1_id = create_e1.json()["data"]["id"]

    res_step3 = await test_client.get(f"/api/v1/organizations/{org_a_id}/dashboard/summary")
    assert res_step3.status_code == 200
    data_step3 = res_step3.json()["data"]

    assert data_step3["metrics"]["total_elections"]["value"] == 1
    assert data_step3["election_status"]["total"] == 1
    assert data_step3["election_status"]["draft"] == 1
    assert data_step3["election_status"]["open"] == 0
    assert data_step3["metrics"]["active_elections"]["value"] == 0
    assert data_step3["metrics"]["registered_candidates"]["value"] == 0
    assert data_step3["metrics"]["eligible_voters"]["value"] == 0
    # In draft state with past opens_at, no open/scheduled closing deadline applies
    assert data_step3["upcoming_deadlines"] == []

    # -------------------------------------------------------------------------
    # STEP 4: Create Position and 2 Active Candidates -> registered_candidates == 2
    # -------------------------------------------------------------------------
    create_pos = await test_client.post(
        f"/api/v1/elections/{elec1_id}/positions",
        json={
            "title": "Council President",
            "description": "Chief executive officer of the Student Council",
            "min_selections": 1,
            "max_selections": 1,
            "display_order": 0,
        },
    )
    assert create_pos.status_code == 201
    pos1_id = create_pos.json()["data"]["id"]

    cand1_res = await test_client.post(
        f"/api/v1/positions/{pos1_id}/candidates",
        json={
            "name": "Candidate Alice Walker",
            "biography": "Platform for transparent student resource allocation.",
            "display_order": 0,
        },
    )
    assert cand1_res.status_code == 201

    cand2_res = await test_client.post(
        f"/api/v1/positions/{pos1_id}/candidates",
        json={
            "name": "Candidate Bob Chen",
            "biography": "Platform for mental health and library hours expansion.",
            "display_order": 1,
        },
    )
    assert cand2_res.status_code == 201

    res_step4 = await test_client.get(f"/api/v1/organizations/{org_a_id}/dashboard/summary")
    assert res_step4.status_code == 200
    data_step4 = res_step4.json()["data"]

    assert data_step4["metrics"]["registered_candidates"]["value"] == 2
    assert data_step4["metrics"]["total_elections"]["value"] == 1
    assert data_step4["election_status"]["draft"] == 1

    # -------------------------------------------------------------------------
    # STEP 5: Add Voter Eligibility for 2 Users -> eligible_voters == 2
    # -------------------------------------------------------------------------
    # Register 3 voters in the identity system using an auxiliary client
    async with AsyncClient(transport=transport, base_url="http://test") as reg_client:
        await reg_client.post(
            "/api/v1/auth/register",
            json={"email": "voter1@alpha-university.edu", "password": "VoterPassword2026!", "display_name": "Voter 1"},
        )
        await reg_client.post(
            "/api/v1/auth/register",
            json={"email": "voter2@alpha-university.edu", "password": "VoterPassword2026!", "display_name": "Voter 2"},
        )
        await reg_client.post(
            "/api/v1/auth/register",
            json={"email": "voter3@alpha-university.edu", "password": "VoterPassword2026!", "display_name": "Voter 3"},
        )

    # Admin enrolls Voter 1 and Voter 2 into Election 1
    elig1_res = await test_client.post(
        f"/api/v1/elections/{elec1_id}/eligibility",
        json={"email": "voter1@alpha-university.edu"},
    )
    assert elig1_res.status_code == 201

    elig2_res = await test_client.post(
        f"/api/v1/elections/{elec1_id}/eligibility",
        json={"email": "voter2@alpha-university.edu"},
    )
    assert elig2_res.status_code == 201

    res_step5 = await test_client.get(f"/api/v1/organizations/{org_a_id}/dashboard/summary")
    assert res_step5.status_code == 200
    data_step5 = res_step5.json()["data"]

    assert data_step5["metrics"]["eligible_voters"]["value"] == 2
    assert data_step5["metrics"]["registered_candidates"]["value"] == 2
    assert data_step5["metrics"]["total_elections"]["value"] == 1

    # -------------------------------------------------------------------------
    # STEP 6: Create Election 2 & Add Voter Eligibility (1 Existing, 1 New)
    # Deduplication verification: eligible_voters == 3 across both elections
    # -------------------------------------------------------------------------
    create_e2 = await test_client.post(
        "/api/v1/elections",
        json={
            "organization_id": org_a_id,
            "title": "Alpha Faculty Senate Special Election 2026",
            "description": "Representative vote for faculty governance council.",
            "timezone": "UTC",
        },
    )
    assert create_e2.status_code == 201
    elec2_id = create_e2.json()["data"]["id"]

    # Add existing Voter 1 and new Voter 3 to Election 2
    elig_e2_v1 = await test_client.post(
        f"/api/v1/elections/{elec2_id}/eligibility",
        json={"email": "voter1@alpha-university.edu"},
    )
    assert elig_e2_v1.status_code == 201

    elig_e2_v3 = await test_client.post(
        f"/api/v1/elections/{elec2_id}/eligibility",
        json={"email": "voter3@alpha-university.edu"},
    )
    assert elig_e2_v3.status_code == 201

    res_step6 = await test_client.get(f"/api/v1/organizations/{org_a_id}/dashboard/summary")
    assert res_step6.status_code == 200
    data_step6 = res_step6.json()["data"]

    # Even though there are 4 eligibility records total (2 in e1 + 2 in e2),
    # the distinct user count must strictly deduplicate to 3!
    assert data_step6["metrics"]["eligible_voters"]["value"] == 3
    assert data_step6["metrics"]["total_elections"]["value"] == 2
    assert data_step6["election_status"]["total"] == 2
    assert data_step6["election_status"]["draft"] == 2
    assert data_step6["metrics"]["registered_candidates"]["value"] == 2

    # -------------------------------------------------------------------------
    # STEP 7: Launch Election 1 (Open with closes_at in Future)
    # Verify active_elections == 1, open == 1, upcoming_deadlines, and recent_activity
    # -------------------------------------------------------------------------
    # 7.1 Formal launch approval
    approve_res = await test_client.post(
        f"/api/v1/elections/{elec1_id}/approve-launch",
        json={
            "decision": "approved",
            "reason": "Constitutionally ratified in Executive Council Meeting #14",
        },
    )
    assert approve_res.status_code == 200

    # 7.2 Schedule election (freezes configuration hash)
    schedule_res = await test_client.post(f"/api/v1/elections/{elec1_id}/schedule")
    assert schedule_res.status_code == 200
    assert schedule_res.json()["data"]["status"] == "scheduled"
    assert schedule_res.json()["data"]["configuration_hash"] is not None

    # 7.3 Open election
    open_res = await test_client.post(f"/api/v1/elections/{elec1_id}/open")
    assert open_res.status_code == 200
    assert open_res.json()["data"]["status"] == "open"

    res_step7 = await test_client.get(f"/api/v1/organizations/{org_a_id}/dashboard/summary")
    assert res_step7.status_code == 200
    data_step7 = res_step7.json()["data"]

    # Metrics update
    assert data_step7["metrics"]["active_elections"]["value"] == 1
    assert data_step7["metrics"]["total_elections"]["value"] == 2
    assert data_step7["election_status"]["total"] == 2
    assert data_step7["election_status"]["open"] == 1
    assert data_step7["election_status"]["draft"] == 1

    # Upcoming deadlines contains Election 1 closing deadline
    assert len(data_step7["upcoming_deadlines"]) >= 1
    e1_deadline = next(
        (d for d in data_step7["upcoming_deadlines"] if d["election_id"] == elec1_id),
        None,
    )
    assert e1_deadline is not None
    assert e1_deadline["deadline_type"] == "Voting Closes"
    assert e1_deadline["title"] == "Alpha Student Council Election 2026"
    assert e1_deadline["status"] == "open"

    # Recent activity contains audit event for ELECTION_OPENED
    assert len(data_step7["recent_activity"]) >= 1
    opened_event = next(
        (ev for ev in data_step7["recent_activity"] if ev["event_type"] == "ELECTION_OPENED"),
        None,
    )
    assert opened_event is not None
    assert opened_event["outcome"] == "success"
    assert opened_event["actor_email"] == "dean.alpha@alpha-university.edu"

    # -------------------------------------------------------------------------
    # STEP 8: Multi-Tenant Verification: Create Institution B & Verify Complete Isolation
    # -------------------------------------------------------------------------
    async with AsyncClient(transport=transport, base_url="http://test") as client_b:
        # Register Admin B
        reg_b = await client_b.post(
            "/api/v1/auth/register",
            json={
                "email": "dean.beta@beta-institute.edu",
                "password": "BetaAdminSecure2026!",
                "display_name": "Dean Marcus Beta",
            },
        )
        assert reg_b.status_code == 201

        login_b = await client_b.post(
            "/api/v1/auth/login",
            json={
                "email": "dean.beta@beta-institute.edu",
                "password": "BetaAdminSecure2026!",
            },
        )
        assert login_b.status_code == 200

        create_org_b = await client_b.post(
            "/api/v1/organizations",
            json={
                "name": "Beta Institute of Technology",
                "slug": "beta-institute",
            },
        )
        assert create_org_b.status_code == 201
        org_b_id = create_org_b.json()["data"]["id"]

        # Institution B summary must be 100% clean and isolated (all 0s)
        res_summary_b = await client_b.get(f"/api/v1/organizations/{org_b_id}/dashboard/summary")
        assert res_summary_b.status_code == 200
        data_b = res_summary_b.json()["data"]

        assert data_b["organization_id"] == org_b_id
        assert data_b["organization_name"] == "Beta Institute of Technology"

        # KPIs all 0
        assert data_b["metrics"]["total_elections"]["value"] == 0
        assert data_b["metrics"]["total_elections"]["change_pct"] is None
        assert data_b["metrics"]["eligible_voters"]["value"] == 0
        assert data_b["metrics"]["eligible_voters"]["change_pct"] is None
        assert data_b["metrics"]["registered_candidates"]["value"] == 0
        assert data_b["metrics"]["registered_candidates"]["change_pct"] is None
        assert data_b["metrics"]["active_elections"]["value"] == 0
        assert data_b["metrics"]["active_elections"]["change_pct"] is None

        # Donut total 0
        assert data_b["election_status"]["total"] == 0
        assert data_b["election_status"]["draft"] == 0
        assert data_b["election_status"]["scheduled"] == 0
        assert data_b["election_status"]["open"] == 0
        assert data_b["election_status"]["closed"] == 0
        assert data_b["election_status"]["published"] == 0
        assert data_b["election_status"]["canceled"] == 0

        # Deadlines and activity empty
        assert data_b["upcoming_deadlines"] == []
        assert data_b["recent_activity"] == []

        # Chart buckets all 0
        assert len(data_b["election_overview"]["points"]) == 12
        for pt in data_b["election_overview"]["points"]:
            assert pt["created"] == 0
            assert pt["closed"] == 0
            assert pt["published"] == 0

        # Multi-Tenant RBAC Cross-Access Verification:
        # Client B must NOT be able to access Institution A's summary -> 403 Forbidden
        cross_res_a = await client_b.get(f"/api/v1/organizations/{org_a_id}/dashboard/summary")
        assert cross_res_a.status_code == 403
        assert cross_res_a.json()["error"]["code"] == "FORBIDDEN"

        # Client A must NOT be able to access Institution B's summary -> 403 Forbidden
        cross_res_b = await test_client.get(f"/api/v1/organizations/{org_b_id}/dashboard/summary")
        assert cross_res_b.status_code == 403
        assert cross_res_b.json()["error"]["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_dashboard_e2e_candidate_withdrawal_and_voter_revocation(test_client: AsyncClient):
    """Dynamic metric updates: candidate withdrawal decrements candidate count, voter revocation decrements voter count."""
    # Register Dean & Org
    await test_client.post(
        "/api/v1/auth/register",
        json={
            "email": "dean.gamma@gamma-poly.edu",
            "password": "GammaPassword2026!",
            "display_name": "Dean Gamma",
        },
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "dean.gamma@gamma-poly.edu", "password": "GammaPassword2026!"},
    )
    org_res = await test_client.post(
        "/api/v1/organizations",
        json={"name": "Gamma Polytechnic", "slug": "gamma-poly"},
    )
    org_id = org_res.json()["data"]["id"]

    # Create Election
    elec_res = await test_client.post(
        "/api/v1/elections",
        json={
            "organization_id": org_id,
            "title": "Gamma Faculty Election 2026",
            "timezone": "UTC",
        },
    )
    elec_id = elec_res.json()["data"]["id"]

    # Create Position & 2 Candidates
    pos_res = await test_client.post(
        f"/api/v1/elections/{elec_id}/positions",
        json={"title": "Chairperson", "display_order": 0},
    )
    pos_id = pos_res.json()["data"]["id"]

    c1_res = await test_client.post(
        f"/api/v1/positions/{pos_id}/candidates",
        json={"name": "Candidate Alpha", "display_order": 0},
    )
    c1_id = c1_res.json()["data"]["id"]

    c2_res = await test_client.post(
        f"/api/v1/positions/{pos_id}/candidates",
        json={"name": "Candidate Beta", "display_order": 1},
    )

    # Initial check: registered_candidates == 2
    res1 = await test_client.get(f"/api/v1/organizations/{org_id}/dashboard/summary")
    assert res1.json()["data"]["metrics"]["registered_candidates"]["value"] == 2

    # Withdraw Candidate Alpha
    withdraw_res = await test_client.patch(
        f"/api/v1/candidates/{c1_id}",
        json={"status": "withdrawn"},
    )
    assert withdraw_res.status_code == 200

    # Metric check: registered_candidates decrements to 1 (only active candidates count)
    res2 = await test_client.get(f"/api/v1/organizations/{org_id}/dashboard/summary")
    assert res2.json()["data"]["metrics"]["registered_candidates"]["value"] == 1

    # Register 2 voters and add eligibility
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as reg_client:
        await reg_client.post(
            "/api/v1/auth/register",
            json={"email": "voterA@gamma-poly.edu", "password": "Password123!", "display_name": "Voter A"},
        )
        await reg_client.post(
            "/api/v1/auth/register",
            json={"email": "voterB@gamma-poly.edu", "password": "Password123!", "display_name": "Voter B"},
        )

    elA_res = await test_client.post(
        f"/api/v1/elections/{elec_id}/eligibility",
        json={"email": "voterA@gamma-poly.edu"},
    )
    assert elA_res.status_code == 201
    elA_id = elA_res.json()["data"]["id"]

    elB_res = await test_client.post(
        f"/api/v1/elections/{elec_id}/eligibility",
        json={"email": "voterB@gamma-poly.edu"},
    )
    assert elB_res.status_code == 201

    res3 = await test_client.get(f"/api/v1/organizations/{org_id}/dashboard/summary")
    assert res3.json()["data"]["metrics"]["eligible_voters"]["value"] == 2

    # Revoke Voter A's eligibility
    revoke_res = await test_client.delete(f"/api/v1/elections/{elec_id}/eligibility/{elA_id}")
    assert revoke_res.status_code == 204

    # Metric check: eligible_voters decrements to 1 (revoked voter no longer counted)
    res4 = await test_client.get(f"/api/v1/organizations/{org_id}/dashboard/summary")
    assert res4.json()["data"]["metrics"]["eligible_voters"]["value"] == 1


@pytest.mark.asyncio
async def test_dashboard_e2e_period_query_filtering(test_client: AsyncClient):
    """Period query parameter propagation and bucket structure in end-to-end integration."""
    await test_client.post(
        "/api/v1/auth/register",
        json={
            "email": "dean.delta@delta-academy.edu",
            "password": "DeltaPassword2026!",
            "display_name": "Dean Delta",
        },
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "dean.delta@delta-academy.edu", "password": "DeltaPassword2026!"},
    )
    org_res = await test_client.post(
        "/api/v1/organizations",
        json={"name": "Delta Academy", "slug": "delta-academy"},
    )
    org_id = org_res.json()["data"]["id"]

    # 1. 30 days period
    res_30d = await test_client.get(f"/api/v1/organizations/{org_id}/dashboard/summary?period=last_30_days")
    assert res_30d.status_code == 200
    assert res_30d.json()["data"]["period"] == "last_30_days"
    assert len(res_30d.json()["data"]["election_overview"]["points"]) == 30

    # 2. 3 months period
    res_3m = await test_client.get(f"/api/v1/organizations/{org_id}/dashboard/summary?period=last_3_months")
    assert res_3m.status_code == 200
    assert res_3m.json()["data"]["period"] == "last_3_months"
    assert len(res_3m.json()["data"]["election_overview"]["points"]) == 3

    # 3. 6 months period
    res_6m = await test_client.get(f"/api/v1/organizations/{org_id}/dashboard/summary?period=last_6_months")
    assert res_6m.status_code == 200
    assert res_6m.json()["data"]["period"] == "last_6_months"
    assert len(res_6m.json()["data"]["election_overview"]["points"]) == 6

    # 4. Default / 12 months period
    res_12m = await test_client.get(f"/api/v1/organizations/{org_id}/dashboard/summary?period=last_12_months")
    assert res_12m.status_code == 200
    assert res_12m.json()["data"]["period"] == "last_12_months"
    assert len(res_12m.json()["data"]["election_overview"]["points"]) == 12

    # 5. Invalid query parameter defaults safely to last_12_months
    res_invalid = await test_client.get(f"/api/v1/organizations/{org_id}/dashboard/summary?period=unknown_foo")
    assert res_invalid.status_code == 200
    assert res_invalid.json()["data"]["period"] == "last_12_months"
    assert len(res_invalid.json()["data"]["election_overview"]["points"]) == 12


import json
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.election import Candidate, Election, ElectionApproval, ElectionResult, Position
from app.models.identity import Organization, OrganizationMembership, User


@pytest.mark.asyncio
async def test_reports_api_lifecycle(
    test_client: AsyncClient,
    test_identity_session: AsyncSession,
    test_election_session: AsyncSession,
):
    # 1. Setup Admin and Organization
    admin = User(
        id=uuid.uuid4(),
        email_normalized="election.officer@polytechnic.edu",
        password_hash=hash_password("OfficerSecure123!"),
        display_name="Chief Electoral Officer",
        email_verified_at=datetime.now(UTC),
        account_status="active",
    )
    org = Organization(
        id=uuid.uuid4(),
        name="Engineering Faculty",
        slug="engineering-faculty",
        status="active",
    )
    test_identity_session.add_all([admin, org])
    await test_identity_session.flush()

    membership = OrganizationMembership(
        organization_id=org.id,
        user_id=admin.id,
        role="organization_admin",
        status="active",
    )
    test_identity_session.add(membership)
    await test_identity_session.flush()

    # 2. Setup Election
    election_id = uuid.uuid4()
    pos_id = uuid.uuid4()
    cand1_id = uuid.uuid4()

    election = Election(
        id=election_id,
        organization_id=org.id,
        title="Engineering Student Council 2026",
        status="published",
        opens_at=datetime.now(UTC) - timedelta(days=2),
        closes_at=datetime.now(UTC) - timedelta(hours=2),
        timezone="UTC",
        configuration_version=1,
        configuration_hash="f" * 64,
        created_by=admin.id,
    )
    pos = Position(
        id=pos_id,
        election_id=election_id,
        title="Department Chair",
        max_selections=1,
        min_selections=1,
        display_order=0,
    )
    cand1 = Candidate(
        id=cand1_id,
        position_id=pos_id,
        name="Jane Doe",
        display_order=0,
        status="active",
    )
    test_election_session.add_all([election, pos, cand1])

    # Add Result
    result_payload = {
        "election_id": str(election_id),
        "configuration_hash": election.configuration_hash,
        "total_ballots": 42,
        "positions": [
            {
                "position_id": str(pos_id),
                "title": "Department Chair",
                "total_votes": 42,
                "abstain_count": 0,
                "candidates": [{"candidate_id": str(cand1_id), "name": "Jane Doe", "votes": 42, "percentage": 100.0}],
                "winner_ids": [str(cand1_id)],
            }
        ],
    }
    result = ElectionResult(
        id=uuid.uuid4(),
        election_id=election_id,
        result_version=1,
        configuration_hash=election.configuration_hash,
        tally_algorithm_version="1.0",
        ballot_count=42,
        result_data=json.dumps(result_payload),
        computed_at=datetime.now(UTC),
        computed_by="system",
        approval_status="approved",
        published_at=datetime.now(UTC),
    )
    approval = ElectionApproval(
        id=uuid.uuid4(),
        election_id=election_id,
        approval_type="publication",
        approver_actor_id=admin.id,
        decision="approved",
        reason="Results certified by Board",
        created_at=datetime.now(UTC),
    )
    test_election_session.add_all([result, approval])
    await test_election_session.commit()

    # Login Admin
    login_resp = await test_client.post(
        "/api/v1/auth/login",
        json={"email": "election.officer@polytechnic.edu", "password": "OfficerSecure123!"},
    )
    assert login_resp.status_code == 200

    # 3. Test Generate Certified Results Report (POST)
    gen_resp = await test_client.post(
        f"/api/v1/elections/{election_id}/reports/generate",
        json={"report_type": "certified_results", "file_format": "csv"},
    )
    assert gen_resp.status_code == 200
    gen_data = gen_resp.json()["data"]
    assert gen_data["report"]["report_type"] == "certified_results"
    assert gen_data["report"]["file_format"] == "csv"
    assert gen_data["report"]["checksum"] is not None
    assert "download_url" in gen_data

    # 4. Test List Reports (GET)
    list_resp = await test_client.get(f"/api/v1/elections/{election_id}/reports")
    assert list_resp.status_code == 200
    list_data = list_resp.json()["data"]
    assert list_data["total_count"] >= 1
    assert any(r["report_type"] == "certified_results" for r in list_data["items"])

    # 5. Test Direct Streaming Export (GET)
    export_resp = await test_client.get(
        f"/api/v1/elections/{election_id}/reports/export?report_type=certified_results&format=csv"
    )
    assert export_resp.status_code == 200
    assert "text/csv" in export_resp.headers.get("content-type", "")
    assert "attachment" in export_resp.headers.get("content-disposition", "")
    content = export_resp.text
    assert "Engineering Student Council 2026" in content
    assert "Jane Doe" in content
    assert "YES" in content

    # 6. Test Direct Results Export Endpoint
    res_export = await test_client.get(f"/api/v1/elections/{election_id}/results/export?format=csv")
    assert res_export.status_code == 200
    assert "attachment" in res_export.headers.get("content-disposition", "")

    # 7. Test Audit Trail & Turnout Reports
    audit_resp = await test_client.get(
        f"/api/v1/elections/{election_id}/reports/export?report_type=audit_trail&format=csv"
    )
    assert audit_resp.status_code == 200
    assert "POLLWISE AUDIT TRAIL REPORT" in audit_resp.text

    turnout_resp = await test_client.get(
        f"/api/v1/elections/{election_id}/reports/export?report_type=turnout&format=csv"
    )
    assert turnout_resp.status_code == 200
    assert "POLLWISE VOTER PARTICIPATION & TURNOUT REPORT" in turnout_resp.text

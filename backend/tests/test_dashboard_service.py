from datetime import UTC, datetime, timedelta
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException, ErrorCode
from app.models.election import (
    AuditEvent,
    Candidate,
    Election,
    ElectionResult,
    ElectionStatus,
    Position,
)
from app.models.identity import (
    AccountStatus,
    ElectionEligibility,
    EligibilityStatus,
    Organization,
    User,
)
from app.schemas.dashboard import DashboardSummaryResponse
from app.services.dashboard_service import DashboardService


@pytest.mark.asyncio
async def test_get_institution_summary_org_not_found(
    test_identity_session: AsyncSession,
    test_election_session: AsyncSession,
):
    missing_org_id = uuid.uuid4()
    with pytest.raises(AppException) as exc_info:
        await DashboardService.get_institution_summary(
            identity_db=test_identity_session,
            election_db=test_election_session,
            organization_id=missing_org_id,
        )
    assert exc_info.value.code == ErrorCode.NOT_FOUND
    assert "Organization not found" in exc_info.value.message


@pytest.mark.asyncio
async def test_get_institution_summary_empty_institution(
    test_identity_session: AsyncSession,
    test_election_session: AsyncSession,
):
    org = Organization(
        id=uuid.uuid4(),
        name="Empty State University",
        slug="empty-state-u",
        status="active",
    )
    test_identity_session.add(org)
    await test_identity_session.commit()

    summary = await DashboardService.get_institution_summary(
        identity_db=test_identity_session,
        election_db=test_election_session,
        organization_id=org.id,
    )

    assert isinstance(summary, DashboardSummaryResponse)
    assert summary.organization_id == org.id
    assert summary.organization_name == "Empty State University"
    assert summary.period == "last_12_months"

    # Zero-fake-data policy assertions
    assert summary.metrics.total_elections.value == 0
    assert summary.metrics.total_elections.change_pct is None
    assert summary.metrics.eligible_voters.value == 0
    assert summary.metrics.eligible_voters.change_pct is None
    assert summary.metrics.registered_candidates.value == 0
    assert summary.metrics.registered_candidates.change_pct is None
    assert summary.metrics.active_elections.value == 0
    assert summary.metrics.active_elections.change_pct is None

    # Donut counts
    assert summary.election_status.total == 0
    assert summary.election_status.draft == 0
    assert summary.election_status.scheduled == 0
    assert summary.election_status.open == 0
    assert summary.election_status.closed == 0
    assert summary.election_status.published == 0
    assert summary.election_status.canceled == 0

    # Lists
    assert summary.upcoming_deadlines == []
    assert summary.recent_activity == []

    # Overview points (12 monthly buckets for default last_12_months)
    assert len(summary.election_overview.points) == 12
    for pt in summary.election_overview.points:
        assert pt.created == 0
        assert pt.closed == 0
        assert pt.published == 0


@pytest.mark.asyncio
async def test_get_institution_summary_populated(
    test_identity_session: AsyncSession,
    test_election_session: AsyncSession,
):
    now = datetime.now(UTC)

    # 1. Institutions
    org = Organization(
        id=uuid.uuid4(),
        name="Faculty of Science",
        slug="faculty-science",
        status="active",
    )
    other_org = Organization(
        id=uuid.uuid4(),
        name="Faculty of Arts",
        slug="faculty-arts",
        status="active",
    )
    test_identity_session.add_all([org, other_org])

    # 2. Users in identity_db
    u1 = User(
        id=uuid.uuid4(),
        email_normalized="alice@science.edu",
        password_hash="pw_hash_alice",
        display_name="Alice Dean",
        account_status=AccountStatus.ACTIVE.value,
    )
    u2 = User(
        id=uuid.uuid4(),
        email_normalized="bob@science.edu",
        password_hash="pw_hash_bob",
        display_name="Bob Student",
        account_status=AccountStatus.ACTIVE.value,
    )
    u3 = User(
        id=uuid.uuid4(),
        email_normalized="charlie@science.edu",
        password_hash="pw_hash_charlie",
        display_name="Charlie Excluded",
        account_status=AccountStatus.ACTIVE.value,
    )
    u_other = User(
        id=uuid.uuid4(),
        email_normalized="dave@arts.edu",
        password_hash="pw_hash_dave",
        display_name="Dave Arts",
        account_status=AccountStatus.ACTIVE.value,
    )
    test_identity_session.add_all([u1, u2, u3, u_other])
    await test_identity_session.commit()

    # 3. Elections in election_db
    # e1: OPEN with closing in 2 days
    e1 = Election(
        id=uuid.uuid4(),
        organization_id=org.id,
        title="Dean Student Council 2026",
        status=ElectionStatus.OPEN,
        opens_at=now - timedelta(days=1),
        closes_at=now + timedelta(days=2),
        created_by=u1.id,
        created_at=now - timedelta(days=2),
    )
    # e2: SCHEDULED with opens in 3 days, closes in 7 days
    e2 = Election(
        id=uuid.uuid4(),
        organization_id=org.id,
        title="Department Rep 2026",
        status=ElectionStatus.SCHEDULED,
        opens_at=now + timedelta(days=3),
        closes_at=now + timedelta(days=7),
        created_by=u1.id,
        created_at=now - timedelta(days=5),
    )
    # e3: DRAFT with opens in 10 days
    e3 = Election(
        id=uuid.uuid4(),
        organization_id=org.id,
        title="Bylaw Amendment Referendum",
        status=ElectionStatus.DRAFT,
        opens_at=now + timedelta(days=10),
        created_by=u1.id,
        created_at=now - timedelta(days=1),
    )
    # e4: PUBLISHED election with published result
    e4 = Election(
        id=uuid.uuid4(),
        organization_id=org.id,
        title="Fall Term Quick Poll",
        status=ElectionStatus.PUBLISHED,
        opens_at=now - timedelta(days=30),
        closes_at=now - timedelta(days=15),
        created_by=u1.id,
        created_at=now - timedelta(days=32),
    )
    # e_other: Other org's election (must not leak)
    e_other = Election(
        id=uuid.uuid4(),
        organization_id=other_org.id,
        title="Arts Council Election",
        status=ElectionStatus.OPEN,
        opens_at=now - timedelta(days=1),
        closes_at=now + timedelta(days=4),
        created_by=u_other.id,
        created_at=now - timedelta(days=2),
    )
    test_election_session.add_all([e1, e2, e3, e4, e_other])

    # 4. Positions & Candidates in election_db
    pos1 = Position(id=uuid.uuid4(), election_id=e1.id, title="Council Chair")
    pos2 = Position(id=uuid.uuid4(), election_id=e2.id, title="Department Rep")
    pos_other = Position(id=uuid.uuid4(), election_id=e_other.id, title="Arts Chair")
    test_election_session.add_all([pos1, pos2, pos_other])

    # 2 active candidates in org.id, 1 withdrawn in org.id, 1 active candidate in other_org
    cand1 = Candidate(id=uuid.uuid4(), position_id=pos1.id, name="Candidate Alpha", status="active")
    cand2 = Candidate(id=uuid.uuid4(), position_id=pos1.id, name="Candidate Beta", status="withdrawn")
    cand3 = Candidate(id=uuid.uuid4(), position_id=pos2.id, name="Candidate Gamma", status="active")
    cand_other = Candidate(id=uuid.uuid4(), position_id=pos_other.id, name="Arts Cand", status="active")
    test_election_session.add_all([cand1, cand2, cand3, cand_other])

    # 5. Election Result with published_at for e4
    result4 = ElectionResult(
        id=uuid.uuid4(),
        election_id=e4.id,
        configuration_hash="hash4",
        computed_by="system",
        result_data="{}",
        approval_status="approved",
        published_at=now - timedelta(days=14),
    )
    test_election_session.add(result4)

    # 6. Audit Events in election_db
    ev1 = AuditEvent(
        id=uuid.uuid4(),
        organization_id=org.id,
        election_id=e1.id,
        actor_id=u1.id,
        event_type="ELECTION_OPENED",
        outcome="success",
        metadata_json='{"description": "Voting has commenced for Student Council"}',
        created_at=now - timedelta(hours=2),
    )
    ev2 = AuditEvent(
        id=uuid.uuid4(),
        organization_id=org.id,
        election_id=None,
        actor_id=u2.id,
        event_type="ORGANIZATION_SETTINGS_UPDATED",
        outcome="success",
        metadata_json='{"description": "Institution contact email updated"}',
        created_at=now - timedelta(hours=1),
    )
    ev_other = AuditEvent(
        id=uuid.uuid4(),
        organization_id=other_org.id,
        election_id=e_other.id,
        actor_id=u_other.id,
        event_type="ELECTION_CREATED",
        outcome="success",
        metadata_json='{"description": "Other org event"}',
        created_at=now,
    )
    test_election_session.add_all([ev1, ev2, ev_other])
    await test_election_session.commit()

    # 7. Voter Eligibilities in identity_db
    # u1 is eligible for both e1 and e2 -> should deduplicate to 1
    ee1 = ElectionEligibility(
        id=uuid.uuid4(),
        election_id=e1.id,
        user_id=u1.id,
        eligibility_status=EligibilityStatus.ELIGIBLE.value,
    )
    ee2 = ElectionEligibility(
        id=uuid.uuid4(),
        election_id=e2.id,
        user_id=u1.id,
        eligibility_status=EligibilityStatus.ELIGIBLE.value,
    )
    # u2 is eligible for e1
    ee3 = ElectionEligibility(
        id=uuid.uuid4(),
        election_id=e1.id,
        user_id=u2.id,
        eligibility_status=EligibilityStatus.ELIGIBLE.value,
    )
    # u3 is revoked on e1 -> must NOT count
    ee4 = ElectionEligibility(
        id=uuid.uuid4(),
        election_id=e1.id,
        user_id=u3.id,
        eligibility_status=EligibilityStatus.REVOKED.value,
    )
    # u_other is eligible on e_other -> must NOT count
    ee_other = ElectionEligibility(
        id=uuid.uuid4(),
        election_id=e_other.id,
        user_id=u_other.id,
        eligibility_status=EligibilityStatus.ELIGIBLE.value,
    )
    test_identity_session.add_all([ee1, ee2, ee3, ee4, ee_other])
    await test_identity_session.commit()

    # Execute service call
    summary = await DashboardService.get_institution_summary(
        identity_db=test_identity_session,
        election_db=test_election_session,
        organization_id=org.id,
        period="last_12_months",
    )

    # 8. Assertions
    # Metrics
    assert summary.metrics.total_elections.value == 4
    assert summary.metrics.active_elections.value == 1
    assert summary.metrics.registered_candidates.value == 2  # cand1 and cand3 (active only)
    assert summary.metrics.eligible_voters.value == 2  # u1 and u2 deduplicated, u3 revoked excluded

    # Donut counts (e1: open, e2: scheduled, e3: draft, e4: published)
    assert summary.election_status.total == 4
    assert summary.election_status.open == 1
    assert summary.election_status.scheduled == 1
    assert summary.election_status.draft == 1
    assert summary.election_status.published == 1
    assert summary.election_status.closed == 0
    assert summary.election_status.canceled == 0

    # Upcoming Deadlines:
    # Milestones expected (> now):
    # - e1 closes_at (now + 2 days): "Voting Closes"
    # - e2 opens_at (now + 3 days): "Voting Starts"
    # - e2 closes_at (now + 7 days): "Voting Closes"
    # - e3 opens_at (now + 10 days): "Voting Starts"
    assert len(summary.upcoming_deadlines) == 4
    assert summary.upcoming_deadlines[0].election_id == e1.id
    assert summary.upcoming_deadlines[0].deadline_type == "Voting Closes"
    assert summary.upcoming_deadlines[1].election_id == e2.id
    assert summary.upcoming_deadlines[1].deadline_type == "Voting Starts"
    assert summary.upcoming_deadlines[2].election_id == e2.id
    assert summary.upcoming_deadlines[2].deadline_type == "Voting Closes"
    assert summary.upcoming_deadlines[3].election_id == e3.id
    assert summary.upcoming_deadlines[3].deadline_type == "Voting Starts"

    # Sorted ascending by deadline_at
    for i in range(len(summary.upcoming_deadlines) - 1):
        assert summary.upcoming_deadlines[i].deadline_at <= summary.upcoming_deadlines[i + 1].deadline_at

    # Recent Activity:
    # 2 events for org.id, descending order
    assert len(summary.recent_activity) == 2
    assert summary.recent_activity[0].id == ev2.id
    assert summary.recent_activity[0].actor_email == "bob@science.edu"
    assert summary.recent_activity[0].description == "Institution contact email updated"
    assert summary.recent_activity[1].id == ev1.id
    assert summary.recent_activity[1].actor_email == "alice@science.edu"
    assert summary.recent_activity[1].description == "Voting has commenced for Student Council"


@pytest.mark.asyncio
async def test_get_institution_summary_periods(
    test_identity_session: AsyncSession,
    test_election_session: AsyncSession,
):
    org = Organization(
        id=uuid.uuid4(),
        name="Period Test Org",
        slug="period-test-org",
        status="active",
    )
    test_identity_session.add(org)
    await test_identity_session.commit()

    # Test last_30_days
    summary_30d = await DashboardService.get_institution_summary(
        identity_db=test_identity_session,
        election_db=test_election_session,
        organization_id=org.id,
        period="last_30_days",
    )
    assert summary_30d.period == "last_30_days"
    assert len(summary_30d.election_overview.points) == 30
    for i in range(len(summary_30d.election_overview.points) - 1):
        assert summary_30d.election_overview.points[i].timestamp < summary_30d.election_overview.points[i + 1].timestamp

    # Test last_3_months
    summary_3m = await DashboardService.get_institution_summary(
        identity_db=test_identity_session,
        election_db=test_election_session,
        organization_id=org.id,
        period="last_3_months",
    )
    assert summary_3m.period == "last_3_months"
    assert len(summary_3m.election_overview.points) == 3

    # Test last_6_months
    summary_6m = await DashboardService.get_institution_summary(
        identity_db=test_identity_session,
        election_db=test_election_session,
        organization_id=org.id,
        period="last_6_months",
    )
    assert summary_6m.period == "last_6_months"
    assert len(summary_6m.election_overview.points) == 6

    # Test last_12_months
    summary_12m = await DashboardService.get_institution_summary(
        identity_db=test_identity_session,
        election_db=test_election_session,
        organization_id=org.id,
        period="last_12_months",
    )
    assert summary_12m.period == "last_12_months"
    assert len(summary_12m.election_overview.points) == 12


@pytest.mark.asyncio
async def test_get_institution_summary_deadline_limit_and_donut_statuses(
    test_identity_session: AsyncSession,
    test_election_session: AsyncSession,
):
    now = datetime.now(UTC)
    org = Organization(
        id=uuid.uuid4(),
        name="Tech Institute",
        slug="tech-inst",
        status="active",
    )
    test_identity_session.add(org)
    await test_identity_session.commit()

    admin_user_id = uuid.uuid4()

    # Create 6 open elections, each with future closes_at
    # This generates 6 upcoming deadlines (> 5), testing limit 5
    for i in range(6):
        e = Election(
            id=uuid.uuid4(),
            organization_id=org.id,
            title=f"Open Election {i}",
            status=ElectionStatus.OPEN,
            opens_at=now - timedelta(days=1),
            closes_at=now + timedelta(days=i + 1),
            created_by=admin_user_id,
        )
        test_election_session.add(e)

    # Add 1 tallied election and 1 canceled election to check donut counts
    e_tallied = Election(
        id=uuid.uuid4(),
        organization_id=org.id,
        title="Tallied Election",
        status=ElectionStatus.TALLIED,
        created_by=admin_user_id,
    )
    e_canceled = Election(
        id=uuid.uuid4(),
        organization_id=org.id,
        title="Canceled Election",
        status=ElectionStatus.CANCELED,
        created_by=admin_user_id,
    )
    test_election_session.add_all([e_tallied, e_canceled])

    # Add an audit event without description in metadata to verify fallback description
    ev_fallback = AuditEvent(
        id=uuid.uuid4(),
        organization_id=org.id,
        election_id=None,
        actor_id=None,
        event_type="ORGANIZATION_DOMAIN_VERIFIED",
        outcome="success",
        metadata_json='{"title": "tech.edu"}',
        created_at=now,
    )
    test_election_session.add(ev_fallback)
    await test_election_session.commit()

    summary = await DashboardService.get_institution_summary(
        identity_db=test_identity_session,
        election_db=test_election_session,
        organization_id=org.id,
    )

    # 6 open + 1 tallied + 1 canceled = 8 elections
    assert summary.metrics.total_elections.value == 8
    assert summary.metrics.active_elections.value == 6
    assert summary.election_status.total == 8
    assert summary.election_status.open == 6
    assert summary.election_status.closed == 1  # tallied counts as closed
    assert summary.election_status.canceled == 1

    # Upcoming deadlines must be limited to 5
    assert len(summary.upcoming_deadlines) == 5
    for i in range(4):
        assert summary.upcoming_deadlines[i].deadline_at <= summary.upcoming_deadlines[i + 1].deadline_at

    # Audit event fallback description
    assert len(summary.recent_activity) == 1
    assert summary.recent_activity[0].description == "Organization Domain Verified: tech.edu"
    assert summary.recent_activity[0].actor_email is None


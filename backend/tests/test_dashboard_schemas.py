from datetime import datetime, timezone
import uuid
import pytest
from pydantic import ValidationError

from app.schemas.dashboard import (
    ChartDataPoint,
    DashboardMetrics,
    DashboardSummaryResponse,
    ElectionOverviewChart,
    ElectionStatusDonut,
    KPIMetric,
    RecentActivityItem,
    UpcomingDeadlineItem,
)


def test_kpi_metric_initialization():
    m = KPIMetric(value=42)
    assert m.value == 42
    assert m.change_pct is None

    m_with_pct = KPIMetric(value=100, change_pct=15.5)
    assert m_with_pct.value == 100
    assert m_with_pct.change_pct == 15.5


def test_chart_data_point_defaults():
    now = datetime.now(timezone.utc)
    dp = ChartDataPoint(label="Week 1", timestamp=now)
    assert dp.label == "Week 1"
    assert dp.timestamp == now
    assert dp.created == 0
    assert dp.closed == 0
    assert dp.published == 0

    dp_custom = ChartDataPoint(
        label="Week 2",
        timestamp=now,
        created=5,
        closed=3,
        published=2,
    )
    assert dp_custom.created == 5
    assert dp_custom.closed == 3
    assert dp_custom.published == 2


def test_election_status_donut_defaults():
    donut = ElectionStatusDonut(total=10)
    assert donut.total == 10
    assert donut.draft == 0
    assert donut.scheduled == 0
    assert donut.open == 0
    assert donut.closed == 0
    assert donut.published == 0
    assert donut.canceled == 0

    donut_custom = ElectionStatusDonut(
        total=7,
        draft=1,
        scheduled=1,
        open=2,
        closed=1,
        published=1,
        canceled=1,
    )
    assert donut_custom.total == 7
    assert donut_custom.draft == 1
    assert donut_custom.scheduled == 1
    assert donut_custom.open == 2
    assert donut_custom.closed == 1
    assert donut_custom.published == 1
    assert donut_custom.canceled == 1


def test_upcoming_deadline_item():
    election_id = uuid.uuid4()
    deadline = datetime.now(timezone.utc)
    item = UpcomingDeadlineItem(
        election_id=election_id,
        title="Student Council 2026",
        deadline_type="voting_close",
        deadline_at=deadline,
        status="open",
    )
    assert item.election_id == election_id
    assert item.title == "Student Council 2026"
    assert item.deadline_type == "voting_close"
    assert item.deadline_at == deadline
    assert item.status == "open"


def test_recent_activity_item_defaults():
    activity_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    activity = RecentActivityItem(
        id=activity_id,
        event_type="election_created",
        description="Election created by admin",
        timestamp=now,
    )
    assert activity.id == activity_id
    assert activity.event_type == "election_created"
    assert activity.description == "Election created by admin"
    assert activity.timestamp == now
    assert activity.outcome == "success"
    assert activity.actor_email is None

    activity_custom = RecentActivityItem(
        id=activity_id,
        event_type="ballot_cast",
        description="Voter cast ballot",
        timestamp=now,
        outcome="failure",
        actor_email="admin@pollwise.io",
    )
    assert activity_custom.outcome == "failure"
    assert activity_custom.actor_email == "admin@pollwise.io"


def test_dashboard_summary_response_serialization_and_deserialization():
    org_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    election_id = uuid.uuid4()
    act_id = uuid.uuid4()

    summary = DashboardSummaryResponse(
        organization_id=org_id,
        organization_name="Apex University",
        period="30d",
        metrics=DashboardMetrics(
            total_elections=KPIMetric(value=12, change_pct=20.0),
            eligible_voters=KPIMetric(value=1500, change_pct=-2.5),
            registered_candidates=KPIMetric(value=45, change_pct=0.0),
            active_elections=KPIMetric(value=3, change_pct=50.0),
        ),
        election_overview=ElectionOverviewChart(
            period="30d",
            points=[
                ChartDataPoint(
                    label="Oct 1",
                    timestamp=now,
                    created=2,
                    closed=1,
                    published=1,
                )
            ],
        ),
        election_status=ElectionStatusDonut(
            total=12,
            draft=2,
            scheduled=1,
            open=3,
            closed=4,
            published=2,
            canceled=0,
        ),
        upcoming_deadlines=[
            UpcomingDeadlineItem(
                election_id=election_id,
                title="Dean Election",
                deadline_type="registration_close",
                deadline_at=now,
                status="scheduled",
            )
        ],
        recent_activity=[
            RecentActivityItem(
                id=act_id,
                event_type="election_published",
                description="Results published for Dean Election",
                timestamp=now,
                outcome="success",
                actor_email="provost@apex.edu",
            )
        ],
    )

    data_dict = summary.model_dump()
    assert data_dict["organization_id"] == org_id
    assert data_dict["organization_name"] == "Apex University"
    assert data_dict["period"] == "30d"
    assert data_dict["metrics"]["total_elections"]["value"] == 12
    assert len(data_dict["election_overview"]["points"]) == 1
    assert data_dict["election_status"]["open"] == 3
    assert len(data_dict["upcoming_deadlines"]) == 1
    assert len(data_dict["recent_activity"]) == 1

    # Round-trip via JSON
    json_str = summary.model_dump_json()
    parsed = DashboardSummaryResponse.model_validate_json(json_str)
    assert parsed.organization_id == org_id
    assert parsed.metrics.total_elections.value == 12
    assert parsed.upcoming_deadlines[0].title == "Dean Election"


def test_dashboard_summary_validation_error_on_missing_fields():
    with pytest.raises(ValidationError):
        DashboardSummaryResponse(
            organization_id=uuid.uuid4(),
            organization_name="Incomplete Org",
            period="30d",
            # missing metrics, overview, status, etc.
        )

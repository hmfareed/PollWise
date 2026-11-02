import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class KPIMetric(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    value: int = Field(..., description="Current value of the KPI metric")
    change_pct: float | None = Field(
        default=None,
        description="Percentage change relative to the preceding comparison period",
    )


class DashboardMetrics(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_elections: KPIMetric = Field(..., description="Total elections created or managed")
    eligible_voters: KPIMetric = Field(..., description="Total eligible voters across institution")
    registered_candidates: KPIMetric = Field(
        ..., description="Total registered candidates across elections"
    )
    active_elections: KPIMetric = Field(..., description="Currently active elections")


class ChartDataPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    label: str = Field(..., description="Display label for the time bucket (e.g. date or bucket name)")
    timestamp: datetime = Field(..., description="Bucket starting timestamp in UTC")
    created: int = Field(default=0, description="Elections created in this bucket")
    closed: int = Field(default=0, description="Elections closed in this bucket")
    published: int = 0


class ElectionOverviewChart(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    period: str = Field(..., description="Timespan filter period, e.g. '7d', '30d', '90d', '1y'")
    points: list[ChartDataPoint] = Field(
        default_factory=list, description="Ordered time series data points"
    )


class ElectionStatusDonut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total: int = Field(..., description="Total elections in the institution")
    draft: int = Field(default=0, description="Count of elections in draft status")
    scheduled: int = Field(default=0, description="Count of scheduled elections")
    open: int = Field(default=0, description="Count of open (voting in progress) elections")
    closed: int = Field(default=0, description="Count of closed elections")
    published: int = Field(default=0, description="Count of published elections")
    canceled: int = Field(default=0, description="Count of canceled elections")


class UpcomingDeadlineItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    election_id: uuid.UUID = Field(..., description="Identifier of the target election")
    title: str = Field(..., description="Title of the election")
    deadline_type: str = Field(
        ...,
        description="Type of deadline (e.g., 'opens_at', 'closes_at', 'registration_closes')",
    )
    deadline_at: datetime = Field(..., description="Exact deadline timestamp in UTC")
    status: str = Field(..., description="Current status of the election")


class RecentActivityItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Activity event unique identifier")
    event_type: str = Field(..., description="Action/event type key (e.g., 'election_created')")
    description: str = Field(..., description="Human-readable event summary")
    timestamp: datetime = Field(..., description="Timestamp when the event occurred in UTC")
    outcome: str = Field(default="success", description="Outcome status (e.g. 'success', 'failure')")
    actor_email: str | None = Field(
        default=None, description="Email of the actor who performed the action"
    )


class DashboardSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    organization_id: uuid.UUID = Field(..., description="Institution/Organization unique ID")
    organization_name: str = Field(..., description="Institution/Organization name")
    period: str = Field(..., description="Selected time period filter (e.g. '30d')")
    metrics: DashboardMetrics = Field(..., description="High-level KPI counters")
    election_overview: ElectionOverviewChart = Field(
        ..., description="Activity trend series over time"
    )
    election_status: ElectionStatusDonut = Field(
        ..., description="Lifecycle status distribution donut breakdown"
    )
    upcoming_deadlines: list[UpcomingDeadlineItem] = Field(
        default_factory=list, description="Immediate upcoming deadlines for elections"
    )
    recent_activity: list[RecentActivityItem] = Field(
        default_factory=list, description="Chronological log of recent institution activity"
    )

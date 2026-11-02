from datetime import UTC, datetime, timedelta
import json
from typing import Any
import uuid

from sqlalchemy import func, or_, select
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
    ElectionEligibility,
    Organization,
    User,
)
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


def ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def parse_metadata_json(metadata_json: str | None) -> dict[str, Any]:
    if not metadata_json:
        return {}
    try:
        parsed = json.loads(metadata_json)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def format_activity_description(event_type: str, metadata: dict[str, Any]) -> str:
    if isinstance(metadata.get("description"), str) and metadata["description"].strip():
        return metadata["description"].strip()

    clean_type = event_type.replace("_", " ").title()
    subject = (
        metadata.get("title")
        or metadata.get("name")
        or metadata.get("candidate_name")
        or metadata.get("position_title")
    )
    if subject:
        return f"{clean_type}: {subject}"
    return clean_type


def generate_time_buckets(
    now: datetime, period: str
) -> list[tuple[str, datetime, datetime]]:
    """Generate chronological time buckets (label, bucket_start, bucket_end) for period."""
    normalized_period = period.lower().strip()
    if normalized_period in ("last_30_days", "30d"):
        buckets = []
        today = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=UTC)
        for i in range(29, -1, -1):
            b_start = today - timedelta(days=i)
            b_end = b_start + timedelta(days=1)
            buckets.append((b_start.strftime("%b %d"), b_start, b_end))
        return buckets

    if normalized_period in ("last_3_months", "3m", "90d"):
        num_months = 3
    elif normalized_period in ("last_6_months", "6m", "180d"):
        num_months = 6
    else:  # default last_12_months, 1y, 365d, etc.
        num_months = 12

    buckets = []
    for k in range(num_months - 1, -1, -1):
        total_months = now.year * 12 + (now.month - 1) - k
        b_year = total_months // 12
        b_month = (total_months % 12) + 1
        b_start = datetime(b_year, b_month, 1, 0, 0, 0, tzinfo=UTC)

        next_total = total_months + 1
        next_year = next_total // 12
        next_month = (next_total % 12) + 1
        b_end = datetime(next_year, next_month, 1, 0, 0, 0, tzinfo=UTC)

        buckets.append((b_start.strftime("%b %Y"), b_start, b_end))
    return buckets


class DashboardService:
    """Orchestrates institutional dashboard aggregation across identity_db and election_db."""

    @classmethod
    async def get_institution_summary(
        cls,
        identity_db: AsyncSession,
        election_db: AsyncSession,
        organization_id: uuid.UUID,
        period: str = "last_12_months",
    ) -> DashboardSummaryResponse:
        now = datetime.now(UTC)

        # 1. Organization Validation
        org_stmt = select(Organization).where(Organization.id == organization_id)
        org_res = await identity_db.execute(org_stmt)
        organization = org_res.scalar_one_or_none()
        if not organization:
            raise AppException(code=ErrorCode.NOT_FOUND, message="Organization not found")

        # 2. Query Elections for this Institution
        elections_stmt = (
            select(Election)
            .where(Election.organization_id == organization_id)
            .order_by(Election.created_at.desc())
        )
        elections_res = await election_db.execute(elections_stmt)
        elections = list(elections_res.scalars().all())

        election_ids = [e.id for e in elections]
        total_elections = len(elections)

        # Status counts
        draft_count = sum(1 for e in elections if e.status == ElectionStatus.DRAFT)
        scheduled_count = sum(1 for e in elections if e.status == ElectionStatus.SCHEDULED)
        open_count = sum(1 for e in elections if e.status == ElectionStatus.OPEN)
        closed_count = sum(
            1 for e in elections if e.status in (ElectionStatus.CLOSED, ElectionStatus.TALLIED)
        )
        published_count = sum(1 for e in elections if e.status == ElectionStatus.PUBLISHED)
        canceled_count = sum(1 for e in elections if e.status == ElectionStatus.CANCELED)

        # 3. Query Candidates (only active candidates in positions belonging to this org's elections)
        if election_ids:
            cand_stmt = (
                select(func.count(Candidate.id))
                .join(Position, Candidate.position_id == Position.id)
                .where(
                    Position.election_id.in_(election_ids),
                    Candidate.status == "active",
                )
            )
            cand_res = await election_db.execute(cand_stmt)
            registered_candidates = cand_res.scalar_one() or 0
        else:
            registered_candidates = 0

        # 4. Query Eligible Voters (strictly distinct users across this institution's elections)
        if election_ids:
            voter_stmt = (
                select(func.count(func.distinct(ElectionEligibility.user_id)))
                .where(
                    ElectionEligibility.election_id.in_(election_ids),
                    ElectionEligibility.eligibility_status == "eligible",
                )
            )
            voter_res = await identity_db.execute(voter_stmt)
            eligible_voters = voter_res.scalar_one() or 0
        else:
            eligible_voters = 0

        # 5. Election Results publication mapping
        if election_ids:
            res_stmt = select(ElectionResult.election_id, ElectionResult.published_at).where(
                ElectionResult.election_id.in_(election_ids),
                ElectionResult.published_at.is_not(None),
            )
            res_rows = await election_db.execute(res_stmt)
            election_published_map = {row[0]: row[1] for row in res_rows.all()}
        else:
            election_published_map = {}

        # 6. Election Overview Time-Series
        buckets = generate_time_buckets(now, period)
        points: list[ChartDataPoint] = []
        for label, b_start, b_end in buckets:
            created_in_bucket = 0
            closed_in_bucket = 0
            published_in_bucket = 0

            for e in elections:
                e_created = ensure_utc(e.created_at)
                if e_created and b_start <= e_created < b_end:
                    created_in_bucket += 1

                e_closes = ensure_utc(e.closes_at)
                if e_closes and b_start <= e_closes < b_end:
                    if (
                        e.status
                        in (
                            ElectionStatus.CLOSED,
                            ElectionStatus.TALLIED,
                            ElectionStatus.PUBLISHED,
                        )
                        or e_closes <= now
                    ):
                        closed_in_bucket += 1
                elif (
                    not e_closes
                    and e.status
                    in (
                        ElectionStatus.CLOSED,
                        ElectionStatus.TALLIED,
                        ElectionStatus.PUBLISHED,
                    )
                ):
                    e_updated = ensure_utc(e.updated_at)
                    if e_updated and b_start <= e_updated < b_end:
                        closed_in_bucket += 1

                if e.status == ElectionStatus.PUBLISHED:
                    pub_dt = ensure_utc(election_published_map.get(e.id)) or ensure_utc(
                        e.updated_at or e.created_at
                    )
                    if pub_dt and b_start <= pub_dt < b_end:
                        published_in_bucket += 1

            points.append(
                ChartDataPoint(
                    label=label,
                    timestamp=b_start,
                    created=created_in_bucket,
                    closed=closed_in_bucket,
                    published=published_in_bucket,
                )
            )

        # 7. Upcoming Deadlines (timestamp > now, sorted ascending, limit 5)
        deadlines: list[UpcomingDeadlineItem] = []
        for e in elections:
            # Closes at for open or scheduled elections
            if e.status in (ElectionStatus.OPEN, ElectionStatus.SCHEDULED) and e.closes_at:
                closes_at_utc = ensure_utc(e.closes_at)
                if closes_at_utc and closes_at_utc > now:
                    deadlines.append(
                        UpcomingDeadlineItem(
                            election_id=e.id,
                            title=e.title,
                            deadline_type="Voting Closes",
                            deadline_at=closes_at_utc,
                            status=e.status,
                        )
                    )

            # Opens at for scheduled or draft elections
            if e.status in (ElectionStatus.SCHEDULED, ElectionStatus.DRAFT) and e.opens_at:
                opens_at_utc = ensure_utc(e.opens_at)
                if opens_at_utc and opens_at_utc > now:
                    deadlines.append(
                        UpcomingDeadlineItem(
                            election_id=e.id,
                            title=e.title,
                            deadline_type="Voting Starts",
                            deadline_at=opens_at_utc,
                            status=e.status,
                        )
                    )

        deadlines.sort(key=lambda d: d.deadline_at)
        upcoming_deadlines = deadlines[:5]

        # 8. Recent Activity (order by created_at DESC, limit 10)
        if election_ids:
            where_audit = or_(
                AuditEvent.organization_id == organization_id,
                AuditEvent.election_id.in_(election_ids),
            )
        else:
            where_audit = AuditEvent.organization_id == organization_id

        audit_stmt = (
            select(AuditEvent)
            .where(where_audit)
            .order_by(AuditEvent.created_at.desc())
            .limit(10)
        )
        audit_res = await election_db.execute(audit_stmt)
        audit_events = list(audit_res.scalars().all())

        actor_ids = {ev.actor_id for ev in audit_events if ev.actor_id is not None}
        email_map: dict[uuid.UUID, str] = {}
        if actor_ids:
            users_stmt = select(User.id, User.email_normalized).where(User.id.in_(actor_ids))
            users_res = await identity_db.execute(users_stmt)
            email_map = {row[0]: row[1] for row in users_res.all()}

        recent_activity: list[RecentActivityItem] = []
        for ev in audit_events:
            meta = parse_metadata_json(ev.metadata_json)
            desc = format_activity_description(ev.event_type, meta)
            recent_activity.append(
                RecentActivityItem(
                    id=ev.id,
                    event_type=ev.event_type,
                    description=desc,
                    timestamp=ensure_utc(ev.created_at) or now,
                    outcome=ev.outcome or "success",
                    actor_email=email_map.get(ev.actor_id) if ev.actor_id else None,
                )
            )

        # 9. Assemble and return DashboardSummaryResponse
        return DashboardSummaryResponse(
            organization_id=organization.id,
            organization_name=organization.name,
            period=period,
            metrics=DashboardMetrics(
                total_elections=KPIMetric(value=total_elections, change_pct=None),
                eligible_voters=KPIMetric(value=eligible_voters, change_pct=None),
                registered_candidates=KPIMetric(
                    value=registered_candidates, change_pct=None
                ),
                active_elections=KPIMetric(value=open_count, change_pct=None),
            ),
            election_overview=ElectionOverviewChart(
                period=period,
                points=points,
            ),
            election_status=ElectionStatusDonut(
                total=total_elections,
                draft=draft_count,
                scheduled=scheduled_count,
                open=open_count,
                closed=closed_count,
                published=published_count,
                canceled=canceled_count,
            ),
            upcoming_deadlines=upcoming_deadlines,
            recent_activity=recent_activity,
        )

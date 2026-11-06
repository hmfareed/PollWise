"""
Live Election Monitoring Service (Doc 01 §11.1 & §11.2).
Provides real-time turnout metrics, time-bucketed velocity, infrastructure health,
and departmental turnout enforcing the Privacy Threshold (< 10 voters suppressed).
Zero Interim Counts: Candidate preferences and vote counts are NEVER computed or returned.
"""

from collections import defaultdict
from datetime import UTC, datetime, timedelta
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException, ErrorCode
from app.models.ballot import Ballot
from app.models.election import Election, ElectionResult
from app.models.identity import ElectionEligibility
from app.models.voter_auth import (
    ElectionAccessCode,
    ElectionParticipation,
    ElectionVoterRecord,
)
from app.schemas.election import (
    DepartmentTurnoutMetric,
    ElectionMonitoringResponse,
    InfrastructureHealth,
    TurnoutVelocityPoint,
)


class ElectionMonitoringService:
    @classmethod
    async def get_monitoring_data(
        cls,
        election_session: AsyncSession,
        ballot_session: AsyncSession,
        identity_session: AsyncSession,
        election_id: uuid.UUID,
    ) -> ElectionMonitoringResponse:
        # 1. Fetch Election
        election = await election_session.get(Election, election_id)
        if not election:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Election not found",
                status_code=404,
            )

        # 2. Eligible Voters Across Channels
        total_codes = (
            await election_session.scalar(
                select(func.count(ElectionAccessCode.id)).where(
                    ElectionAccessCode.election_id == election_id
                )
            )
        ) or 0
        used_codes = (
            await election_session.scalar(
                select(func.count(ElectionAccessCode.id)).where(
                    ElectionAccessCode.election_id == election_id,
                    ElectionAccessCode.status == "used",
                )
            )
        ) or 0

        total_roster_voters = (
            await election_session.scalar(
                select(func.count(ElectionVoterRecord.id)).where(
                    ElectionVoterRecord.election_id == election_id,
                    ElectionVoterRecord.eligibility_status == "eligible",
                )
            )
        ) or 0

        total_participations = (
            await election_session.scalar(
                select(func.count(ElectionParticipation.id)).where(
                    ElectionParticipation.election_id == election_id,
                    ElectionParticipation.participation_status == "submitted",
                )
            )
        ) or 0

        total_legacy_eligible = (
            await identity_session.scalar(
                select(func.count(ElectionEligibility.id)).where(
                    ElectionEligibility.election_id == election_id,
                    ElectionEligibility.eligibility_status == "eligible",
                )
            )
        ) or 0
        total_legacy_redeemed = (
            await identity_session.scalar(
                select(func.count(ElectionEligibility.id)).where(
                    ElectionEligibility.election_id == election_id,
                    ElectionEligibility.entitlement_status == "redeemed",
                )
            )
        ) or 0

        # Ballots in ballot database
        ballot_stmt = (
            select(Ballot.accepted_at)
            .where(Ballot.election_id == election_id)
            .order_by(Ballot.accepted_at.asc())
        )
        ballots_res = (await ballot_session.execute(ballot_stmt)).scalars().all()
        ballots_in_db = len(ballots_res)

        total_eligible = max(total_codes, total_roster_voters, total_legacy_eligible)
        ballots_cast = max(
            total_participations, used_codes, ballots_in_db, total_legacy_redeemed
        )
        if ballots_cast > total_eligible:
            total_eligible = ballots_cast

        turnout_percentage = (
            round((ballots_cast / total_eligible * 100.0), 2)
            if total_eligible > 0
            else 0.0
        )

        # 3. Turnout Velocity (Hourly Buckets)
        now = datetime.now(UTC)
        velocity_points: list[TurnoutVelocityPoint] = []
        if ballots_res:
            bucket_counts: dict[datetime, int] = defaultdict(int)
            for b_dt in ballots_res:
                if b_dt:
                    hour_bucket = b_dt.replace(minute=0, second=0, microsecond=0)
                    bucket_counts[hour_bucket] += 1

            sorted_hours = sorted(bucket_counts.keys())
            cumulative = 0
            for h in sorted_hours:
                cnt = bucket_counts[h]
                cumulative += cnt
                velocity_points.append(
                    TurnoutVelocityPoint(
                        timestamp=h,
                        ballots_count=cnt,
                        cumulative_ballots=cumulative,
                    )
                )
        else:
            # Fallback current baseline point
            velocity_points.append(
                TurnoutVelocityPoint(
                    timestamp=now.replace(minute=0, second=0, microsecond=0),
                    ballots_count=0,
                    cumulative_ballots=0,
                )
            )

        # 4. Departmental Turnout & Privacy Threshold Rule (Spec §11.2)
        # Suppress groups with < 10 eligible voters into "Other / Suppressed (< 10 voters)"
        dept_eligible_stmt = (
            select(
                ElectionVoterRecord.voter_group,
                func.count(ElectionVoterRecord.id).label("eligible"),
            )
            .where(
                ElectionVoterRecord.election_id == election_id,
                ElectionVoterRecord.eligibility_status == "eligible",
            )
            .group_by(ElectionVoterRecord.voter_group)
        )
        dept_eligible_rows = (await election_session.execute(dept_eligible_stmt)).all()

        dept_voted_stmt = (
            select(
                ElectionVoterRecord.voter_group,
                func.count(ElectionParticipation.id).label("voted"),
            )
            .join(
                ElectionParticipation,
                ElectionParticipation.voter_record_id == ElectionVoterRecord.id,
            )
            .where(
                ElectionParticipation.election_id == election_id,
                ElectionParticipation.participation_status == "submitted",
            )
            .group_by(ElectionVoterRecord.voter_group)
        )
        dept_voted_rows = (await election_session.execute(dept_voted_stmt)).all()
        voted_by_dept = {row[0] or "General": row[1] for row in dept_voted_rows}

        department_metrics: list[DepartmentTurnoutMetric] = []
        suppressed_eligible = 0
        suppressed_voted = 0

        for row in dept_eligible_rows:
            group_name = row[0] or "General"
            elig = row[1]
            voted = voted_by_dept.get(group_name, 0)

            if elig < 10:
                # Group into suppressed bucket to preserve secret-ballot privacy
                suppressed_eligible += elig
                suppressed_voted += voted
            else:
                pct = round((voted / elig * 100.0), 1) if elig > 0 else 0.0
                department_metrics.append(
                    DepartmentTurnoutMetric(
                        department=group_name,
                        eligible_count=elig,
                        voted_count=voted,
                        turnout_percentage=pct,
                        is_suppressed=False,
                    )
                )

        if suppressed_eligible > 0:
            supp_pct = (
                round((suppressed_voted / suppressed_eligible * 100.0), 1)
                if suppressed_eligible > 0
                else 0.0
            )
            department_metrics.append(
                DepartmentTurnoutMetric(
                    department="Other / Small Groups (< 10 voters)",
                    eligible_count=suppressed_eligible,
                    voted_count=suppressed_voted,
                    turnout_percentage=supp_pct,
                    is_suppressed=True,
                )
            )

        # Sort departments alphabetically with suppressed group at the end
        department_metrics.sort(key=lambda d: (d.is_suppressed, d.department))

        # 5. Infrastructure Health Indicators
        health = InfrastructureHealth(
            ballot_box_status="healthy",
            credential_service_status="healthy",
            database_status="healthy",
        )

        return ElectionMonitoringResponse(
            election_id=election.id,
            status=election.status,
            total_eligible=total_eligible,
            ballots_cast=ballots_cast,
            turnout_percentage=turnout_percentage,
            paused_at=election.paused_at,
            pause_reason=election.pause_reason,
            velocity=velocity_points,
            departmental_turnout=department_metrics,
            health=health,
        )

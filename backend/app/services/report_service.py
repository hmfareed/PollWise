"""
PollWise Report Generation & Export Service
"""

import csv
import hashlib
import io
import json
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppException, ErrorCode
from app.models.election import (
    ApprovalDecision,
    ApprovalType,
    AuditEvent,
    Election,
    ElectionApproval,
    ElectionResult,
    ElectionStatus,
    Position,
    ReportExport,
)
from app.models.identity import User
from app.models.voter_auth import ElectionParticipation, ElectionVoterRecord


class ReportService:
    @staticmethod
    def generate_certified_results_csv(
        election: Election,
        result: ElectionResult | None,
        approvals: list[ElectionApproval],
    ) -> str:
        """Generate standardized CSV for certified election results."""
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["# POLLWISE OFFICIAL CERTIFIED ELECTION RESULTS"])
        writer.writerow(["# Election Title", election.title])
        writer.writerow(["# Election ID", str(election.id)])
        writer.writerow(["# Organization ID", str(election.organization_id)])
        writer.writerow(["# Status", election.status.upper()])
        writer.writerow(["# Canonical Ballot Hash (SHA-256)", election.configuration_hash or "N/A"])
        writer.writerow(["# Tally Algorithm Version", result.tally_algorithm_version if result else "1.0"])
        writer.writerow(["# Certified Ballots Cast", result.ballot_count if result else 0])
        writer.writerow(["# Tally Computed At", result.computed_at.isoformat() if result else "N/A"])
        writer.writerow(["# Published At", result.published_at.isoformat() if result and result.published_at else "N/A"])
        writer.writerow([])

        # Approvals section
        writer.writerow(["# CERTIFICATION & AUDIT APPROVALS"])
        writer.writerow(["Approval ID", "Approver Actor ID", "Decision", "Reason", "Timestamp"])
        if approvals:
            for app in approvals:
                writer.writerow([
                    str(app.id),
                    str(app.approver_actor_id),
                    app.decision.upper(),
                    app.reason or "",
                    app.created_at.isoformat(),
                ])
        else:
            writer.writerow(["NONE", "N/A", "PENDING", "No formal approvals recorded yet", "N/A"])
        writer.writerow([])

        # Position and candidate results
        writer.writerow(["# DETAILED POSITION RESULTS"])
        writer.writerow([
            "Position Title",
            "Position ID",
            "Candidate Name",
            "Candidate ID",
            "Votes",
            "Percentage (%)",
            "Winner",
            "Position Total Votes",
            "Position Abstentions",
        ])

        if result:
            parsed_data = json.loads(result.result_data)
            positions_data = parsed_data.get("positions", [])
            for p in positions_data:
                pos_title = p.get("title", "")
                pos_id = p.get("position_id", "")
                pos_total = p.get("total_votes", 0)
                pos_abstain = p.get("abstain_count", 0)
                winner_ids = set(p.get("winner_ids", []))

                for cand in p.get("candidates", []):
                    c_id = cand.get("candidate_id", "")
                    c_name = cand.get("name", "")
                    c_votes = cand.get("votes", 0)
                    c_pct = cand.get("percentage", 0.0)
                    is_winner = "YES" if c_id in winner_ids else "NO"

                    writer.writerow([
                        pos_title,
                        pos_id,
                        c_name,
                        c_id,
                        c_votes,
                        f"{c_pct:.2f}",
                        is_winner,
                        pos_total,
                        pos_abstain,
                    ])
        writer.writerow([])
        writer.writerow(["# End of Certified Report"])
        return output.getvalue()

    @staticmethod
    def generate_turnout_csv(
        election: Election,
        total_eligible: int,
        total_ballots: int,
        participation_breakdown: dict[str, int] | None = None,
    ) -> str:
        """Generate standardized CSV for voter participation and turnout."""
        output = io.StringIO()
        writer = csv.writer(output)

        turnout_pct = (total_ballots / total_eligible * 100.0) if total_eligible > 0 else 0.0

        writer.writerow(["# POLLWISE VOTER PARTICIPATION & TURNOUT REPORT"])
        writer.writerow(["# Election Title", election.title])
        writer.writerow(["# Election ID", str(election.id)])
        writer.writerow(["# Current Status", election.status.upper()])
        writer.writerow(["# Voting Window Opens", election.opens_at.isoformat() if election.opens_at else "N/A"])
        writer.writerow(["# Voting Window Closes", election.closes_at.isoformat() if election.closes_at else "N/A"])
        writer.writerow([])

        writer.writerow(["# TURNOUT SUMMARY METRICS"])
        writer.writerow(["Metric", "Count", "Percentage"])
        writer.writerow(["Total Registered Eligible Voters", total_eligible, "100.00%"])
        writer.writerow(["Total Ballots Cast", total_ballots, f"{turnout_pct:.2f}%"])
        writer.writerow(["Uncast Eligible Ballots", max(0, total_eligible - total_ballots), f"{(100.0 - turnout_pct):.2f}%"])
        writer.writerow([])

        if participation_breakdown:
            writer.writerow(["# PARTICIPATION CHANNEL BREAKDOWN"])
            writer.writerow(["Channel / Method", "Ballots Cast", "Percentage of Turnout"])
            for channel, count in participation_breakdown.items():
                pct = (count / total_ballots * 100.0) if total_ballots > 0 else 0.0
                writer.writerow([channel.capitalize(), count, f"{pct:.2f}%"])
            writer.writerow([])

        writer.writerow(["# End of Turnout Report"])
        return output.getvalue()

    @staticmethod
    def generate_audit_trail_csv(events: list[AuditEvent]) -> str:
        """Generate standardized CSV for election audit trail events."""
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["# POLLWISE AUDIT TRAIL REPORT"])
        writer.writerow(["# Total Events", len(events)])
        writer.writerow([])

        writer.writerow(["Event ID", "Timestamp (UTC)", "Event Type", "Outcome", "Actor ID", "Metadata Details"])
        for evt in events:
            writer.writerow([
                str(evt.id),
                evt.created_at.isoformat(),
                evt.event_type,
                evt.outcome.upper(),
                str(evt.actor_id) if evt.actor_id else "SYSTEM",
                evt.metadata_json or "",
            ])
        writer.writerow([])
        writer.writerow(["# End of Audit Trail Report"])
        return output.getvalue()

    @staticmethod
    def generate_summary_csv(election: Election, positions: list[Position]) -> str:
        """Generate election configuration and structure summary."""
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["# POLLWISE ELECTION GOVERNANCE & SPECIFICATION SUMMARY"])
        writer.writerow(["# Election Title", election.title])
        writer.writerow(["# Election ID", str(election.id)])
        writer.writerow(["# Organization ID", str(election.organization_id)])
        writer.writerow(["# Status", election.status.upper()])
        writer.writerow(["# Voting Method", election.voting_method])
        writer.writerow(["# Timezone", election.timezone])
        writer.writerow(["# Configuration Version", election.configuration_version])
        writer.writerow(["# Configuration SHA-256 Hash", election.configuration_hash or "N/A"])
        writer.writerow(["# Opens At", election.opens_at.isoformat() if election.opens_at else "N/A"])
        writer.writerow(["# Closes At", election.closes_at.isoformat() if election.closes_at else "N/A"])
        writer.writerow([])

        writer.writerow(["# BALLOT POSITIONS & CANDIDATES"])
        writer.writerow(["Position Title", "Min Selections", "Max Selections", "Display Order", "Candidate Name", "Candidate Status"])
        for pos in sorted(positions, key=lambda p: (p.display_order, str(p.id))):
            for cand in sorted(pos.candidates, key=lambda c: (c.display_order, str(c.id))):
                writer.writerow([
                    pos.title,
                    pos.min_selections,
                    pos.max_selections,
                    pos.display_order,
                    cand.name,
                    cand.status,
                ])
        writer.writerow([])
        writer.writerow(["# End of Governance Summary"])
        return output.getvalue()

    @classmethod
    async def create_and_log_report(
        cls,
        election_session: AsyncSession,
        election_id: uuid.UUID,
        report_type: str,
        file_format: str,
        actor: User,
    ) -> tuple[ReportExport, str]:
        """
        Produce report content, calculate SHA-256 integrity checksum,
        record ReportExport, and write an immutable AuditEvent.
        """
        # Load election with relations
        stmt = (
            select(Election)
            .where(Election.id == election_id)
            .options(
                selectinload(Election.positions).selectinload(Position.candidates),
                selectinload(Election.approvals),
            )
        )
        election = (await election_session.execute(stmt)).scalar_one_or_none()
        if not election:
            raise AppException(ErrorCode.NOT_FOUND, "Election not found", status_code=404)

        now = datetime.now(UTC)
        content_str = ""

        if report_type == "certified_results":
            res_stmt = select(ElectionResult).where(ElectionResult.election_id == election_id)
            result = (await election_session.execute(res_stmt)).scalar_one_or_none()

            if file_format == "csv":
                content_str = cls.generate_certified_results_csv(election, result, election.approvals)
            else:
                parsed_res = json.loads(result.result_data) if result else {}
                content_str = json.dumps({
                    "election_id": str(election.id),
                    "title": election.title,
                    "status": election.status,
                    "configuration_hash": election.configuration_hash,
                    "result": parsed_res,
                    "approvals": [
                        {
                            "id": str(a.id),
                            "approver_id": str(a.approver_actor_id),
                            "decision": a.decision,
                            "reason": a.reason,
                            "created_at": a.created_at.isoformat(),
                        }
                        for a in election.approvals
                    ],
                }, indent=2)

        elif report_type == "turnout":
            # Count voters and ballots
            voters_stmt = select(ElectionVoterRecord).where(ElectionVoterRecord.election_id == election_id)
            total_eligible = len((await election_session.execute(voters_stmt)).scalars().all())

            parts_stmt = select(ElectionParticipation).where(ElectionParticipation.election_id == election_id)
            participations = (await election_session.execute(parts_stmt)).scalars().all()
            total_ballots = len(participations)

            breakdown: dict[str, int] = {}
            for p in participations:
                channel = p.auth_method or "direct"
                breakdown[channel] = breakdown.get(channel, 0) + 1

            if file_format == "csv":
                content_str = cls.generate_turnout_csv(election, total_eligible, total_ballots, breakdown)
            else:
                turnout_pct = (total_ballots / total_eligible * 100.0) if total_eligible > 0 else 0.0
                content_str = json.dumps({
                    "election_id": str(election.id),
                    "title": election.title,
                    "total_eligible": total_eligible,
                    "total_ballots": total_ballots,
                    "turnout_percentage": round(turnout_pct, 2),
                    "breakdown": breakdown,
                }, indent=2)

        elif report_type == "audit_trail":
            evts_stmt = (
                select(AuditEvent)
                .where(AuditEvent.election_id == election_id)
                .order_by(AuditEvent.created_at.asc())
            )
            events = (await election_session.execute(evts_stmt)).scalars().all()
            if file_format == "csv":
                content_str = cls.generate_audit_trail_csv(events)
            else:
                content_str = json.dumps({
                    "election_id": str(election.id),
                    "events": [
                        {
                            "id": str(e.id),
                            "timestamp": e.created_at.isoformat(),
                            "event_type": e.event_type,
                            "outcome": e.outcome,
                            "actor_id": str(e.actor_id) if e.actor_id else None,
                            "metadata": json.loads(e.metadata_json) if e.metadata_json else None,
                        }
                        for e in events
                    ],
                }, indent=2)

        elif report_type == "summary":
            if file_format == "csv":
                content_str = cls.generate_summary_csv(election, election.positions)
            else:
                content_str = json.dumps({
                    "election_id": str(election.id),
                    "title": election.title,
                    "status": election.status,
                    "voting_method": election.voting_method,
                    "configuration_hash": election.configuration_hash,
                    "opens_at": election.opens_at.isoformat() if election.opens_at else None,
                    "closes_at": election.closes_at.isoformat() if election.closes_at else None,
                    "positions": [
                        {
                            "id": str(p.id),
                            "title": p.title,
                            "min_selections": p.min_selections,
                            "max_selections": p.max_selections,
                            "candidates": [{"id": str(c.id), "name": c.name} for c in p.candidates],
                        }
                        for p in election.positions
                    ],
                }, indent=2)

        else:
            raise AppException(ErrorCode.VALIDATION_ERROR, f"Unknown report type: '{report_type}'", status_code=400)

        # Compute checksum
        checksum = hashlib.sha256(content_str.encode("utf-8")).hexdigest()
        clean_title = "".join(c if c.isalnum() else "_" for c in election.title.lower())[:30]
        file_name = f"{clean_title}_{report_type}_{now.strftime('%Y%m%d%H%M%S')}.{file_format}"

        report_export = ReportExport(
            id=uuid.uuid4(),
            election_id=election_id,
            report_type=report_type,
            file_format=file_format,
            file_name=file_name,
            checksum=checksum,
            generated_by=actor.id,
            created_at=now,
        )
        election_session.add(report_export)

        audit_event = AuditEvent(
            id=uuid.uuid4(),
            organization_id=election.organization_id,
            election_id=election_id,
            actor_id=actor.id,
            event_type="report.exported",
            outcome="success",
            metadata_json=json.dumps({
                "report_id": str(report_export.id),
                "report_type": report_type,
                "file_format": file_format,
                "checksum": checksum,
            }),
            created_at=now,
        )
        election_session.add(audit_event)
        await election_session.commit()
        return report_export, content_str

    @staticmethod
    async def list_reports(
        election_session: AsyncSession,
        election_id: uuid.UUID,
    ) -> list[ReportExport]:
        """List previously generated report export records for an election."""
        stmt = (
            select(ReportExport)
            .where(ReportExport.election_id == election_id)
            .order_by(ReportExport.created_at.desc())
        )
        return list((await election_session.execute(stmt)).scalars().all())

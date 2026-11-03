import json
import uuid
from datetime import UTC, datetime

import pytest

from app.models.election import (
    ApprovalDecision,
    ApprovalType,
    AuditEvent,
    Candidate,
    Election,
    ElectionApproval,
    ElectionResult,
    ElectionStatus,
    Position,
)
from app.models.identity import User
from app.schemas.reports import GenerateReportRequest, ReportExportItem
from app.services.report_service import ReportService


def test_generate_certified_results_csv():
    election_id = uuid.uuid4()
    pos_id = uuid.uuid4()
    cand1_id = uuid.uuid4()
    cand2_id = uuid.uuid4()

    election = Election(
        id=election_id,
        organization_id=uuid.uuid4(),
        title="Student Union General Election 2026",
        status=ElectionStatus.PUBLISHED,
        configuration_hash="a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
        voting_method="single_choice_per_position",
        created_by=uuid.uuid4(),
    )

    pos = Position(
        id=pos_id,
        election_id=election_id,
        title="President",
        max_selections=1,
        min_selections=1,
        display_order=0,
    )
    cand1 = Candidate(id=cand1_id, position_id=pos_id, name="Alice Walker", display_order=0)
    cand2 = Candidate(id=cand2_id, position_id=pos_id, name="Bob Builder", display_order=1)
    pos.candidates = [cand1, cand2]
    election.positions = [pos]

    result_payload = {
        "election_id": str(election_id),
        "configuration_hash": election.configuration_hash,
        "total_ballots": 120,
        "positions": [
            {
                "position_id": str(pos_id),
                "title": "President",
                "total_votes": 115,
                "abstain_count": 5,
                "candidates": [
                    {"candidate_id": str(cand1_id), "name": "Alice Walker", "votes": 75, "percentage": 65.22},
                    {"candidate_id": str(cand2_id), "name": "Bob Builder", "votes": 40, "percentage": 34.78},
                ],
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
        ballot_count=120,
        result_data=json.dumps(result_payload),
        computed_at=datetime.now(UTC),
        computed_by="system",
        approval_status="approved",
        published_at=datetime.now(UTC),
    )

    approval = ElectionApproval(
        id=uuid.uuid4(),
        election_id=election_id,
        approval_type=ApprovalType.PUBLICATION,
        approver_actor_id=uuid.uuid4(),
        decision=ApprovalDecision.APPROVED,
        reason="Certified and verified by Election Commission",
        created_at=datetime.now(UTC),
    )

    csv_output = ReportService.generate_certified_results_csv(election, result, [approval])
    assert "POLLWISE OFFICIAL CERTIFIED ELECTION RESULTS" in csv_output
    assert election.title in csv_output
    assert election.configuration_hash in csv_output
    assert "Alice Walker" in csv_output
    assert "75" in csv_output
    assert "YES" in csv_output  # Winner flag for Alice
    assert "Bob Builder" in csv_output
    assert "NO" in csv_output  # Not winner for Bob


def test_generate_turnout_csv():
    election = Election(
        id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        title="Faculty Council 2026",
        status=ElectionStatus.OPEN,
        created_by=uuid.uuid4(),
    )

    csv_output = ReportService.generate_turnout_csv(
        election=election,
        total_eligible=200,
        total_ballots=150,
        participation_breakdown={"online": 120, "terminal": 30},
    )

    assert "POLLWISE VOTER PARTICIPATION & TURNOUT REPORT" in csv_output
    assert "Faculty Council 2026" in csv_output
    assert "200" in csv_output
    assert "150" in csv_output
    assert "75.00%" in csv_output


def test_generate_audit_trail_csv():
    election_id = uuid.uuid4()
    actor_id = uuid.uuid4()
    events = [
        AuditEvent(
            id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
            election_id=election_id,
            actor_id=actor_id,
            event_type="election.scheduled",
            outcome="success",
            metadata_json=json.dumps({"version": 1}),
            created_at=datetime.now(UTC),
        ),
        AuditEvent(
            id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
            election_id=election_id,
            actor_id=actor_id,
            event_type="election.published",
            outcome="success",
            metadata_json=None,
            created_at=datetime.now(UTC),
        ),
    ]

    csv_output = ReportService.generate_audit_trail_csv(events)
    assert "POLLWISE AUDIT TRAIL REPORT" in csv_output
    assert "election.scheduled" in csv_output
    assert "election.published" in csv_output

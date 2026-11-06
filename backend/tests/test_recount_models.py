"""
Tests for RecountRequest models and Pydantic schemas.
"""

import uuid
from datetime import UTC, datetime
import pytest
from pydantic import ValidationError

from app.models.election import Election, ElectionResult, RecountRequest, RecountStatus
from app.schemas.results import (
    ElectionResultResponse,
    RecountRequestCreate,
    RecountRequestResponse,
)


def test_recount_status_enum():
    assert RecountStatus.PENDING == "pending"
    assert RecountStatus.COMPLETED == "completed"
    assert RecountStatus.REJECTED == "rejected"


def test_recount_request_model_instantiation():
    election_id = uuid.uuid4()
    requester_id = uuid.uuid4()
    result_id = uuid.uuid4()
    now = datetime.now(UTC)

    req = RecountRequest(
        id=uuid.uuid4(),
        election_id=election_id,
        requester_user_id=requester_id,
        reason="Disputed margin in presidential election",
        status=RecountStatus.COMPLETED,
        resulting_result_id=result_id,
        created_at=now,
        resolved_at=now,
    )

    assert req.election_id == election_id
    assert req.requester_user_id == requester_id
    assert req.reason == "Disputed margin in presidential election"
    assert req.status == "completed"
    assert req.resulting_result_id == result_id
    assert req.resolved_at == now
    assert str(req.__tablename__) == "recount_requests"


def test_election_relationship_has_recount_requests():
    assert hasattr(Election, "recount_requests")
    assert hasattr(RecountRequest, "resulting_result")


def test_recount_request_create_schema_validation():
    # Valid reason
    valid = RecountRequestCreate(reason="Valid audit recount justification")
    assert valid.reason == "Valid audit recount justification"

    # Strips leading and trailing whitespace
    padded = RecountRequestCreate(reason="   Valid audit recount justification   ")
    assert padded.reason == "Valid audit recount justification"

    # Too short reason (< 5 characters)
    with pytest.raises(ValidationError):
        RecountRequestCreate(reason="abc")

    # Empty reason
    with pytest.raises(ValidationError):
        RecountRequestCreate(reason="")

    # Whitespace-only reason (Review Focus #2)
    with pytest.raises(ValidationError):
        RecountRequestCreate(reason="      ")

    # Whitespace with fewer than 5 characters when stripped
    with pytest.raises(ValidationError):
        RecountRequestCreate(reason="   ab   ")


def test_recount_request_response_schema():
    req_id = uuid.uuid4()
    election_id = uuid.uuid4()
    requester_id = uuid.uuid4()
    result_id = uuid.uuid4()
    now = datetime.now(UTC)

    resp = RecountRequestResponse(
        id=req_id,
        election_id=election_id,
        requester_user_id=requester_id,
        reason="Auditor requested recount",
        status="completed",
        resulting_result_id=result_id,
        created_at=now,
        resolved_at=now,
    )
    assert resp.id == req_id
    assert resp.election_id == election_id
    assert resp.status == "completed"
    assert resp.resulting_result_id == result_id


def test_election_result_response_includes_version():
    res_id = uuid.uuid4()
    election_id = uuid.uuid4()
    now = datetime.now(UTC)

    resp = ElectionResultResponse(
        id=res_id,
        election_id=election_id,
        configuration_hash="hash123",
        ballot_count=42,
        approval_status="pending",
        computed_at=now,
        result_version=2,
        tally_algorithm_version="1.0",
        positions=[],
    )
    assert resp.result_version == 2
    assert resp.tally_algorithm_version == "1.0"

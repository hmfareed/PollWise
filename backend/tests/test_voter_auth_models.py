import uuid
from datetime import UTC, datetime
import pytest

from app.models.voter_auth import (
    ElectionVoterAuthConfig,
    ElectionVoterRecord,
    VoterOTPChallenge,
    VotingSession,
    ElectionParticipation,
    VotingCentre,
    VotingTerminal,
)
from app.schemas.voter_auth import (
    VoterAuthConfigCreate,
    VoterAuthConfigResponse,
    VoterRecordCreate,
    VoterRecordResponse,
    VoterChallengeRequest,
    VoterChallengeResponse,
    VoterVerifyRequest,
    VoterSessionResponse,
)


def test_voter_auth_config_defaults():
    config = ElectionVoterAuthConfig(
        election_id=uuid.uuid4(),
        identifier_type="institutional_email",
    )
    assert config.otp_length == 6
    assert config.otp_expiry_seconds == 300
    assert config.otp_max_attempts == 5
    assert config.allow_position_skip is True
    assert config.allow_session_resume is True


def test_voter_record_fields():
    election_id = uuid.uuid4()
    rec = ElectionVoterRecord(
        election_id=election_id,
        identifier_type="institutional_id",
        normalized_identifier="STU-12345",
        eligibility_status="eligible",
        voter_group="Engineering",
        source="csv_import",
    )
    assert rec.election_id == election_id
    assert rec.identifier_type == "institutional_id"
    assert rec.normalized_identifier == "STU-12345"
    assert rec.eligibility_status == "eligible"
    assert rec.voter_group == "Engineering"
    assert rec.source == "csv_import"
    assert rec.voter_reference_id is None


def test_voter_otp_challenge_fields():
    election_id = uuid.uuid4()
    voter_id = uuid.uuid4()
    now = datetime.now(UTC)
    challenge = VoterOTPChallenge(
        election_id=election_id,
        voter_record_id=voter_id,
        challenge_hash="chal_hash_123",
        otp_hash="otp_hash_123",
        expires_at=now,
    )
    assert challenge.attempt_count == 0
    assert challenge.consumed_at is None


def test_voting_session_and_participation_models():
    election_id = uuid.uuid4()
    voter_id = uuid.uuid4()
    now = datetime.now(UTC)
    
    session = VotingSession(
        election_id=election_id,
        voter_record_id=voter_id,
        session_token_hash="sess_hash_123",
        session_status="active",
        expires_at=now,
    )
    assert session.session_status == "active"
    assert session.idempotency_key is None

    participation = ElectionParticipation(
        election_id=election_id,
        voter_record_id=voter_id,
        confirmation_reference="PW-TEST-REF",
    )
    assert participation.participation_status == "submitted"
    assert participation.confirmation_reference == "PW-TEST-REF"


def test_voting_centre_and_terminal_models():
    institution_id = uuid.uuid4()
    centre = VotingCentre(
        institution_id=institution_id,
        name="Campus Hall Centre",
        location_description="Room 101",
    )
    assert centre.status == "active"

    terminal = VotingTerminal(
        voting_centre_id=uuid.uuid4(),
        institution_id=institution_id,
        terminal_name="Terminal 01",
        terminal_status="idle",
        auth_token_hash="tok_hash_123",
    )
    assert terminal.terminal_status == "idle"


def test_pydantic_schemas_validation():
    schema = VoterAuthConfigCreate(
        identifier_type="institutional_id",
        identifier_label="Student ID",
        allow_position_skip=False,
    )
    assert schema.identifier_type == "institutional_id"
    assert schema.identifier_label == "Student ID"
    assert schema.allow_position_skip is False

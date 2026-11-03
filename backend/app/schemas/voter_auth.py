import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class VoterAuthConfigBase(BaseModel):
    identifier_type: str = Field(default="institutional_email")
    identifier_label: str = Field(default="Institutional Email")
    identifier_normalization_rules: dict[str, Any] | None = None
    otp_length: int = 6
    otp_expiry_seconds: int = 300
    otp_max_attempts: int = 5
    otp_regeneration_cooldown_seconds: int = 30
    session_idle_timeout_seconds: int = 600
    session_max_duration_seconds: int = 3600
    allow_session_resume: bool = True
    allow_position_skip: bool = True


class VoterAuthConfigCreate(VoterAuthConfigBase):
    pass


class VoterAuthConfigUpdate(BaseModel):
    identifier_type: str | None = None
    identifier_label: str | None = None
    identifier_normalization_rules: dict[str, Any] | None = None
    otp_expiry_seconds: int | None = None
    otp_max_attempts: int | None = None
    allow_session_resume: bool | None = None
    allow_position_skip: bool | None = None


class VoterAuthConfigResponse(VoterAuthConfigBase):
    id: uuid.UUID
    election_id: uuid.UUID
    configuration_locked_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VoterRecordCreate(BaseModel):
    identifier: str
    voter_group: str | None = None
    eligibility_status: str = "eligible"


class VoterRecordResponse(BaseModel):
    id: uuid.UUID
    election_id: uuid.UUID
    identifier_type: str
    normalized_identifier: str
    voter_reference_id: uuid.UUID | None = None
    eligibility_status: str
    voter_group: str | None = None
    source: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VoterCSVPreviewReport(BaseModel):
    valid_count: int
    duplicate_count: int
    invalid_count: int
    sample_records: list[dict[str, Any]]
    errors: list[str]


class VoterChallengeRequest(BaseModel):
    identifier: str
    terminal_token: str | None = None


class VoterChallengeResponse(BaseModel):
    challenge_id: str
    otp_code: str
    expires_in_seconds: int
    identifier_label: str


class VoterVerifyRequest(BaseModel):
    challenge_id: str
    entered_otp: str


class VoterSessionResponse(BaseModel):
    session_token: str
    status: str
    expires_at: datetime
    allow_position_skip: bool


class BallotSelectionItem(BaseModel):
    position_id: uuid.UUID
    candidate_id: uuid.UUID | None = None
    skipped: bool = False


class BallotSubmitRequest(BaseModel):
    selections: list[BallotSelectionItem]
    idempotency_key: str


class BallotSubmitReceipt(BaseModel):
    confirmation_reference: str
    submitted_at: datetime
    status: str = "accepted"


class VotingCentreCreate(BaseModel):
    institution_id: uuid.UUID
    name: str
    location_description: str | None = None


class VotingCentreResponse(BaseModel):
    id: uuid.UUID
    institution_id: uuid.UUID
    name: str
    location_description: str | None = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VotingTerminalCreate(BaseModel):
    terminal_name: str
    authorized_election_id: uuid.UUID | None = None


class VotingTerminalResponse(BaseModel):
    id: uuid.UUID
    voting_centre_id: uuid.UUID
    institution_id: uuid.UUID
    terminal_name: str
    authorized_election_id: uuid.UUID | None = None
    terminal_status: str
    token: str | None = None
    last_seen_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class TerminalHeartbeatRequest(BaseModel):
    current_status: str = "idle"


class TerminalHeartbeatResponse(BaseModel):
    command: str = "none"
    server_time: datetime


class GenerateAccessCodesRequest(BaseModel):
    count: int = Field(default=50, ge=1, le=5000)


class AccessCodeItem(BaseModel):
    id: uuid.UUID
    election_id: uuid.UUID
    code: str
    status: str
    used_by_student_id: str | None = None
    used_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AccessCodeListResponse(BaseModel):
    items: list[AccessCodeItem]
    total_count: int
    unused_count: int
    used_count: int


class VerifyAccessCodeRequest(BaseModel):
    code: str


class VerifyAccessCodeResponse(BaseModel):
    valid: bool
    code: str
    election_id: uuid.UUID
    election_title: str


class ClaimAccessCodeRequest(BaseModel):
    code: str
    student_id: str
    terminal_token: str | None = None


class ClaimAccessCodeResponse(BaseModel):
    session_token: str
    status: str
    expires_at: datetime
    allow_position_skip: bool


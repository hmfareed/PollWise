"""
Pollwise Voter Eligibility & Credential Issuance Schemas
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class EligibilityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    election_id: uuid.UUID
    user_id: uuid.UUID
    user_email: str | None = None
    user_name: str | None = None
    eligibility_status: str
    entitlement_status: str
    created_at: datetime


class AddEligibilityRequest(BaseModel):
    user_id: uuid.UUID | None = None
    email: EmailStr | None = None


class BulkEligibilityImportRequest(BaseModel):
    emails: list[EmailStr] = Field(..., min_length=1)


class BulkEligibilityImportResponse(BaseModel):
    total_processed: int
    added: int
    already_eligible: int
    not_found: list[str]


class VotingCredentialResponse(BaseModel):
    election_id: uuid.UUID
    credential: str = Field(..., description="Single-use bearer voting credential")
    expires_at: datetime | None = None


class ParticipationStatusResponse(BaseModel):
    election_id: uuid.UUID
    is_eligible: bool
    eligibility_status: str | None = None
    entitlement_status: str | None = None
    has_voted: bool = False


class ConfirmRedemptionRequest(BaseModel):
    receipt_reference: str = Field(..., min_length=8)

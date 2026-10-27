import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator


class CreateElectionRequest(BaseModel):
    organization_id: uuid.UUID = Field(..., description="Organization conducting the election")
    title: str = Field(..., min_length=3, max_length=255, description="Election title")
    description: str | None = Field(None, max_length=2000)
    opens_at: datetime | None = Field(None, description="Voting commencement timestamp")
    closes_at: datetime | None = Field(None, description="Voting conclusion deadline")
    timezone: str = Field(default="UTC", description="IANA timezone name")

    @model_validator(mode="after")
    def validate_dates(self):
        if self.opens_at and self.closes_at and self.closes_at <= self.opens_at:
            raise ValueError("closes_at must be strictly after opens_at")
        return self


class UpdateElectionRequest(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=255)
    description: str | None = Field(None, max_length=2000)
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    timezone: str | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.opens_at and self.closes_at and self.closes_at <= self.opens_at:
            raise ValueError("closes_at must be strictly after opens_at")
        return self


class CreatePositionRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: str | None = Field(None, max_length=1000)
    min_selections: int = Field(default=1, ge=0)
    max_selections: int = Field(default=1, ge=1)
    display_order: int = Field(default=0)


class UpdatePositionRequest(BaseModel):
    title: str | None = Field(None, min_length=2, max_length=255)
    description: str | None = None
    min_selections: int | None = Field(None, ge=0)
    max_selections: int | None = Field(None, ge=1)
    display_order: int | None = None


class CreateCandidateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    biography: str | None = Field(None, max_length=2000)
    photo_url: str | None = Field(None, max_length=1024)
    display_order: int = Field(default=0)


class UpdateCandidateRequest(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=255)
    biography: str | None = None
    photo_url: str | None = None
    display_order: int | None = None
    status: str | None = Field(None, description="active | withdrawn")


class LaunchApprovalRequest(BaseModel):
    decision: str = Field(..., description="approved | rejected")
    reason: str | None = Field(None, max_length=500)


class CancelElectionRequest(BaseModel):
    reason: str = Field(
        ..., min_length=5, max_length=500, description="Audit reason for cancellation"
    )


class CandidateResponse(BaseModel):
    id: uuid.UUID
    position_id: uuid.UUID
    name: str
    biography: str | None = None
    photo_url: str | None = None
    display_order: int
    status: str
    created_at: datetime


class PositionResponse(BaseModel):
    id: uuid.UUID
    election_id: uuid.UUID
    title: str
    description: str | None = None
    min_selections: int
    max_selections: int
    display_order: int
    candidates: list[CandidateResponse] = []


class ElectionResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    title: str
    description: str | None = None
    status: str
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    timezone: str
    voting_method: str
    configuration_version: int
    configuration_hash: str | None = None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime


class ElectionDetailResponse(ElectionResponse):
    positions: list[PositionResponse] = []


class AuditEventResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID | None = None
    election_id: uuid.UUID | None = None
    actor_id: uuid.UUID | None = None
    event_type: str
    outcome: str
    metadata: dict[str, Any] = {}
    created_at: datetime

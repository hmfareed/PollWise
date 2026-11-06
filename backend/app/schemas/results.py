"""
Pollwise Election Tally and Results Schemas
"""

from typing import Any
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CandidateResult(BaseModel):
    candidate_id: uuid.UUID | None = None
    name: str
    votes: int
    percentage: float


class PositionResult(BaseModel):
    position_id: uuid.UUID
    title: str
    total_votes: int
    abstain_count: int
    candidates: list[CandidateResult]
    winner_ids: list[uuid.UUID]


class ElectionResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    election_id: uuid.UUID
    configuration_hash: str
    ballot_count: int
    approval_status: str
    result_version: int = 1
    tally_algorithm_version: str = "1.0"
    computed_at: datetime
    published_at: datetime | None = None
    positions: list[PositionResult]


class RecountRequestCreate(BaseModel):
    reason: str = Field(..., min_length=5, max_length=2000)


class RecountRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    election_id: uuid.UUID
    requester_user_id: uuid.UUID
    reason: str
    status: str
    resulting_result_id: uuid.UUID | None = None
    created_at: datetime
    resolved_at: datetime | None = None


class ApproveResultsRequest(BaseModel):
    decision: str = Field(default="approved", pattern="^(approved|rejected)$")
    reason: str | None = None
    approved: bool | None = None

    @model_validator(mode="before")
    @classmethod
    def set_decision_from_approved(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "approved" in data and "decision" not in data:
                data["decision"] = "approved" if data["approved"] else "rejected"
        return data

"""
Pollwise Election Tally and Results Schemas
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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
    computed_at: datetime
    published_at: datetime | None = None
    positions: list[PositionResult]


class ApproveResultsRequest(BaseModel):
    decision: str = Field(default="approved", pattern="^(approved|rejected)$")
    reason: str | None = None

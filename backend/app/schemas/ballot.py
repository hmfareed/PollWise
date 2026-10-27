"""
Pollwise Ballot Submission Schemas

Strict Architectural Secrecy Invariant:
Ballot submission requests must never accept, validate, or deserialize:
- user_id, voter_id, email, username
- session tokens, auth cookies, bearer authorization headers
Any submission containing identity fields must be rejected immediately with 422.
"""

import uuid
from typing import Any

from pydantic import BaseModel, Field, model_validator

from app.core.errors import AppException, ErrorCode


class BallotSelectionItem(BaseModel):
    position_id: uuid.UUID = Field(..., description="Target ballot position UUID")
    candidate_ids: list[uuid.UUID] = Field(
        default_factory=list,
        description="Selected candidate UUIDs for this position (empty if abstaining)",
    )
    is_abstain: bool = Field(
        default=False,
        description="Explicit abstention from this position",
    )


class BallotSubmitRequest(BaseModel):
    election_id: uuid.UUID = Field(..., description="Target election UUID")
    credential: str = Field(..., min_length=16, description="Single-use bearer voting credential")
    selections: list[BallotSelectionItem] = Field(
        ..., min_length=1, description="List of selections corresponding to ballot positions"
    )
    idempotency_key: str | None = Field(
        default=None,
        description="Client-generated idempotency key for safe retries on network failure",
    )

    @model_validator(mode="before")
    @classmethod
    def reject_identity_fields(cls, data: Any) -> Any:
        """Strictly prohibit any voter identity attributes from entering the ballot-box."""
        if isinstance(data, dict):
            prohibited = {
                "user_id",
                "voter_id",
                "email",
                "username",
                "display_name",
                "voter",
                "identity",
                "user",
                "account_id",
            }
            found = prohibited.intersection(set(data.keys()))
            if found:
                raise AppException(
                    ErrorCode.VALIDATION_ERROR,
                    f"Forbidden identity attributes rejected by ballot-box boundary: {', '.join(found)}",
                    status_code=422,
                )
        return data


class BallotSubmitResponse(BaseModel):
    status: str = Field(default="accepted")
    receipt_reference: str = Field(
        ...,
        description="Cryptographically random, non-identifying confirmation reference",
    )

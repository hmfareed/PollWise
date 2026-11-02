import uuid
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_ballot_session, get_election_session
from app.schemas.common import ApiResponse
from app.schemas.voter_auth import BallotSubmitReceipt, BallotSubmitRequest
from app.services.ballot_participation_service import BallotParticipationService

router = APIRouter(tags=["Voter Ballot & Submission"])


@router.get(
    "/elections/{election_id}/ballot",
    response_model=ApiResponse[dict[str, Any]],
)
async def get_ballot(
    election_id: uuid.UUID,
    x_voting_session: str | None = Header(default=None),
    election_session: AsyncSession = Depends(get_election_session),
):
    if not x_voting_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "MISSING_SESSION_HEADER", "message": "X-Voting-Session header is required."},
        )
    ballot_data = await BallotParticipationService.get_ballot_structure(
        election_session, election_id, x_voting_session
    )
    return ApiResponse(status="success", data=ballot_data)


@router.put(
    "/elections/{election_id}/ballot/draft",
    response_model=ApiResponse[dict[str, Any]],
)
async def save_ballot_draft(
    election_id: uuid.UUID,
    draft_payload: dict[str, Any],
    x_voting_session: str | None = Header(default=None),
    election_session: AsyncSession = Depends(get_election_session),
):
    if not x_voting_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "MISSING_SESSION_HEADER", "message": "X-Voting-Session header is required."},
        )
    await BallotParticipationService.save_draft(
        election_session, election_id, x_voting_session, draft_payload
    )
    return ApiResponse(status="success", data={"saved": True})


@router.post(
    "/elections/{election_id}/ballot/submit",
    response_model=ApiResponse[BallotSubmitReceipt],
)
async def submit_ballot(
    election_id: uuid.UUID,
    req: BallotSubmitRequest,
    x_voting_session: str | None = Header(default=None),
    election_session: AsyncSession = Depends(get_election_session),
    ballot_session: AsyncSession = Depends(get_ballot_session),
):
    if not x_voting_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "MISSING_SESSION_HEADER", "message": "X-Voting-Session header is required."},
        )
    receipt = await BallotParticipationService.submit_ballot_atomic(
        election_session,
        ballot_session,
        election_id,
        x_voting_session,
        req.selections,
        req.idempotency_key,
    )
    return ApiResponse(
        status="success",
        data=BallotSubmitReceipt(**receipt),
    )

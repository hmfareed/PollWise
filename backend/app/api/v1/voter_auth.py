import uuid
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_election_session
from app.schemas.common import ApiResponse
from app.schemas.voter_auth import (
    ClaimAccessCodeRequest,
    ClaimAccessCodeResponse,
    VerifyAccessCodeRequest,
    VerifyAccessCodeResponse,
    VoterChallengeRequest,
    VoterChallengeResponse,
    VoterSessionResponse,
    VoterVerifyRequest,
)
from app.services.voter_auth_service import VoterAuthService

router = APIRouter(tags=["Voter Authentication & On-Screen Challenge"])


@router.post(
    "/elections/{election_id}/voter-auth/request-challenge",
    response_model=ApiResponse[VoterChallengeResponse],
)
async def request_voter_challenge(
    election_id: uuid.UUID,
    req: VoterChallengeRequest,
    x_terminal_token: str | None = Header(default=None),
    session: AsyncSession = Depends(get_election_session),
):
    terminal_token = req.terminal_token or x_terminal_token
    result = await VoterAuthService.request_challenge(
        session, election_id, req.identifier, terminal_token
    )
    return ApiResponse(
        status="success",
        data=VoterChallengeResponse(
            challenge_id=str(result["challenge_id"]),
            otp_code=str(result["otp_code"]),
            expires_in_seconds=int(result["expires_in_seconds"]),
            identifier_label=str(result["identifier_label"]),
        ),
    )


@router.post(
    "/elections/{election_id}/voter-auth/verify-challenge",
    response_model=ApiResponse[VoterSessionResponse],
)
async def verify_voter_challenge(
    election_id: uuid.UUID,
    req: VoterVerifyRequest,
    x_terminal_token: str | None = Header(default=None),
    session: AsyncSession = Depends(get_election_session),
):
    result = await VoterAuthService.verify_challenge(
        session, election_id, req.challenge_id, req.entered_otp, x_terminal_token
    )
    return ApiResponse(
        status="success",
        data=VoterSessionResponse(
            session_token=result["session_token"],
            status=result["status"],
            expires_at=result["expires_at"],
            allow_position_skip=result["allow_position_skip"],
        ),
    )


@router.post(
    "/elections/{election_id}/voter-auth/end-session",
    response_model=ApiResponse[dict[str, Any]],
)
async def end_voter_session(
    election_id: uuid.UUID,
    x_voting_session: str | None = Header(default=None),
    session: AsyncSession = Depends(get_election_session),
):
    if not x_voting_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "MISSING_SESSION_HEADER", "message": "X-Voting-Session header is required."},
        )
    await VoterAuthService.end_session(session, x_voting_session)
    return ApiResponse(
        status="success",
        data={"ended": True},
    )


@router.post(
    "/elections/{election_id}/access-codes/verify",
    response_model=ApiResponse[VerifyAccessCodeResponse],
)
async def verify_access_code(
    election_id: uuid.UUID,
    req: VerifyAccessCodeRequest,
    session: AsyncSession = Depends(get_election_session),
):
    result = await VoterAuthService.verify_access_code(session, election_id, req.code)
    return ApiResponse(
        status="success",
        data=VerifyAccessCodeResponse(
            valid=result["valid"],
            code=result["code"],
            election_id=result["election_id"],
            election_title=result["election_title"],
        ),
    )


@router.post(
    "/elections/{election_id}/access-codes/claim",
    response_model=ApiResponse[ClaimAccessCodeResponse],
)
async def claim_access_code(
    election_id: uuid.UUID,
    req: ClaimAccessCodeRequest,
    x_terminal_token: str | None = Header(default=None),
    session: AsyncSession = Depends(get_election_session),
):
    terminal_token = req.terminal_token or x_terminal_token
    result = await VoterAuthService.claim_access_code_and_start_session(
        session, election_id, req.code, req.student_id, terminal_token
    )
    return ApiResponse(
        status="success",
        data=ClaimAccessCodeResponse(
            session_token=result["session_token"],
            status=result["status"],
            expires_at=result["expires_at"],
            allow_position_skip=result["allow_position_skip"],
        ),
    )


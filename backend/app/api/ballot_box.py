"""
Pollwise Isolated Ballot-Box API Endpoint

Architectural Invariant (Docs 06, 09, 20):
- Must enforce strict structural separation from identity_db.
- Must strictly reject requests accompanied by session cookies or Authorization headers.
- Atomically validates the ballot choices and redeems the single-use bearer credential.
"""

from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppException, ErrorCode
from app.core.rate_limit import rate_limit_ballot_box
from app.db.session import get_ballot_session, get_election_session
from app.schemas.ballot import BallotSubmitRequest, BallotSubmitResponse
from app.services.ballot_box_service import BallotBoxService

router = APIRouter(tags=["Isolated Ballot-Box"])


@router.post(
    "/ballots",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit_ballot_box)],
)
async def submit_ballot(
    request: Request,
    payload: BallotSubmitRequest,
    ballot_session: AsyncSession = Depends(get_ballot_session),
    election_session: AsyncSession = Depends(get_election_session),
    authorization: str | None = Header(None),
):
    """
    Submit an anonymous, secret ballot into the isolated ballot_db.
    
    Strict Boundary Protections:
    1. Rejects if authorization headers or identity session cookies are present.
    2. Rejects if voter identity parameters are included in payload.
    3. Executes atomic redemption and insertion inside ballot_db.
    """
    # Strict hygiene: reject requests carrying identity cookies
    cookies = request.cookies
    if settings.SESSION_COOKIE_NAME in cookies:
        raise AppException(
            ErrorCode.IDENTITY_FIELD_REJECTED,
            "Identity session cookie detected on ballot-box boundary: requests must omit credentials",
            status_code=422,
        )

    # Reject standard user authorization headers on ballot-box submission
    if authorization and not authorization.startswith("Bearer bb_"):
        raise AppException(
            ErrorCode.IDENTITY_FIELD_REJECTED,
            "Authorization headers strictly prohibited on anonymous ballot submissions",
            status_code=422,
        )

    result = await BallotBoxService.submit_ballot(
        ballot_session=ballot_session,
        election_session=election_session,
        request=payload,
    )

    return {
        "data": BallotSubmitResponse(**result),
        "error": None,
    }

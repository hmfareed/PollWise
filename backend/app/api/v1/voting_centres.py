import uuid
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_election_session
from app.models.identity import User
from app.schemas.common import ApiResponse
from app.schemas.voter_auth import (
    TerminalHeartbeatRequest,
    TerminalHeartbeatResponse,
    VotingCentreCreate,
    VotingCentreResponse,
    VotingTerminalCreate,
    VotingTerminalResponse,
)
from app.services.voting_centre_service import VotingCentreService

router = APIRouter(tags=["Voting Centres & Terminals"])


@router.post(
    "/voting-centres",
    response_model=ApiResponse[VotingCentreResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_voting_centre(
    centre_in: VotingCentreCreate,
    session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    centre = await VotingCentreService.create_centre(
        session, centre_in.institution_id, centre_in.name, centre_in.location_description
    )
    return ApiResponse(
        status="success",
        data=VotingCentreResponse.model_validate(centre),
    )


@router.get(
    "/voting-centres",
    response_model=ApiResponse[list[VotingCentreResponse]],
)
async def list_voting_centres(
    institution_id: uuid.UUID = Query(...),
    session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    centres = await VotingCentreService.list_centres(session, institution_id)
    return ApiResponse(
        status="success",
        data=[VotingCentreResponse.model_validate(c) for c in centres],
    )


@router.post(
    "/voting-centres/{centre_id}/terminals",
    response_model=ApiResponse[VotingTerminalResponse],
    status_code=status.HTTP_201_CREATED,
)
async def register_terminal(
    centre_id: uuid.UUID,
    term_in: VotingTerminalCreate,
    session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    terminal, raw_token = await VotingCentreService.register_terminal(
        session, centre_id, term_in.terminal_name, term_in.authorized_election_id
    )
    resp = VotingTerminalResponse(
        id=terminal.id,
        voting_centre_id=terminal.voting_centre_id,
        institution_id=terminal.institution_id,
        terminal_name=terminal.terminal_name,
        authorized_election_id=terminal.authorized_election_id,
        terminal_status=terminal.terminal_status,
        token=raw_token,
        last_seen_at=terminal.last_seen_at,
    )
    return ApiResponse(status="success", data=resp)


@router.get(
    "/voting-centres/{centre_id}/terminals",
    response_model=ApiResponse[list[VotingTerminalResponse]],
)
async def list_terminals(
    centre_id: uuid.UUID,
    session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    terminals = await VotingCentreService.list_terminals_in_centre(session, centre_id)
    return ApiResponse(
        status="success",
        data=[
            VotingTerminalResponse(
                id=t.id,
                voting_centre_id=t.voting_centre_id,
                institution_id=t.institution_id,
                terminal_name=t.terminal_name,
                authorized_election_id=t.authorized_election_id,
                terminal_status=t.terminal_status,
                token=None,
                last_seen_at=t.last_seen_at,
            )
            for t in terminals
        ],
    )


@router.post(
    "/voting-terminals/{terminal_id}/heartbeat",
    response_model=ApiResponse[TerminalHeartbeatResponse],
)
async def terminal_heartbeat(
    terminal_id: uuid.UUID,
    req: TerminalHeartbeatRequest,
    x_terminal_token: str | None = Header(default=None),
    session: AsyncSession = Depends(get_election_session),
):
    if not x_terminal_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Terminal-Token header is required for terminal operations",
        )
    result = await VotingCentreService.heartbeat(
        session, terminal_id, x_terminal_token, req.current_status
    )
    return ApiResponse(
        status="success",
        data=TerminalHeartbeatResponse(
            command=result["command"],
            server_time=result["server_time"],
        ),
    )


@router.post(
    "/voting-terminals/{terminal_id}/reset",
    response_model=ApiResponse[dict[str, Any]],
)
async def supervisor_reset_terminal(
    terminal_id: uuid.UUID,
    session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    await VotingCentreService.supervisor_reset(session, terminal_id)
    return ApiResponse(
        status="success",
        data={"reset_triggered": True},
    )

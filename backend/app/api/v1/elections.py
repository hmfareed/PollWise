import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_election_session
from app.models.election import Candidate, Election, Position
from app.models.identity import User
from app.schemas.common import ApiResponse
from app.schemas.election import (
    AuditEventResponse,
    CancelElectionRequest,
    CandidateResponse,
    CreateCandidateRequest,
    CreateElectionRequest,
    CreatePositionRequest,
    ElectionDetailResponse,
    ElectionResponse,
    LaunchApprovalRequest,
    PositionResponse,
    UpdateCandidateRequest,
    UpdateElectionRequest,
    UpdatePositionRequest,
)
from app.services.election_service import ElectionService

router = APIRouter(tags=["Election Lifecycle & Management"])


def serialize_candidate(c: Candidate) -> CandidateResponse:
    return CandidateResponse(
        id=c.id,
        position_id=c.position_id,
        name=c.name,
        biography=c.biography,
        photo_url=c.photo_url,
        display_order=c.display_order,
        status=c.status,
        created_at=c.created_at,
    )


def serialize_position(p: Position) -> PositionResponse:
    cands = []
    if "candidates" in p.__dict__ and p.candidates:
        cands = [serialize_candidate(c) for c in p.candidates]
    return PositionResponse(
        id=p.id,
        election_id=p.election_id,
        title=p.title,
        description=p.description,
        min_selections=p.min_selections,
        max_selections=p.max_selections,
        display_order=p.display_order,
        candidates=cands,
    )


def serialize_election(e: Election) -> ElectionResponse:
    return ElectionResponse(
        id=e.id,
        organization_id=e.organization_id,
        title=e.title,
        description=e.description,
        status=e.status,
        opens_at=e.opens_at,
        closes_at=e.closes_at,
        timezone=e.timezone,
        voting_method=e.voting_method,
        configuration_version=e.configuration_version,
        configuration_hash=e.configuration_hash,
        created_by=e.created_by,
        created_at=e.created_at,
        updated_at=e.updated_at,
    )


def serialize_election_detail(e: Election) -> ElectionDetailResponse:
    base = serialize_election(e)
    return ElectionDetailResponse(
        **base.model_dump(),
        positions=[serialize_position(p) for p in e.positions] if e.positions else [],
    )


# 1. Election CRUD
@router.get("/elections", response_model=ApiResponse[list[ElectionResponse]])
async def list_elections(
    organization_id: uuid.UUID | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_election_session),
) -> ApiResponse[list[ElectionResponse]]:
    """List elections filtered by organization and/or lifecycle status."""
    elections = await ElectionService.list_elections(
        db, organization_id=organization_id, status=status
    )
    return ApiResponse(
        data=[serialize_election(e) for e in elections],
        error=None,
    )


@router.post(
    "/elections", response_model=ApiResponse[ElectionResponse], status_code=status.HTTP_201_CREATED
)
async def create_election(
    req: CreateElectionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_election_session),
) -> ApiResponse[ElectionResponse]:
    """Create a new draft election for an organization."""
    election = await ElectionService.create_election(db, current_user, req)
    return ApiResponse(
        data=serialize_election(election),
        error=None,
    )


@router.get("/elections/{election_id}", response_model=ApiResponse[ElectionDetailResponse])
async def get_election(
    election_id: uuid.UUID,
    db: AsyncSession = Depends(get_election_session),
) -> ApiResponse[ElectionDetailResponse]:
    """Retrieve election details including positions, candidates, and configuration lock state."""
    election = await ElectionService.get_election(db, election_id, include_positions=True)
    return ApiResponse(
        data=serialize_election_detail(election),
        error=None,
    )


@router.patch("/elections/{election_id}", response_model=ApiResponse[ElectionResponse])
async def update_election(
    election_id: uuid.UUID,
    req: UpdateElectionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_election_session),
) -> ApiResponse[ElectionResponse]:
    """Update draft election configuration before scheduling."""
    updated = await ElectionService.update_election(db, current_user, election_id, req)
    return ApiResponse(
        data=serialize_election(updated),
        error=None,
    )


# 2. Positions Management
@router.post(
    "/elections/{election_id}/positions",
    response_model=ApiResponse[PositionResponse],
    status_code=status.HTTP_201_CREATED,
)
async def add_position(
    election_id: uuid.UUID,
    req: CreatePositionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_election_session),
) -> ApiResponse[PositionResponse]:
    """Add a ballot position to a draft election."""
    position = await ElectionService.add_position(db, current_user, election_id, req)
    return ApiResponse(
        data=serialize_position(position),
        error=None,
    )


@router.patch("/positions/{position_id}", response_model=ApiResponse[PositionResponse])
async def update_position(
    position_id: uuid.UUID,
    req: UpdatePositionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_election_session),
) -> ApiResponse[PositionResponse]:
    """Update position settings before configuration lock."""
    updated = await ElectionService.update_position(db, current_user, position_id, req)
    return ApiResponse(
        data=serialize_position(updated),
        error=None,
    )


@router.delete("/positions/{position_id}", response_model=ApiResponse[dict])
async def delete_position(
    position_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_election_session),
) -> ApiResponse[dict]:
    """Remove a position from a draft election."""
    await ElectionService.delete_position(db, current_user, position_id)
    return ApiResponse(
        data={"message": "Position deleted successfully"},
        error=None,
    )


# 3. Candidates Management
@router.post(
    "/positions/{position_id}/candidates",
    response_model=ApiResponse[CandidateResponse],
    status_code=status.HTTP_201_CREATED,
)
async def add_candidate(
    position_id: uuid.UUID,
    req: CreateCandidateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_election_session),
) -> ApiResponse[CandidateResponse]:
    """Add a candidate to a ballot position before configuration lock."""
    candidate = await ElectionService.add_candidate(db, current_user, position_id, req)
    return ApiResponse(
        data=serialize_candidate(candidate),
        error=None,
    )


@router.patch("/candidates/{candidate_id}", response_model=ApiResponse[CandidateResponse])
async def update_candidate(
    candidate_id: uuid.UUID,
    req: UpdateCandidateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_election_session),
) -> ApiResponse[CandidateResponse]:
    """Update candidate details before configuration lock, or update withdrawal status."""
    updated = await ElectionService.update_candidate(db, current_user, candidate_id, req)
    return ApiResponse(
        data=serialize_candidate(updated),
        error=None,
    )


@router.delete("/candidates/{candidate_id}", response_model=ApiResponse[dict])
async def delete_candidate(
    candidate_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_election_session),
) -> ApiResponse[dict]:
    """Remove a candidate from a draft position."""
    await ElectionService.delete_candidate(db, current_user, candidate_id)
    return ApiResponse(
        data={"message": "Candidate deleted successfully"},
        error=None,
    )


# 4. Lifecycle Transitions & Approvals
@router.post("/elections/{election_id}/approve-launch", response_model=ApiResponse[dict])
async def approve_launch(
    election_id: uuid.UUID,
    req: LaunchApprovalRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_election_session),
) -> ApiResponse[dict]:
    """Record launch approval prerequisite for scheduling."""
    approval = await ElectionService.approve_launch(db, current_user, election_id, req)
    return ApiResponse(
        data={"approval_id": str(approval.id), "decision": approval.decision},
        error=None,
    )


@router.post(
    "/elections/{election_id}/schedule", response_model=ApiResponse[ElectionDetailResponse]
)
async def schedule_election(
    election_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_election_session),
) -> ApiResponse[ElectionDetailResponse]:
    """Freeze configuration, calculate configuration hash, and transition to SCHEDULED."""
    election = await ElectionService.schedule_election(db, current_user, election_id)
    return ApiResponse(
        data=serialize_election_detail(election),
        error=None,
    )


@router.post("/elections/{election_id}/open", response_model=ApiResponse[ElectionDetailResponse])
async def open_election(
    election_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_election_session),
) -> ApiResponse[ElectionDetailResponse]:
    """Open election for voting after validating configuration hash integrity."""
    election = await ElectionService.open_election(db, current_user, election_id)
    return ApiResponse(
        data=serialize_election_detail(election),
        error=None,
    )


@router.post("/elections/{election_id}/close", response_model=ApiResponse[ElectionDetailResponse])
async def close_election(
    election_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_election_session),
) -> ApiResponse[ElectionDetailResponse]:
    """Close an open election, freezing ballot collections for tallying."""
    election = await ElectionService.close_election(db, current_user, election_id)
    return ApiResponse(
        data=serialize_election_detail(election),
        error=None,
    )


@router.post("/elections/{election_id}/cancel", response_model=ApiResponse[ElectionDetailResponse])
async def cancel_election(
    election_id: uuid.UUID,
    req: CancelElectionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_election_session),
) -> ApiResponse[ElectionDetailResponse]:
    """Cancel election under documented audit policy."""
    election = await ElectionService.cancel_election(db, current_user, election_id, req)
    return ApiResponse(
        data=serialize_election_detail(election),
        error=None,
    )


@router.get("/elections/{election_id}/audit", response_model=ApiResponse[list[AuditEventResponse]])
async def get_audit_trail(
    election_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_election_session),
) -> ApiResponse[list[AuditEventResponse]]:
    """Retrieve immutable audit event trail for an election."""
    events = await ElectionService.get_audit_trail(db, election_id)
    import json

    return ApiResponse(
        data=[
            AuditEventResponse(
                id=ev.id,
                organization_id=ev.organization_id,
                election_id=ev.election_id,
                actor_id=ev.actor_id,
                event_type=ev.event_type,
                outcome=ev.outcome,
                metadata=json.loads(ev.metadata_json) if ev.metadata_json else {},
                created_at=ev.created_at,
            )
            for ev in events
        ],
        error=None,
    )

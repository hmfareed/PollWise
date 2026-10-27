"""
Pollwise Election Tally and Results API Endpoints
"""

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import (
    get_current_user,
    get_current_user_optional,
    verify_user_organization_role,
)
from app.db.session import (
    get_ballot_session,
    get_election_session,
    get_identity_session,
)
from app.models.identity import User
from app.schemas.results import ApproveResultsRequest, ElectionResultResponse
from app.services.election_service import ElectionService
from app.services.tally_service import TallyService

router = APIRouter(tags=["Results & Tally"])


@router.post(
    "/elections/{id}/tally",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def compute_tally(
    id: uuid.UUID,
    ballot_session: AsyncSession = Depends(get_ballot_session),
    election_session: AsyncSession = Depends(get_election_session),
    identity_session: AsyncSession = Depends(get_identity_session),
    current_user: User = Depends(get_current_user),
):
    """Calculate deterministic tally for a closed election (Manager / Admin only)."""
    election = await ElectionService.get_election(election_session, id)
    await verify_user_organization_role(
        identity_session, current_user, election.organization_id, ["organization_admin", "election_manager"]
    )

    await TallyService.compute_tally(
        ballot_session=ballot_session,
        election_session=election_session,
        election_id=id,
        actor=current_user,
    )
    result_data = await TallyService.get_results(election_session, id, can_view_unapproved=True)
    return {"data": ElectionResultResponse(**result_data), "error": None}


@router.get(
    "/elections/{id}/results",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def get_election_results(
    id: uuid.UUID,
    election_session: AsyncSession = Depends(get_election_session),
    identity_session: AsyncSession = Depends(get_identity_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Retrieve election results.
    Strict Secrecy Gate (Doc 08 & 09):
    Hidden from ordinary voters until published.
    Managers/auditors can view interim results.
    """
    election = await ElectionService.get_election(election_session, id)

    can_view_unapproved = False
    if current_user:
        try:
            await verify_user_organization_role(
                identity_session, current_user, election.organization_id, ["organization_admin", "election_manager", "auditor"]
            )
            can_view_unapproved = True
        except Exception:  # noqa: BLE001
            can_view_unapproved = False

    result_data = await TallyService.get_results(
        election_session, id, can_view_unapproved=can_view_unapproved
    )
    return {"data": ElectionResultResponse(**result_data), "error": None}


@router.post(
    "/elections/{id}/results/{result_id}/approve",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def approve_tally(
    id: uuid.UUID,
    result_id: uuid.UUID,
    payload: ApproveResultsRequest,
    election_session: AsyncSession = Depends(get_election_session),
    identity_session: AsyncSession = Depends(get_identity_session),
    current_user: User = Depends(get_current_user),
):
    """Record formal managerial approval of computed results."""
    election = await ElectionService.get_election(election_session, id)
    await verify_user_organization_role(
        identity_session, current_user, election.organization_id, ["organization_admin", "election_manager"]
    )

    approval = await TallyService.approve_tally(
        election_session=election_session,
        election_id=id,
        result_id=result_id,
        approver=current_user,
        decision=payload.decision,
        reason=payload.reason,
    )
    return {
        "data": {
            "approval_id": str(approval.id),
            "decision": approval.decision,
            "status": "approved",
        },
        "error": None,
    }


@router.post(
    "/elections/{id}/publish",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def publish_results(
    id: uuid.UUID,
    election_session: AsyncSession = Depends(get_election_session),
    identity_session: AsyncSession = Depends(get_identity_session),
    current_user: User = Depends(get_current_user),
):
    """Publish approved election results for public inspection."""
    election = await ElectionService.get_election(election_session, id)
    await verify_user_organization_role(
        identity_session, current_user, election.organization_id, ["organization_admin", "election_manager"]
    )

    updated_election = await TallyService.publish_results(
        election_session=election_session,
        election_id=id,
        actor=current_user,
    )
    return {
        "data": {
            "election_id": str(updated_election.id),
            "status": updated_election.status,
            "published": True,
        },
        "error": None,
    }

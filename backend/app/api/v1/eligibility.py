"""
Pollwise Voter Eligibility & Credential Issuance API Endpoints
"""

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, verify_user_organization_role
from app.db.session import get_election_session, get_identity_session
from app.models.identity import User
from app.schemas.eligibility import (
    AddEligibilityRequest,
    BulkEligibilityImportRequest,
    BulkEligibilityImportResponse,
    ConfirmRedemptionRequest,
    EligibilityResponse,
    ParticipationStatusResponse,
    VotingCredentialResponse,
)
from app.services.election_service import ElectionService
from app.services.eligibility_service import EligibilityService

router = APIRouter(tags=["Eligibility & Participation"])


@router.get(
    "/elections/{id}/eligibility",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def list_election_eligibility(
    id: uuid.UUID,
    identity_session: AsyncSession = Depends(get_identity_session),
    election_session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    """List all authorized eligible voters for an election (Manager/Admin only)."""
    election = await ElectionService.get_election(election_session, id)
    await verify_user_organization_role(
        identity_session, current_user, election.organization_id, ["organization_admin", "election_manager", "auditor"]
    )

    records = await EligibilityService.list_eligibility(identity_session, id)
    items = []
    for elig, email, name in records:
        items.append(
            EligibilityResponse(
                id=elig.id,
                election_id=elig.election_id,
                user_id=elig.user_id,
                user_email=email,
                user_name=name,
                eligibility_status=elig.eligibility_status,
                entitlement_status=elig.entitlement_status,
                created_at=elig.created_at,
            )
        )
    return {"data": items, "error": None}


@router.post(
    "/elections/{id}/eligibility",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
)
async def add_eligible_voter(
    id: uuid.UUID,
    payload: AddEligibilityRequest,
    identity_session: AsyncSession = Depends(get_identity_session),
    election_session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    """Add an individual eligible voter to an election roll."""
    election = await ElectionService.get_election(election_session, id)
    await verify_user_organization_role(
        identity_session, current_user, election.organization_id, ["organization_admin", "election_manager"]
    )

    record = await EligibilityService.add_eligible_voter(
        identity_session, id, user_id=payload.user_id, email=payload.email
    )
    return {
        "data": EligibilityResponse(
            id=record.id,
            election_id=record.election_id,
            user_id=record.user_id,
            eligibility_status=record.eligibility_status,
            entitlement_status=record.entitlement_status,
            created_at=record.created_at,
        ),
        "error": None,
    }


@router.post(
    "/elections/{id}/eligibility/import",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def bulk_import_eligibility(
    id: uuid.UUID,
    payload: BulkEligibilityImportRequest,
    identity_session: AsyncSession = Depends(get_identity_session),
    election_session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    """Bulk import eligible voters by list of email addresses."""
    election = await ElectionService.get_election(election_session, id)
    await verify_user_organization_role(
        identity_session, current_user, election.organization_id, ["organization_admin", "election_manager"]
    )

    result = await EligibilityService.bulk_import_eligibility(
        identity_session, id, [str(e) for e in payload.emails]
    )
    return {
        "data": BulkEligibilityImportResponse(**result),
        "error": None,
    }


@router.delete(
    "/elections/{id}/eligibility/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def revoke_voter_eligibility(
    id: uuid.UUID,
    record_id: uuid.UUID,
    identity_session: AsyncSession = Depends(get_identity_session),
    election_session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    """Revoke a voter's eligibility before ballot redemption."""
    election = await ElectionService.get_election(election_session, id)
    await verify_user_organization_role(
        identity_session, current_user, election.organization_id, ["organization_admin", "election_manager"]
    )
    await EligibilityService.revoke_eligibility(identity_session, id, record_id)


@router.get(
    "/elections/{id}/participation/me",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def get_my_participation_status(
    id: uuid.UUID,
    identity_session: AsyncSession = Depends(get_identity_session),
    current_user: User = Depends(get_current_user),
):
    """Check current user's eligibility and participation status without revealing ballots."""
    status_info = await EligibilityService.get_user_participation(
        identity_session, id, current_user.id
    )
    return {"data": ParticipationStatusResponse(**status_info), "error": None}


@router.post(
    "/elections/{id}/voting-credential",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def request_voting_credential(
    id: uuid.UUID,
    identity_session: AsyncSession = Depends(get_identity_session),
    election_session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    """
    Obtain a single-use bearer voting credential.
    Strictly verifies email verification, eligibility, open election status, and unused entitlement.
    """
    result = await EligibilityService.issue_voting_credential(
        identity_session=identity_session,
        election_session=election_session,
        election_id=id,
        user=current_user,
    )
    return {
        "data": VotingCredentialResponse(**result),
        "error": None,
    }


@router.post(
    "/elections/{id}/confirm-redemption",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def confirm_ballot_redemption(
    id: uuid.UUID,
    payload: ConfirmRedemptionRequest,
    identity_session: AsyncSession = Depends(get_identity_session),
    current_user: User = Depends(get_current_user),
):
    """
    Confirm that the client submitted their ballot and received a valid receipt reference,
    advancing entitlement status to 'redeemed'.
    """
    await EligibilityService.confirm_redemption(identity_session, id, current_user.id)
    return {"data": {"status": "redeemed"}, "error": None}

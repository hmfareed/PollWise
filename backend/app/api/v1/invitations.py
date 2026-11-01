from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_identity_session
from app.models.identity import User
from app.schemas.auth import (
    AcceptInvitationRequest,
    InvitationValidationResponse,
    ValidateInvitationRequest,
)
from app.schemas.common import ApiResponse
from app.services.personal_onboarding_service import PersonalOnboardingService

router = APIRouter(prefix="/institutions/invitations", tags=["Institution Invitations"])


@router.post("/validate", response_model=ApiResponse[InvitationValidationResponse])
async def validate_invitation(
    req: ValidateInvitationRequest,
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[InvitationValidationResponse]:
    """Validate institution invitation code status and details."""
    validation = await PersonalOnboardingService.validate_invitation(db, req.invitation_code)
    return ApiResponse(data=validation, error=None)


@router.post("/accept", response_model=ApiResponse[dict])
async def accept_invitation(
    req: AcceptInvitationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[dict]:
    """Accept institution invitation and link user as active member."""
    result = await PersonalOnboardingService.accept_invitation(db, current_user, req.invitation_code)
    return ApiResponse(data=result, error=None)

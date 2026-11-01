from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_token_from_request
from app.core.rate_limit import rate_limit_login
from app.db.session import get_election_session, get_identity_session
from app.models.identity import User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MeResponse,
    MfaSetupResponse,
    MfaVerifyRequest,
    PersonalOnboardingResponse,
    PersonalRegisterRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    UpdatePersonalOnboardingRequest,
    UpdateUserProfileRequest,
    UserElectionSummary,
    UserResponse,
    VerifyEmailRequest,
)
from app.schemas.common import ApiResponse
from app.services.auth_service import AuthService
from app.services.personal_onboarding_service import PersonalOnboardingService

router = APIRouter(prefix="/auth", tags=["Authentication & Identity"])
users_router = APIRouter(prefix="/users", tags=["User Profile & Onboarding"])


@router.post(
    "/register", response_model=ApiResponse[UserResponse], status_code=status.HTTP_201_CREATED
)
async def register(
    req: RegisterRequest,
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[UserResponse]:
    """Register a new user account."""
    user, _ = await AuthService.register(db, req)
    return ApiResponse(
        data=AuthService.serialize_user(user),
        error=None,
    )


@router.post(
    "/register/personal",
    response_model=ApiResponse[UserResponse],
    status_code=status.HTTP_201_CREATED,
)
async def register_personal(
    req: PersonalRegisterRequest,
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[UserResponse]:
    """Register a new personal user account."""
    user, _ = await PersonalOnboardingService.register_personal(db, req)
    return ApiResponse(
        data=AuthService.serialize_user(user),
        error=None,
    )


@router.post(
    "/login",
    response_model=ApiResponse[MeResponse],
    dependencies=[Depends(rate_limit_login)],
)
async def login(
    req: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[MeResponse]:
    """Authenticate with email and password, establishing a secure HttpOnly session."""
    user, _ = await AuthService.login(db, req.email, req.password, request, response)
    return ApiResponse(
        data=AuthService.serialize_me(user),
        error=None,
    )


@router.post("/logout", response_model=ApiResponse[dict])
async def logout(
    response: Response,
    raw_token: str | None = Depends(get_token_from_request),
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[dict]:
    """Revoke current session and remove cookie."""
    await AuthService.logout(db, raw_token, response)
    return ApiResponse(
        data={"message": "Logged out successfully"},
        error=None,
    )


@router.get("/me", response_model=ApiResponse[MeResponse])
async def get_me(
    current_user: User = Depends(get_current_user),
) -> ApiResponse[MeResponse]:
    """Retrieve profile and organizational memberships for authenticated user."""
    return ApiResponse(
        data=AuthService.serialize_me(current_user),
        error=None,
    )


@router.post("/verify-email", response_model=ApiResponse[UserResponse])
async def verify_email(
    req: VerifyEmailRequest,
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[UserResponse]:
    """Confirm user email address via single-use verification token."""
    user = await AuthService.verify_email(db, req.token)
    return ApiResponse(
        data=AuthService.serialize_user(user),
        error=None,
    )


@router.post("/resend-verification", response_model=ApiResponse[dict])
async def resend_verification(
    req: ResendVerificationRequest,
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[dict]:
    """Resend email verification link. Always returns generic success to prevent email enumeration."""
    await AuthService.resend_verification(db, req.email)
    return ApiResponse(
        data={"message": "If this account requires verification, a new confirmation link has been sent."},
        error=None,
    )


@router.post("/forgot-password", response_model=ApiResponse[dict])
async def forgot_password(
    req: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[dict]:
    """Initiate password recovery. Always returns generic success to prevent email enumeration."""
    await AuthService.forgot_password(db, req.email)
    return ApiResponse(
        data={"message": "If this email is registered, recovery instructions have been sent."},
        error=None,
    )


@router.post("/reset-password", response_model=ApiResponse[dict])
async def reset_password(
    req: ResetPasswordRequest,
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[dict]:
    """Complete password recovery using a single-use token and revoke prior sessions."""
    await AuthService.reset_password(db, req.token, req.new_password)
    return ApiResponse(
        data={"message": "Password updated successfully. Please log in with your new credentials."},
        error=None,
    )


@router.post("/change-password", response_model=ApiResponse[dict])
async def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[dict]:
    """Change account password for authenticated user."""
    await AuthService.change_password(db, current_user, req.current_password, req.new_password)
    return ApiResponse(
        data={"message": "Password changed successfully."},
        error=None,
    )


@users_router.get("/me/onboarding", response_model=ApiResponse[PersonalOnboardingResponse])
async def get_my_onboarding(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[PersonalOnboardingResponse]:
    """Retrieve current user's personal onboarding progress."""
    onboarding = await PersonalOnboardingService.get_onboarding(db, current_user.id)
    return ApiResponse(
        data=PersonalOnboardingService.serialize_onboarding(onboarding),
        error=None,
    )


@users_router.patch("/me/onboarding", response_model=ApiResponse[PersonalOnboardingResponse])
async def update_my_onboarding(
    req: UpdatePersonalOnboardingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[PersonalOnboardingResponse]:
    """Update current user's personal onboarding step or status."""
    onboarding = await PersonalOnboardingService.update_onboarding(db, current_user.id, req)
    return ApiResponse(
        data=PersonalOnboardingService.serialize_onboarding(onboarding),
        error=None,
    )


@users_router.patch("/me/profile", response_model=ApiResponse[UserResponse])
@users_router.patch("/me", response_model=ApiResponse[UserResponse])
async def update_my_profile(
    req: UpdateUserProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[UserResponse]:
    """Update personal profile information."""
    updated_user = await PersonalOnboardingService.update_profile(db, current_user, req)
    return ApiResponse(
        data=AuthService.serialize_user(updated_user),
        error=None,
    )


@users_router.post("/me/mfa/setup", response_model=ApiResponse[MfaSetupResponse])
async def setup_my_mfa(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[MfaSetupResponse]:
    """Generate MFA secret, TOTP QR URI, and emergency recovery codes."""
    res = await PersonalOnboardingService.setup_mfa(db, current_user)
    return ApiResponse(data=res, error=None)


@users_router.post("/me/mfa/verify", response_model=ApiResponse[dict])
async def verify_my_mfa(
    req: MfaVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[dict]:
    """Verify MFA code and enable two-factor authentication."""
    updated_user = await PersonalOnboardingService.verify_mfa(db, current_user, req.code)
    return ApiResponse(
        data={"message": "MFA verified and enabled successfully.", "mfa_enabled": updated_user.mfa_enabled},
        error=None,
    )


@users_router.get("/me/elections", response_model=ApiResponse[list[UserElectionSummary]])
async def get_my_elections(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_identity_session),
    election_db: AsyncSession = Depends(get_election_session),
) -> ApiResponse[list[UserElectionSummary]]:
    """Retrieve accessible elections and participation status for authenticated user."""
    elections = await PersonalOnboardingService.get_user_elections(
        db, current_user, election_db=election_db
    )
    return ApiResponse(data=elections, error=None)


# Also mount user routes on auth router to support both /users/me/... and /auth/users/me/...
router.include_router(users_router)


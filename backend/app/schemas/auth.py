import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models.identity import OnboardingStatus


class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., description="Institutional or organizational email address")
    password: str = Field(
        ..., min_length=8, max_length=128, description="Account password (min 8 characters)"
    )
    display_name: str | None = Field(
        default=None, min_length=2, max_length=100, description="Full or display name"
    )
    account_type: str = Field(default="personal", description="personal | institution")
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    terms_accepted: bool = Field(default=True)
    institution_name: str | None = Field(default=None, max_length=255)
    institution_type: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def validate_names_and_institution(self) -> "RegisterRequest":
        if not self.display_name:
            if self.first_name and self.last_name:
                self.display_name = f"{self.first_name.strip()} {self.last_name.strip()}"
            elif self.first_name:
                self.display_name = self.first_name.strip()
            else:
                raise ValueError("Either display_name or first_name and last_name are required.")

        if self.account_type == "institution":
            if not self.institution_name or not self.institution_name.strip():
                raise ValueError("Institution name is required for institution accounts.")
            if not self.institution_type or not self.institution_type.strip():
                raise ValueError("Institution type is required for institution accounts.")
            if not self.country or not self.country.strip():
                raise ValueError("Country is required for institution accounts.")
        return self


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="Account password")


class PersonalRegisterRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100, description="First name")
    last_name: str = Field(..., min_length=1, max_length=100, description="Last name")
    email: EmailStr = Field(..., description="Email address")
    password: str = Field(
        ..., min_length=8, max_length=128, description="Account password (min 8 characters)"
    )
    terms_accepted: bool = Field(..., description="Agreement to Terms of Service and Privacy Policy")

    @model_validator(mode="after")
    def validate_fields(self) -> "PersonalRegisterRequest":
        self.first_name = self.first_name.strip()
        self.last_name = self.last_name.strip()
        if not self.first_name:
            raise ValueError("First name cannot be empty.")
        if not self.last_name:
            raise ValueError("Last name cannot be empty.")
        if not self.terms_accepted:
            raise ValueError("You must agree to the Terms of Service and Privacy Policy.")
        return self


class PersonalOnboardingResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    onboarding_status: str
    current_step: int
    profile_completed_at: datetime | None = None
    security_setup_completed_at: datetime | None = None
    institution_step_completed_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class UpdatePersonalOnboardingRequest(BaseModel):
    current_step: int | None = Field(default=None, ge=1, le=5)
    onboarding_status: str | None = Field(default=None)

    @field_validator("onboarding_status")
    @classmethod
    def validate_onboarding_status(cls, v: str | None) -> str | None:
        if v is not None:
            valid_statuses = {s.value for s in OnboardingStatus}
            if v not in valid_statuses:
                raise ValueError(
                    f"Invalid onboarding status '{v}'. Must be one of: {', '.join(sorted(valid_statuses))}"
                )
        return v


class UpdateUserProfileRequest(BaseModel):
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    display_name: str | None = Field(default=None, max_length=255)
    phone_number: str | None = Field(default=None, max_length=50)
    profile_image_url: str | None = Field(default=None, max_length=512)
    country: str | None = Field(default=None, max_length=100)
    preferred_language: str | None = Field(default=None, max_length=20)


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    email_verified: bool
    account_status: str
    is_platform_admin: bool
    created_at: datetime
    first_name: str | None = None
    last_name: str | None = None
    phone_number: str | None = None
    profile_image_url: str | None = None
    country: str | None = None
    preferred_language: str | None = "en"
    mfa_enabled: bool = False
    account_type: str = "personal"

    model_config = ConfigDict(from_attributes=True)


class MembershipSummary(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    organization_name: str
    organization_slug: str
    role: str
    status: str


class MeResponse(BaseModel):
    user: UserResponse
    memberships: list[MembershipSummary]


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=1, description="Verification token received via email")


class ResendVerificationRequest(BaseModel):
    email: EmailStr = Field(..., description="User account email")


class ForgotPasswordRequest(BaseModel):
    email: EmailStr = Field(..., description="User account email")


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1, description="Password reset token")
    new_password: str = Field(..., min_length=8, max_length=128, description="New password")


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, description="Current account password")
    new_password: str = Field(
        ..., min_length=8, max_length=128, description="New account password (min 8 characters)"
    )


class MfaSetupResponse(BaseModel):
    secret: str
    qr_uri: str
    recovery_codes: list[str]


class MfaVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=8, description="6-8 digit MFA verification code")


class ValidateInvitationRequest(BaseModel):
    invitation_code: str = Field(..., min_length=1, description="Institution invitation code")


class InvitationValidationResponse(BaseModel):
    invitation_code: str
    institution_id: uuid.UUID
    institution_name: str
    invitation_type: str
    expires_at: datetime | None = None


class AcceptInvitationRequest(BaseModel):
    invitation_code: str = Field(..., min_length=1, description="Institution invitation code to accept")


class UserElectionSummary(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    start_time: datetime | None = None
    end_time: datetime | None = None
    institution_name: str | None = None
    has_voted: bool = False


ElectionSummary = UserElectionSummary

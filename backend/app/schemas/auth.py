import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator


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


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    email_verified: bool
    account_status: str
    is_platform_admin: bool
    created_at: datetime


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

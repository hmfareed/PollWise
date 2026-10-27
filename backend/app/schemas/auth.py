import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., description="Institutional or organizational email address")
    password: str = Field(
        ..., min_length=8, max_length=128, description="Account password (min 8 characters)"
    )
    display_name: str = Field(..., min_length=2, max_length=100, description="Full or display name")


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


class ForgotPasswordRequest(BaseModel):
    email: EmailStr = Field(..., description="User account email")


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1, description="Password reset token")
    new_password: str = Field(..., min_length=8, max_length=128, description="New password")

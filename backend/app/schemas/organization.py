import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class CreateOrganizationRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Official organization name")
    slug: str | None = Field(
        None,
        min_length=2,
        max_length=100,
        pattern=r"^[a-z0-9-]+$",
        description="URL-safe unique identifier",
    )


class UpdateOrganizationRequest(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=255)
    status: str | None = Field(None, description="active | suspended")


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    status: str
    created_at: datetime


class AddMemberRequest(BaseModel):
    email: str = Field(..., description="Email of existing user to add or invite")
    role: str = Field(
        default="member", description="organization_admin | election_manager | auditor | member"
    )


class UpdateMemberRequest(BaseModel):
    role: str | None = Field(
        None, description="organization_admin | election_manager | auditor | member"
    )
    status: str | None = Field(None, description="active | suspended | removed")


class MemberDetailResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    display_name: str
    role: str
    status: str
    created_at: datetime

import uuid
from datetime import datetime
from typing import Literal

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
    metadata: dict | None = None
    created_at: datetime


class InstitutionStructureUnit(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    unit_type: str = Field(
        default="department", description="faculty | department | school | committee | other"
    )


class OrganizationOnboardingRequest(BaseModel):
    institution_name: str | None = None
    abbreviation: str | None = None
    institution_type: str | None = None
    country: str | None = None
    region: str | None = None
    city: str | None = None
    website: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    logo_url: str | None = None

    description: str | None = None
    approximate_members: int | None = None
    department_count: int | None = None
    registration_identifier: str | None = None

    admin_title: str | None = None
    admin_department: str | None = None
    admin_phone: str | None = None

    structure_units: list[InstitutionStructureUnit] = Field(default_factory=list)

    mfa_policy: str = Field(default="optional", description="optional | recommended | required")
    approved_domains: list[str] = Field(default_factory=list)
    invitation_permission: str = Field(
        default="admin_only", description="admin_only | managers_and_admins"
    )
    session_idle_minutes: int = Field(default=60)
    session_absolute_hours: int = Field(default=12)
    require_dual_approval_for_launch: bool = Field(default=False)

    is_completed: bool = Field(
        default=True, description="True to activate organization, False to save as draft"
    )


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


class SubmitForReviewResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    status: str
    created_at: datetime


class UpdateOrgStatusRequest(BaseModel):
    status: Literal["verified", "rejected", "suspended"]
    reason: str | None = Field(None, description="Optional reason for the status change")

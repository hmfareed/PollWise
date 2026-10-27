import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import (
    get_current_user,
    require_organization_role,
)
from app.db.session import get_identity_session
from app.models.identity import (
    OrganizationMembership,
    OrganizationRole,
    User,
)
from app.schemas.common import ApiResponse
from app.schemas.organization import (
    AddMemberRequest,
    CreateOrganizationRequest,
    MemberDetailResponse,
    OrganizationResponse,
    UpdateMemberRequest,
    UpdateOrganizationRequest,
)
from app.services.organization_service import OrganizationService

router = APIRouter(prefix="/organizations", tags=["Organizations & Memberships"])


@router.get("", response_model=ApiResponse[list[OrganizationResponse]])
async def list_organizations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[list[OrganizationResponse]]:
    """List organizations accessible to the current user."""
    orgs = await OrganizationService.list_organizations(db, current_user)
    return ApiResponse(
        data=[
            OrganizationResponse(
                id=o.id,
                name=o.name,
                slug=o.slug,
                status=o.status,
                created_at=o.created_at,
            )
            for o in orgs
        ],
        error=None,
    )


@router.post(
    "", response_model=ApiResponse[OrganizationResponse], status_code=status.HTTP_201_CREATED
)
async def create_organization(
    req: CreateOrganizationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[OrganizationResponse]:
    """Create a new organization. The creator automatically receives organization_admin role."""
    org = await OrganizationService.create_organization(db, current_user, req)
    return ApiResponse(
        data=OrganizationResponse(
            id=org.id,
            name=org.name,
            slug=org.slug,
            status=org.status,
            created_at=org.created_at,
        ),
        error=None,
    )


@router.get("/{organization_id}", response_model=ApiResponse[OrganizationResponse])
async def get_organization(
    organization_id: uuid.UUID,
    membership: OrganizationMembership = Depends(
        require_organization_role(
            [
                OrganizationRole.ORGANIZATION_ADMIN.value,
                OrganizationRole.ELECTION_MANAGER.value,
                OrganizationRole.AUDITOR.value,
                OrganizationRole.MEMBER.value,
            ]
        )
    ),
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[OrganizationResponse]:
    """Retrieve details for an authorized organization."""
    org = await OrganizationService.get_organization(db, organization_id)
    return ApiResponse(
        data=OrganizationResponse(
            id=org.id,
            name=org.name,
            slug=org.slug,
            status=org.status,
            created_at=org.created_at,
        ),
        error=None,
    )


@router.patch("/{organization_id}", response_model=ApiResponse[OrganizationResponse])
async def update_organization(
    organization_id: uuid.UUID,
    req: UpdateOrganizationRequest,
    membership: OrganizationMembership = Depends(
        require_organization_role([OrganizationRole.ORGANIZATION_ADMIN.value])
    ),
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[OrganizationResponse]:
    """Update organization settings (admin only)."""
    org = await OrganizationService.update_organization(db, organization_id, req)
    return ApiResponse(
        data=OrganizationResponse(
            id=org.id,
            name=org.name,
            slug=org.slug,
            status=org.status,
            created_at=org.created_at,
        ),
        error=None,
    )


@router.get("/{organization_id}/members", response_model=ApiResponse[list[MemberDetailResponse]])
async def list_members(
    organization_id: uuid.UUID,
    membership: OrganizationMembership = Depends(
        require_organization_role(
            [
                OrganizationRole.ORGANIZATION_ADMIN.value,
                OrganizationRole.ELECTION_MANAGER.value,
                OrganizationRole.AUDITOR.value,
            ]
        )
    ),
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[list[MemberDetailResponse]]:
    """List members and their roles for an organization."""
    members = await OrganizationService.list_members(db, organization_id)
    return ApiResponse(
        data=members,
        error=None,
    )


@router.post(
    "/{organization_id}/members",
    response_model=ApiResponse[MemberDetailResponse],
    status_code=status.HTTP_201_CREATED,
)
async def add_member(
    organization_id: uuid.UUID,
    req: AddMemberRequest,
    membership: OrganizationMembership = Depends(
        require_organization_role([OrganizationRole.ORGANIZATION_ADMIN.value])
    ),
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[MemberDetailResponse]:
    """Add or invite a registered user to the organization (admin only)."""
    member = await OrganizationService.add_member(db, organization_id, req)
    return ApiResponse(
        data=member,
        error=None,
    )


@router.patch(
    "/{organization_id}/members/{member_id}", response_model=ApiResponse[MemberDetailResponse]
)
async def update_member(
    organization_id: uuid.UUID,
    member_id: uuid.UUID,
    req: UpdateMemberRequest,
    membership: OrganizationMembership = Depends(
        require_organization_role([OrganizationRole.ORGANIZATION_ADMIN.value])
    ),
    db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[MemberDetailResponse]:
    """Update an existing member's role or status (admin only)."""
    updated = await OrganizationService.update_member(db, organization_id, member_id, req)
    return ApiResponse(
        data=updated,
        error=None,
    )

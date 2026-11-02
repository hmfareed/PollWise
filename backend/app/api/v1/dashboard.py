import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_organization_role
from app.db.session import get_election_session, get_identity_session
from app.models.identity import OrganizationMembership, OrganizationRole
from app.schemas.common import ApiResponse
from app.schemas.dashboard import DashboardSummaryResponse
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/organizations", tags=["Dashboard"])

ALLOWED_DASHBOARD_ROLES = [
    OrganizationRole.ORGANIZATION_ADMIN.value,
    OrganizationRole.ELECTION_MANAGER.value,
    OrganizationRole.AUDITOR.value,
    "owner",
    "admin",
]

VALID_PERIODS = {"last_30_days", "last_3_months", "last_6_months", "last_12_months"}


@router.get(
    "/{organization_id}/dashboard/summary",
    response_model=ApiResponse[DashboardSummaryResponse],
)
async def get_dashboard_summary(
    organization_id: uuid.UUID,
    period: str = Query(
        default="last_12_months",
        description="Filter period: last_30_days, last_3_months, last_6_months, or last_12_months",
    ),
    membership: OrganizationMembership = Depends(
        require_organization_role(ALLOWED_DASHBOARD_ROLES)
    ),
    identity_db: AsyncSession = Depends(get_identity_session),
    election_db: AsyncSession = Depends(get_election_session),
) -> ApiResponse[DashboardSummaryResponse]:
    """Retrieve institution-scoped dashboard summary metrics, overview chart series, deadlines, and activity."""
    normalized_period = period if period in VALID_PERIODS else "last_12_months"
    summary = await DashboardService.get_institution_summary(
        identity_db=identity_db,
        election_db=election_db,
        organization_id=organization_id,
        period=normalized_period,
    )
    return ApiResponse(data=summary, error=None)

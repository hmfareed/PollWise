from fastapi import APIRouter, Response, status

from app.core.config import settings
from app.db import session as db_session
from app.schemas.common import ApiResponse
from app.schemas.health import HealthStatus, ReadinessStatus

router = APIRouter(tags=["Health & Monitoring"])


@router.get("/health", response_model=ApiResponse[HealthStatus])
async def health_check() -> ApiResponse[HealthStatus]:
    """Lightweight liveness probe."""
    return ApiResponse(
        data=HealthStatus(
            status="healthy",
            environment=settings.APP_ENV,
            version="0.1.0",
        ),
        error=None,
    )


@router.get("/ready", response_model=ApiResponse[ReadinessStatus])
async def readiness_check(response: Response) -> ApiResponse[ReadinessStatus]:
    """Readiness probe evaluating connectivity across isolated database engines."""
    db_statuses = await db_session.check_all_databases()
    all_ready = all(db_status.connected for db_status in db_statuses.values())

    if not all_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return ApiResponse(
        data=ReadinessStatus(
            ready=all_ready,
            databases=db_statuses,
        ),
        error=None,
    )

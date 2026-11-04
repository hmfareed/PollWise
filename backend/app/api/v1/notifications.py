import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_identity_session
from app.models.identity import User
from app.schemas.common import ApiResponse
from app.schemas.notification import (
    MarkAllReadResponse,
    NotificationListResponse,
    NotificationRead,
)
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=ApiResponse[NotificationListResponse])
async def list_user_notifications(
    unread_only: bool = Query(default=False, description="Filter for unread notifications only"),
    limit: int = Query(default=50, ge=1, le=100, description="Max notifications to retrieve"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination"),
    current_user: User = Depends(get_current_user),
    identity_db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[NotificationListResponse]:
    """Retrieve notifications and unread counters for the authenticated user."""
    result = await NotificationService.list_notifications(
        session=identity_db,
        user_id=current_user.id,
        unread_only=unread_only,
        limit=limit,
        offset=offset,
    )
    return ApiResponse(data=result, error=None)


@router.patch("/{notification_id}/read", response_model=ApiResponse[NotificationRead])
async def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    identity_db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[NotificationRead]:
    """Mark a specific notification as read."""
    notification = await NotificationService.mark_as_read(
        session=identity_db,
        user_id=current_user.id,
        notification_id=notification_id,
    )
    return ApiResponse(data=NotificationRead.model_validate(notification), error=None)


@router.post("/mark-all-read", response_model=ApiResponse[MarkAllReadResponse])
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    identity_db: AsyncSession = Depends(get_identity_session),
) -> ApiResponse[MarkAllReadResponse]:
    """Mark all unread notifications as read for the authenticated user."""
    count = await NotificationService.mark_all_as_read(
        session=identity_db,
        user_id=current_user.id,
    )
    return ApiResponse(data=MarkAllReadResponse(success=True, marked_count=count), error=None)

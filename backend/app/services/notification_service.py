import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException, ErrorCode
from app.models.identity import Notification
from app.schemas.notification import NotificationListResponse, NotificationRead


class NotificationService:
    @classmethod
    async def create_notification(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
        title: str,
        message: str,
        notification_type: str = "system",
        action_url: str | None = None,
        meta_data: str | None = None,
    ) -> Notification:
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
            action_url=action_url,
            meta_data=meta_data,
            is_read=False,
            created_at=datetime.now(UTC),
        )
        session.add(notification)
        await session.commit()
        await session.refresh(notification)
        return notification

    @classmethod
    async def list_notifications(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
        unread_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> NotificationListResponse:
        total_stmt = select(func.count(Notification.id)).where(Notification.user_id == user_id)
        total_res = await session.execute(total_stmt)
        total_count = total_res.scalar() or 0

        unread_stmt = select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.is_read == False,  # noqa: E712
        )
        unread_res = await session.execute(unread_stmt)
        unread_count = unread_res.scalar() or 0

        query = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            query = query.where(Notification.is_read == False)  # noqa: E712
        query = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit)

        result = await session.execute(query)
        notifications = list(result.scalars().all())

        return NotificationListResponse(
            notifications=[NotificationRead.model_validate(n) for n in notifications],
            total_count=total_count,
            unread_count=unread_count,
        )

    @classmethod
    async def mark_as_read(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
        notification_id: uuid.UUID,
    ) -> Notification:
        stmt = select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
        res = await session.execute(stmt)
        notification = res.scalar_one_or_none()
        if not notification:
            raise AppException(
                status_code=404,
                code=ErrorCode.NOT_FOUND,
                message="Notification not found",
            )

        if not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.now(UTC)
            await session.commit()
            await session.refresh(notification)

        return notification

    @classmethod
    async def mark_all_as_read(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
    ) -> int:
        stmt = (
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read == False,  # noqa: E712
            )
            .values(
                is_read=True,
                read_at=datetime.now(UTC),
            )
        )
        res = await session.execute(stmt)
        await session.commit()
        return res.rowcount

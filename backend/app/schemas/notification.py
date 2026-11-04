import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    message: str
    notification_type: str
    action_url: str | None = None
    is_read: bool
    read_at: datetime | None = None
    created_at: datetime
    meta_data: str | None = None

    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    notifications: list[NotificationRead]
    total_count: int
    unread_count: int


class MarkAllReadResponse(BaseModel):
    success: bool
    marked_count: int

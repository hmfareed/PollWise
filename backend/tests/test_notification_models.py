import uuid
from datetime import UTC, datetime
import pytest

from app.models.identity import Notification, User
from app.schemas.notification import NotificationListResponse, NotificationRead


@pytest.mark.asyncio
async def test_notification_model_and_schema(test_identity_session):
    user = User(
        email_normalized="notify_test@example.com",
        password_hash="fakehash",
        display_name="Notify User",
        account_type="personal",
    )
    test_identity_session.add(user)
    await test_identity_session.commit()

    notification = Notification(
        user_id=user.id,
        title="Election Live",
        message="Voting has started for Student Union 2026.",
        notification_type="election_status",
        action_url="/elections/test-id",
        is_read=False,
    )
    test_identity_session.add(notification)
    await test_identity_session.commit()
    await test_identity_session.refresh(notification)

    assert isinstance(notification.id, uuid.UUID)
    assert notification.user_id == user.id
    assert notification.title == "Election Live"
    assert notification.message == "Voting has started for Student Union 2026."
    assert notification.notification_type == "election_status"
    assert notification.action_url == "/elections/test-id"
    assert notification.is_read is False
    assert notification.read_at is None
    assert notification.created_at is not None

    # Schema serialization test
    read_schema = NotificationRead.model_validate(notification)
    assert read_schema.id == notification.id
    assert read_schema.title == "Election Live"
    assert read_schema.is_read is False

    list_response = NotificationListResponse(
        notifications=[read_schema],
        total_count=1,
        unread_count=1,
    )
    assert len(list_response.notifications) == 1
    assert list_response.unread_count == 1

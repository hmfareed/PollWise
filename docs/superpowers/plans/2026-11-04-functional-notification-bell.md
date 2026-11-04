# Functional Notification Bell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the static notification bell and hardcoded "3" badge in Pollwise's top navigation into a dynamic, functional notification center with real-time unread counts, filterable popover panel, quick actions, and backend persistence.

**Architecture:** 
1. Backend: Implement a `notifications` table in `identity_db` linked to `users.id`, create FastAPI endpoints (`GET /api/v1/notifications`, `PATCH /api/v1/notifications/{id}/read`, `POST /api/v1/notifications/mark-all-read`), and integrate notification generation hooks into election lifecycle events.
2. Frontend: Add notification methods to `apiClient`, build a responsive `NotificationBellDropdown` component using `@tanstack/react-query` with optimistic updates, filter tabs ("All" / "Unread"), action links, and click-outside dismissal.
3. AppShell: Replace the static bell in `AppShell.tsx` with the new interactive `NotificationBellDropdown` component.

**Tech Stack:** FastAPI, Python 3.14, SQLAlchemy 2 (async), React 19, TypeScript, TanStack Query, Tailwind CSS, Lucide icons, Vitest, Pytest.

**Spec:** [docs/superpowers/specs/2026-11-04-functional-notification-bell-design.md](file:///c:/Projects/PollWise/docs/superpowers/specs/2026-11-04-functional-notification-bell-design.md)

## Global Constraints
- Target platform: Windows / cross-platform compatible paths and async handlers.
- Database: `notifications` table belongs strictly to `identity_db` via `IdentityBase` (foreign key to `users.id` with `ondelete="CASCADE"`).
- Security & Privacy: Never disclose secret ballot choices in notification text; voter notifications only confirm receipt code and timestamps.
- Zero Hardcoded Mocks: The bell badge reflects real unread counts and is hidden when `unread_count === 0`.
- Accessibility: Notification popover supports keyboard `Escape` to close, screen-reader-friendly labels, and click-outside listeners.

## Review Focus
1. Unread count reaches 0: Badge must disappear completely (not display "0").
2. User isolation: User A must never see or be able to mark User B's notifications as read (HTTP 404/403).
3. Optimistic update during mark-as-read: Badge counter and card unread dot update immediately without waiting for network round-trip.
4. "Mark all as read" button: Instantly transitions all visible cards to read and clears the bell badge.
5. Action link click: Clicking an item with an `action_url` (e.g. `/elections/{id}`) marks the item read, closes the dropdown, and routes the user correctly.

---

### Task 1: Backend Notification Data Model & Schemas

**Files:**
- Modify: `backend/app/models/identity.py`
- Create: `backend/app/schemas/notification.py`
- Test: `backend/tests/test_notification_models.py`

**Interfaces:**
- Consumes: `IdentityBase`, `TimestampMixin`, `GUID` from `app.db.base` and `app.models.identity`
- Produces: `Notification` model class, `NotificationRead`, `NotificationListResponse`, `MarkAllReadResponse`

- [x] **Step 1: Write failing model tests in `backend/tests/test_notification_models.py`**
```python
import uuid
import pytest
from app.models.identity import Notification, User
from app.schemas.notification import NotificationRead, NotificationListResponse

@pytest.mark.asyncio
async def test_notification_model_and_schema(test_identity_session):
    user = User(
        email_normalized="notify@example.com",
        password_hash="fakehash",
        display_name="Notify User",
        account_type="personal",
    )
    test_identity_session.add(user)
    await test_identity_session.commit()

    notification = Notification(
        user_id=user.id,
        title="Election Live",
        message="Voting has started.",
        notification_type="election_status",
        action_url="/elections/123",
        is_read=False,
    )
    test_identity_session.add(notification)
    await test_identity_session.commit()

    assert notification.id is not None
    assert notification.is_read is False

    schema = NotificationRead.model_validate(notification)
    assert schema.title == "Election Live"
    assert schema.notification_type == "election_status"
```

- [x] **Step 2: Run pytest to confirm test failure**
Run: `pytest backend/tests/test_notification_models.py -v`
Expected: FAIL with "ImportError: cannot import name 'Notification'"

- [x] **Step 3: Implement `Notification` model and schemas**
Add `Notification` to `backend/app/models/identity.py`:
```python
class Notification(IdentityBase, TimestampMixin):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(String(50), default="system", nullable=False)
    action_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    meta_data: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="notifications")
```
Add relationship `notifications` on `User` in `backend/app/models/identity.py`.
Create `backend/app/schemas/notification.py` with `NotificationRead`, `NotificationListResponse`, `MarkAllReadResponse`.

- [x] **Step 4: Run pytest to verify model tests pass**
Run: `pytest backend/tests/test_notification_models.py -v`
Expected: PASS

- [x] **Step 5: Commit changes**
```bash
git add backend/app/models/identity.py backend/app/schemas/notification.py backend/tests/test_notification_models.py
git commit -m "feat(notifications): add Notification model and Pydantic schemas"
```

---

### Task 2: Backend Notification Service & REST API Endpoints

**Files:**
- Create: `backend/app/services/notification_service.py`
- Create: `backend/app/api/v1/notifications.py`
- Modify: `backend/app/api/v1/router.py`
- Test: `backend/tests/test_notifications_api.py`

**Interfaces:**
- Consumes: `Notification` model, `get_identity_session`, `get_current_user`
- Produces: `NotificationService`, `api_v1_router.include_router(notifications_router)`

- [x] **Step 1: Write failing API tests in `backend/tests/test_notifications_api.py`**
Test:
1. `GET /api/v1/notifications` returns 401 for unauthenticated request.
2. Authenticated user receives their notifications, `total_count`, and `unread_count`.
3. `unread_only=true` filter returns only unread items.
4. `PATCH /api/v1/notifications/{id}/read` marks item read and populates `read_at`.
5. `POST /api/v1/notifications/mark-all-read` marks all unread items read for current user.
6. Cross-user access check: User A cannot read or mark User B's notification.

- [x] **Step 2: Run pytest to verify test failure**
Run: `pytest backend/tests/test_notifications_api.py -v`
Expected: FAIL with 404 Not Found (route not registered).

- [x] **Step 3: Implement `NotificationService` and FastAPI router**
In `backend/app/services/notification_service.py`:
- `list_notifications(session, user_id, unread_only, limit, offset)`
- `mark_as_read(session, user_id, notification_id)`
- `mark_all_as_read(session, user_id)`
- `create_notification(session, user_id, title, message, notification_type, action_url, meta_data)`

In `backend/app/api/v1/notifications.py`:
- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/{notification_id}/read`
- `POST /api/v1/notifications/mark-all-read`
- Include router in `backend/app/api/v1/router.py`.

- [x] **Step 4: Run pytest to verify API tests pass**
Run: `pytest backend/tests/test_notifications_api.py -v`
Expected: PASS

- [x] **Step 5: Commit changes**
```bash
git add backend/app/services/notification_service.py backend/app/api/v1/notifications.py backend/app/api/v1/router.py backend/tests/test_notifications_api.py
git commit -m "feat(notifications): add notification service and REST endpoints"
```

---

### Task 3: Backend Lifecycle Event Triggers & Welcome Seed

**Files:**
- Modify: `backend/app/services/personal_onboarding_service.py`
- Modify: `backend/app/services/report_service.py`
- Test: `backend/tests/test_notification_lifecycle.py`

**Interfaces:**
- Consumes: `create_notification` from `notification_service`
- Produces: Automatic notifications emitted during user onboarding and certified report creation

- [x] **Step 1: Write failing lifecycle tests in `backend/tests/test_notification_lifecycle.py`**
Test:
1. Completing personal onboarding generates a welcome notification in the user's notification list.
2. Generating a certified report creates an administrative notification for the user.

- [x] **Step 2: Run pytest to verify test failure**
Run: `pytest backend/tests/test_notification_lifecycle.py -v`
Expected: FAIL (no notifications created on these events).

- [x] **Step 3: Connect notification creation in services**
- In `personal_onboarding_service.py`: after onboarding completion, call `NotificationService.create_notification(session, user_id=user.id, title="Welcome to PollWise!", message="Your personal voter portal is configured and ready.", notification_type="system", action_url="/dashboard")`.
- In `report_service.py`: after generating certified report, call `NotificationService.create_notification(session, user_id=user.id, title="Official Report Certified", message=f"Certified report generated for election {election.title}.", notification_type="report_certified", action_url=f"/elections/{election.id}")`.

- [x] **Step 4: Run pytest to verify lifecycle tests pass**
Run: `pytest backend/tests/test_notification_lifecycle.py -v`
Expected: PASS

- [x] **Step 5: Commit changes**
```bash
git add backend/app/services/personal_onboarding_service.py backend/app/services/report_service.py backend/tests/test_notification_lifecycle.py
git commit -m "feat(notifications): emit notifications on onboarding and report certification"
```

---

### Task 4: Frontend API Client & Types

**Files:**
- Create: `frontend/src/types/notification.ts`
- Modify: `frontend/src/lib/api-client.ts`
- Test: `frontend/src/test/api-client-notifications.test.ts`

**Interfaces:**
- Consumes: `apiClient` fetch wrapper
- Produces: `apiClient.fetchNotifications`, `apiClient.markNotificationRead`, `apiClient.markAllNotificationsRead`

- [x] **Step 1: Write failing tests in `frontend/src/test/api-client-notifications.test.ts`**
Test:
1. `apiClient.fetchNotifications()` calls `/api/v1/notifications` with default headers and query params.
2. `apiClient.markNotificationRead("notif-123")` makes a `PATCH` request to `/api/v1/notifications/notif-123/read`.
3. `apiClient.markAllNotificationsRead()` makes a `POST` request to `/api/v1/notifications/mark-all-read`.

- [x] **Step 2: Run vitest to verify test failure**
Run: `npx --prefix frontend vitest run src/test/api-client-notifications.test.ts`
Expected: FAIL with "Property 'fetchNotifications' does not exist on type 'ApiClient'".

- [x] **Step 3: Define types and implement client methods**
In `frontend/src/types/notification.ts`:
```typescript
export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: "election_status" | "voting" | "report_certified" | "eligibility" | "system";
  action_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  total_count: number;
  unread_count: number;
}

export interface MarkAllReadResponse {
  success: boolean;
  marked_count: number;
}
```
In `frontend/src/lib/api-client.ts`:
Implement `fetchNotifications(params?)`, `markNotificationRead(notificationId)`, and `markAllNotificationsRead()`.

- [x] **Step 4: Run vitest to verify client tests pass**
Run: `npx --prefix frontend vitest run src/test/api-client-notifications.test.ts`
Expected: PASS

- [x] **Step 5: Commit changes**
```bash
git add frontend/src/types/notification.ts frontend/src/lib/api-client.ts frontend/src/test/api-client-notifications.test.ts
git commit -m "feat(notifications): add notification types and apiClient methods"
```

---

### Task 5: Frontend NotificationBellDropdown Component & AppShell Integration

**Files:**
- Create: `frontend/src/components/notifications/NotificationBellDropdown.tsx`
- Modify: `frontend/src/layouts/AppShell.tsx`
- Test: `frontend/src/test/NotificationBellDropdown.test.tsx`
- Test: `frontend/src/test/AppShell.test.tsx`

**Interfaces:**
- Consumes: `apiClient`, `useAuth`, `lucide-react` icons
- Produces: `<NotificationBellDropdown />` in `AppShell.tsx` header

- [x] **Step 1: Write failing component tests in `frontend/src/test/NotificationBellDropdown.test.tsx`**
Test:
1. Renders Bell button; displays badge with count when `unread_count > 0`, hides badge when `unread_count === 0`.
2. Clicking Bell opens the popover displaying notification list.
3. Tab switching toggles between "All" and "Unread" filters.
4. Clicking "Mark all as read" triggers mutation and updates count.
5. Clicking individual notification item action navigates and marks read.
6. Pressing `Escape` or clicking outside closes the popover.

- [x] **Step 2: Run vitest to confirm failure**
Run: `npx --prefix frontend vitest run src/test/NotificationBellDropdown.test.tsx`
Expected: FAIL (module not found).

- [x] **Step 3: Implement `NotificationBellDropdown` component and update `AppShell.tsx`**
Build `NotificationBellDropdown` with:
- React Query hook `useQuery({ queryKey: ["notifications"], queryFn: ... })` with `refetchInterval: 30000`.
- Optimistic updates on `useMutation` for `markNotificationRead` and `markAllNotificationsRead`.
- Relative time formatting ("just now", "Xm ago", "Xh ago").
- Clean type-specific icons and colors.
- Replace lines 561-567 in `frontend/src/layouts/AppShell.tsx` with `<NotificationBellDropdown />`.

- [x] **Step 4: Run vitest to verify component tests and AppShell tests pass**
Run: `npx --prefix frontend vitest run src/test/NotificationBellDropdown.test.tsx src/test/AppShell.test.tsx`
Expected: PASS

- [x] **Step 5: Commit changes**
```bash
git add frontend/src/components/notifications/NotificationBellDropdown.tsx frontend/src/layouts/AppShell.tsx frontend/src/test/NotificationBellDropdown.test.tsx frontend/src/test/AppShell.test.tsx
git commit -m "feat(notifications): integrate functional NotificationBellDropdown in AppShell"
```

---

### Task 6: Comprehensive Verification & Regression Suite

**Files:**
- Test: `backend/tests`
- Test: `frontend/src/test`

- [x] **Step 1: Run full backend test suite**
Run: `pytest backend/tests`
Expected: ALL PASS with 0 errors.

- [x] **Step 2: Run full frontend test suite**
Run: `npm --prefix frontend test`
Expected: ALL PASS with 0 failures.

- [x] **Step 3: Final branch verification and review**
Check git status, commit history, and verify all tasks in the plan are marked complete.

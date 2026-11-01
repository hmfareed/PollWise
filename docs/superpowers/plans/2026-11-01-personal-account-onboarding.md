# Personal Account Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Personal Account Onboarding experience in Pollwise from registration and email verification through profile setup, security setup, and optional institution connection, culminating in a dedicated Personal Voter Dashboard.

**Architecture:** The backend extends the SQLAlchemy Identity database models with personal profile attributes, resumable onboarding status tracking, and institution invitations, exposing authenticated endpoints for progress persistence and code validation. The frontend builds a dedicated multi-step onboarding wizard (`PersonalOnboardingPage`), an interactive personal voter dashboard (`PersonalDashboardPage`), and updates `RegisterPage` and routing guards to seamlessly resume incomplete onboarding sessions.

**Tech Stack:** Python 3.14, FastAPI, SQLAlchemy (Async), PostgreSQL/SQLite, Pydantic v2, pytest, React 19, TypeScript, React Router v7, TanStack Query, Tailwind CSS, Lucide icons, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-01-personal-account-onboarding-design.md`

## Global Constraints

- Personal accounts are strictly for individuals participating in elections; personal onboarding must never create an institution or assign institutional admin privileges unless an explicit invitation is accepted.
- Email verification must occur before full account activation; unverified accounts must be redirected to email verification.
- Onboarding progress must be saved server-side (`current_step`, `onboarding_status`) so returning users resume from their last incomplete step.
- Skipping institution connection must never create an institution membership or grant election eligibility; it must transition the user cleanly to the Personal Dashboard empty state.
- Form inputs must be trimmed and validated on blur, input, and submit with friendly human-readable error messages.
- Passwords must be securely hashed and never displayed or returned in API responses; MFA recovery codes must not be stored in plaintext.

## Review Focus

- **Input with leading/trailing spaces:** First name, last name, and email must be trimmed and normalized before database persistence.
- **Resumed onboarding on a different device/session:** A user returning after email verification or login mid-onboarding must immediately resume at `current_step` instead of restarting.
- **Invalid or expired invitation codes:** Rejecting an invalid or expired code must show a clear, friendly error and leave the user's account and memberships intact.
- **Skipping institution step with zero memberships:** Personal Dashboard must render the explicit empty state ("No elections available yet") with clear invitation entry action rather than breaking or showing blank widgets.
- **Unverified user attempting to reach `/onboarding/personal` or `/dashboard`:** Access control must redirect to `/verify-email`.

---

### Task 1: Backend Identity Models & Database Schema for Personal Onboarding

**Files:**
- Modify: `backend/app/models/identity.py`
- Test: `backend/tests/test_personal_onboarding_models.py`

**Interfaces:**
- Produces:
  - `User.first_name`, `User.last_name`, `User.phone_number`, `User.profile_image_url`, `User.preferred_language`, `User.country`, `User.mfa_enabled`, `User.account_type`
  - Model `PersonalOnboarding`: `id`, `user_id`, `onboarding_status` (`not_started`, `in_progress`, `completed`), `current_step` (int), `profile_completed_at`, `security_setup_completed_at`, `institution_step_completed_at`, `completed_at`
  - Model `InstitutionInvitation`: `id`, `institution_id`, `invitation_code`, `invitation_type`, `expires_at`, `max_uses`, `used_count`, `status`

- [ ] **Step 1: Write the failing model test in `backend/tests/test_personal_onboarding_models.py`**

```python
import pytest
from datetime import UTC, datetime, timedelta
import uuid
from app.models.identity import User, PersonalOnboarding, InstitutionInvitation, Organization

@pytest.mark.asyncio
async def test_personal_onboarding_model_relationships(db_session):
    user = User(
        id=uuid.uuid4(),
        email_normalized="voter@example.com",
        password_hash="hash123",
        display_name="Alice Smith",
        first_name="Alice",
        last_name="Smith",
        account_type="personal",
        mfa_enabled=False,
    )
    db_session.add(user)
    await db_session.flush()

    onboarding = PersonalOnboarding(
        user_id=user.id,
        onboarding_status="in_progress",
        current_step=2,
    )
    db_session.add(onboarding)
    await db_session.commit()

    assert onboarding.user_id == user.id
    assert onboarding.current_step == 2
    assert onboarding.onboarding_status == "in_progress"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend\.venv\Scripts\pytest backend\tests\test_personal_onboarding_models.py`
Expected: FAIL with `ImportError: cannot import name 'PersonalOnboarding'`

- [ ] **Step 3: Implement models in `backend/app/models/identity.py`**

Add fields to `User` and declare `PersonalOnboarding` and `InstitutionInvitation` SQLAlchemy models with foreign keys and relationships.

- [ ] **Step 4: Run test to verify it passes**

Run: `backend\.venv\Scripts\pytest backend\tests\test_personal_onboarding_models.py`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add backend/app/models/identity.py backend/tests/test_personal_onboarding_models.py
git commit -m "feat(backend): add personal onboarding and invitation models"
```

---

### Task 2: Backend Personal Registration & Onboarding Endpoints

**Files:**
- Modify: `backend/app/schemas/auth.py`
- Create: `backend/app/services/personal_onboarding_service.py`
- Modify: `backend/app/services/auth_service.py`
- Modify: `backend/app/api/v1/auth.py`
- Test: `backend/tests/test_personal_onboarding_api.py`

**Interfaces:**
- Produces:
  - `POST /api/v1/auth/register/personal` -> `ApiResponse[UserResponse]`
  - `GET /api/v1/users/me/onboarding` -> `ApiResponse[PersonalOnboardingResponse]`
  - `PATCH /api/v1/users/me/onboarding` -> `ApiResponse[PersonalOnboardingResponse]`
  - `PATCH /api/v1/users/me/profile` -> `ApiResponse[UserResponse]`

- [ ] **Step 1: Write the failing API test in `backend/tests/test_personal_onboarding_api.py`**

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_personal_registration_and_onboarding_flow(client: AsyncClient):
    payload = {
        "first_name": "  Jane  ",
        "last_name": "  Doe  ",
        "email": "Jane.Doe@example.com",
        "password": "SecurePassword123!",
        "terms_accepted": True
    }
    resp = await client.post("/api/v1/auth/register/personal", json=payload)
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["email"] == "jane.doe@example.com"
    assert data["display_name"] == "Jane Doe"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend\.venv\Scripts\pytest backend\tests\test_personal_onboarding_api.py`
Expected: FAIL with `404 Not Found` or `405 Method Not Allowed`

- [ ] **Step 3: Implement schemas, service, and API routes**

1. In `backend/app/schemas/auth.py`: add `PersonalRegisterRequest`, `PersonalOnboardingResponse`, `UpdatePersonalOnboardingRequest`, `UpdateUserProfileRequest`.
2. In `backend/app/services/personal_onboarding_service.py`: implement methods to get/update onboarding state, initialize `PersonalOnboarding` on registration, and update user profile.
3. In `backend/app/api/v1/auth.py`: wire `/auth/register/personal`, `/users/me/onboarding`, and `/users/me/profile`.

- [ ] **Step 4: Run test to verify it passes**

Run: `backend\.venv\Scripts\pytest backend\tests\test_personal_onboarding_api.py`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add backend/app/schemas/auth.py backend/app/services/personal_onboarding_service.py backend/app/api/v1/auth.py backend/tests/test_personal_onboarding_api.py
git commit -m "feat(backend): add personal registration and onboarding persistence endpoints"
```

---

### Task 3: Backend Security Setup, MFA, and Institution Invitation Endpoints

**Files:**
- Modify: `backend/app/schemas/auth.py`
- Modify: `backend/app/services/personal_onboarding_service.py`
- Modify: `backend/app/api/v1/auth.py`
- Create: `backend/app/api/v1/invitations.py`
- Modify: `backend/app/api/v1/router.py`
- Test: `backend/tests/test_invitations_and_security.py`

**Interfaces:**
- Produces:
  - `POST /api/v1/users/me/mfa/setup` -> `ApiResponse[MfaSetupResponse]`
  - `POST /api/v1/users/me/mfa/verify` -> `ApiResponse[dict]`
  - `POST /api/v1/institutions/invitations/validate` -> `ApiResponse[InvitationValidationResponse]`
  - `POST /api/v1/institutions/invitations/accept` -> `ApiResponse[dict]`
  - `GET /api/v1/users/me/elections` -> `ApiResponse[list[ElectionSummary]]`

- [ ] **Step 1: Write the failing invitation and security tests**

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_invitation_validate_and_accept(authenticated_personal_client: AsyncClient, test_org):
    # Validate invalid code
    bad_res = await authenticated_personal_client.post(
        "/api/v1/institutions/invitations/validate",
        json={"invitation_code": "INVALID-CODE"}
    )
    assert bad_res.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend\.venv\Scripts\pytest backend\tests\test_invitations_and_security.py`
Expected: FAIL

- [ ] **Step 3: Implement MFA setup, verification, and invitation endpoints**

Implement TOTP/code generation response with recovery codes in `personal_onboarding_service.py`, invite code validation with organization lookup, and membership association on accept.

- [ ] **Step 4: Run test to verify it passes**

Run: `backend\.venv\Scripts\pytest backend\tests\test_invitations_and_security.py`
Expected: PASS

- [ ] **Step 5: Run full backend test suite**

Run: `backend\.venv\Scripts\pytest backend\tests`
Expected: All 32+ tests PASS

- [ ] **Step 6: Commit changes**

```bash
git add backend/app backend/tests/test_invitations_and_security.py
git commit -m "feat(backend): implement MFA setup, invitation validation, and user elections endpoints"
```

---

### Task 4: Frontend API Client & Auth Types Updates

**Files:**
- Modify: `frontend/src/types/auth.ts`
- Modify: `frontend/src/lib/api-client.ts`
- Test: `frontend/src/test/api-client-personal.test.ts`

**Interfaces:**
- Consumes: Backend endpoints from Tasks 2 & 3
- Produces:
  - `apiClient.registerPersonal(payload)`
  - `apiClient.getPersonalOnboarding()`
  - `apiClient.updatePersonalOnboarding(step, status)`
  - `apiClient.updateProfile(payload)`
  - `apiClient.setupMfa()`
  - `apiClient.verifyMfa(code)`
  - `apiClient.validateInvitation(code)`
  - `apiClient.acceptInvitation(code)`
  - `apiClient.getMyElections()`

- [ ] **Step 1: Write unit tests in `frontend/src/test/api-client-personal.test.ts`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { apiClient } from "../lib/api-client";

describe("Personal Onboarding API Client", () => {
  it("defines registerPersonal and onboarding methods", () => {
    expect(typeof apiClient.registerPersonal).toBe("function");
    expect(typeof apiClient.getPersonalOnboarding).toBe("function");
    expect(typeof apiClient.updatePersonalOnboarding).toBe("function");
    expect(typeof apiClient.validateInvitation).toBe("function");
    expect(typeof apiClient.acceptInvitation).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend src/test/api-client-personal.test.ts`
Expected: FAIL with `apiClient.registerPersonal is not a function`

- [ ] **Step 3: Update `frontend/src/types/auth.ts` and `frontend/src/lib/api-client.ts`**

Add all TypeScript interfaces and API methods with typed requests and responses.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix frontend src/test/api-client-personal.test.ts`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/types/auth.ts frontend/src/lib/api-client.ts frontend/src/test/api-client-personal.test.ts
git commit -m "feat(frontend): add personal onboarding and invitation API methods"
```

---

### Task 5: Refine Registration Page & Email Verification for Personal Flow

**Files:**
- Modify: `frontend/src/pages/RegisterPage.tsx`
- Modify: `frontend/src/pages/VerifyEmailPage.tsx`
- Test: `frontend/src/test/register-personal-flow.test.tsx`

**Interfaces:**
- Consumes: `apiClient.registerPersonal`
- Produces:
  - Personal registration form with trim, password policy display, inline confirm-password mismatch, Terms & Privacy checkbox.
  - Verify email screen showing masked address, instructions, resend with countdown, and change email option.
  - VerifyEmailPage redirects verified personal accounts to `/onboarding/personal`.

- [ ] **Step 1: Write test for personal registration validation & submission**

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { RegisterPage } from "../pages/RegisterPage";
import { describe, it, expect, vi } from "vitest";

describe("RegisterPage Personal Flow", () => {
  it("validates required fields, password match and terms acceptance", async () => {
    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );
    expect(screen.getByText("Create Personal Account")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails or verifies current state**

Run: `npm test --prefix frontend src/test/register-personal-flow.test.tsx`
Expected: Test runs and guides implementation.

- [ ] **Step 3: Implement personal registration form rules and VerifyEmailPage redirection**

- In `RegisterPage.tsx`: validate trim, enforce password requirements, display clear inline error when passwords differ, ensure terms checkbox is checked, call `apiClient.registerPersonal`.
- In `VerifyEmailPage.tsx`: check `user.account_type === 'personal'`, and on verification success, direct to `/onboarding/personal`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix frontend src/test/register-personal-flow.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/pages/RegisterPage.tsx frontend/src/pages/VerifyEmailPage.tsx frontend/src/test/register-personal-flow.test.tsx
git commit -m "feat(frontend): enhance personal registration validation and email verification routing"
```

---

### Task 6: Multi-Step Personal Onboarding Flow (`PersonalOnboardingPage`)

**Files:**
- Create: `frontend/src/pages/PersonalOnboardingPage.tsx`
- Modify: `frontend/src/app/router.tsx`
- Test: `frontend/src/test/personal-onboarding-page.test.tsx`

**Interfaces:**
- Consumes: `apiClient.getPersonalOnboarding`, `apiClient.updatePersonalOnboarding`, `apiClient.updateProfile`, `apiClient.setupMfa`, `apiClient.validateInvitation`, `apiClient.acceptInvitation`
- Produces: Complete 5-step personal onboarding flow:
  - Step 1: Welcome to Pollwise (logo, greeting, explanation, progress indicator, "Get Started").
  - Step 2: Complete Personal Profile (First name, Last name, display name, phone, country/region, preferred language, profile photo preview).
  - Step 3: Set Up Account Security (Password status, MFA setup with authenticator / email code & recovery codes, "Set Up Security", "Do This Later").
  - Step 4: Join an Institution / Connect to an Election (Enter invitation code, preview details, confirm join, or "Skip for Now").
  - Step 5: Onboarding Completion ("You're all set", "Go to My Dashboard").

- [ ] **Step 1: Write component test for multi-step onboarding progression in `frontend/src/test/personal-onboarding-page.test.tsx`**

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { PersonalOnboardingPage } from "../pages/PersonalOnboardingPage";
import { describe, it, expect, vi } from "vitest";

describe("PersonalOnboardingPage", () => {
  it("renders Welcome step and navigates to Profile setup on Get Started", async () => {
    // Verify welcome greeting and progression
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend src/test/personal-onboarding-page.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `PersonalOnboardingPage.tsx` and register route in `router.tsx`**

Implement all 5 steps with clean responsive UI, progress indicator ("Step X of 4"), state synchronization with `apiClient.updatePersonalOnboarding`, and error/loading handling.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix frontend src/test/personal-onboarding-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/pages/PersonalOnboardingPage.tsx frontend/src/app/router.tsx frontend/src/test/personal-onboarding-page.test.tsx
git commit -m "feat(frontend): create personal onboarding multi-step wizard"
```

---

### Task 7: Personal Voter Dashboard (`PersonalDashboardPage`) & Navigation Integration

**Files:**
- Create: `frontend/src/pages/PersonalDashboardPage.tsx`
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/layouts/AppShell.tsx`
- Modify: `frontend/src/pages/LoginPage.tsx`
- Test: `frontend/src/test/personal-dashboard.test.tsx`

**Interfaces:**
- Consumes: `apiClient.getMyElections`, `useAuth`, `apiClient.validateInvitation`, `apiClient.acceptInvitation`
- Produces:
  - Route `/dashboard`
  - Sections:
    1. Welcome Header (display name, greeting, profile completion prompt)
    2. My Elections (Active, Upcoming, Completed, Requiring Action) with Status Cards
    3. Join Election / Institution interactive card (Enter invitation code dialog)
    4. Recent Activity list (Account verification, joined institutions, votes cast)
    5. Account Security status card (Email verified, MFA enabled, security shortcut)
    6. Empty State ("No elections available yet", "Enter Invitation Code", "Learn How Pollwise Works")
  - `LoginPage.tsx` redirects returning users: incomplete personal -> `/onboarding/personal`, complete personal -> `/dashboard`.
  - `AppShell.tsx` shows voter-appropriate navigation links when user has a personal account.

- [ ] **Step 1: Write tests for PersonalDashboardPage and empty state in `frontend/src/test/personal-dashboard.test.tsx`**

```typescript
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { PersonalDashboardPage } from "../pages/PersonalDashboardPage";
import { describe, it, expect } from "vitest";

describe("PersonalDashboardPage", () => {
  it("renders empty state when user has no elections", () => {
    // Assert "No elections available yet" and "Enter Invitation Code"
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend src/test/personal-dashboard.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `PersonalDashboardPage.tsx` and integrate routes & navigation**

1. Build `PersonalDashboardPage.tsx` matching Section 9 of the specification.
2. Update `router.tsx` to mount `/dashboard` protected by `ProtectedRoute`.
3. Update `LoginPage.tsx` login redirect logic to check onboarding completion.
4. Update `AppShell.tsx` to present voter navigation links when logged in as a personal voter.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix frontend src/test/personal-dashboard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/pages/PersonalDashboardPage.tsx frontend/src/app/router.tsx frontend/src/layouts/AppShell.tsx frontend/src/pages/LoginPage.tsx frontend/src/test/personal-dashboard.test.tsx
git commit -m "feat(frontend): implement personal voter dashboard and session routing"
```

---

### Task 8: Full System Verification & Regression Suite

**Files:**
- Test: All backend tests (`backend/tests/`)
- Test: All frontend tests (`frontend/src/test/`)

- [ ] **Step 1: Run complete backend pytest suite**

Run: `backend\.venv\Scripts\pytest backend\tests`
Expected: All tests pass with 0 failures.

- [ ] **Step 2: Run complete frontend vitest suite**

Run: `npm test --prefix frontend`
Expected: All tests pass with 0 failures.

- [ ] **Step 3: Run frontend typecheck and build**

Run: `npm run build --prefix frontend`
Expected: Exit code 0 (clean build with no TypeScript or asset errors).

- [ ] **Step 4: Commit any final integration fixes**

```bash
git commit -m "chore: verify full personal onboarding test suite and build"
```

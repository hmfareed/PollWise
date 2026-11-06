# Recount and Dispute Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement formal recount and dispute handling in Pollwise, enabling authorized election authorities to request a recount with documented justification, re-running deterministic tallies against immutable ballots in `ballot_db`, recording incremented tally versions (`result_version = 2, 3...`), creating `RecountRequest` audit records, and displaying recount history in the UI.

**Architecture:** 
- **Database & Model:** Introduce the `RecountRequest` model in `election_db` linking contested elections, requesting actors, formal reasons, and resulting result versions. Ensure `ElectionResult` supports incrementing versions (`UNIQUE(election_id, result_version)`).
- **Service Layer:** Enhance `TallyService` with `recount_election` and `list_recounts`, reading preserved immutable ballots from `ballot_db` without modifying voter records or original tallies, generating new result versions in `pending` approval status, and writing `election.recount` audit events.
- **REST Endpoints:** Expose `POST /api/v1/elections/{id}/recount` and `GET /api/v1/elections/{id}/recounts` guarded by RBAC (`organization_admin`, `election_manager`, `auditor`).
- **Frontend & UI:** Integrate `RecountRequestModal` styled consistently with Pollwise modal primitives (`CertifiedCertificateModal`), add recount action triggers and tally version badges (`v1`, `v2 (Recount)`) to `ElectionDetailPage` and `ElectionResultsPage`.

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy 2.0 (asyncio + asyncpg), Pydantic v2, React 19, TypeScript, Tailwind CSS, TanStack Query, Vitest, Pytest.

**Spec:** [`docs/superpowers/specs/2026-11-06-recount-and-dispute-handling-design.md`](file:///c:/Projects/PollWise/docs/superpowers/specs/2026-11-06-recount-and-dispute-handling-design.md) (referencing Doc 01 §12.4, Doc 02 §3.2, Doc 03 §8.5).

---

## Global Constraints

- **Ballot Secrecy & Immutability:** Ballots stored in `ballot_db` must never be modified, deleted, or associated with voter identity during or after a recount.
- **Tally Immutability:** Existing `ElectionResult` records must not be overwritten or updated in place during a recount; a new record with incremented `result_version` must be inserted.
- **State Machine Rules:** Recounts can only be requested for elections in `tallied` or `published` status. Requesting a recount transitions an election back to `tallied` awaiting managerial approval of the new tally version.
- **Design Language:** UI changes must strictly follow existing styling patterns (shadcn/ui Button, Card, Badge, Dialog modal overlay, Tailwind slate/zinc neutral tones).
- **Test Integrity:** All existing backend tests (94 tests) and frontend tests (139 tests) must continue to pass without regression.

---

## Review Focus

1. **Attempting a recount on draft or open election:** Request must be rejected with 409 `INVALID_STATE_TRANSITION`.
2. **Empty or whitespace-only recount reason:** Must be rejected by Pydantic validation with 422 Unprocessable Entity.
3. **Unauthorized voter attempting a recount:** Must be denied with 403 Forbidden.
4. **Consecutive recounts increment version properly:** Recounting twice produces `result_version = 2` then `result_version = 3` linked to distinct `RecountRequest` records.
5. **Approval reset:** A recount produces an `ElectionResult` with `approval_status = "pending"`, preventing immediate re-publication until approved.

---

### Task 1: RecountRequest Model & Schemas

**Files:**
- Modify: `backend/app/models/election.py`
- Modify: `backend/app/schemas/results.py`
- Create: `backend/tests/test_recount_models.py`

**Interfaces:**
- Consumes: `ElectionBase`, `GUID`, `ElectionResult`, `Election` in `backend/app/models/election.py`
- Produces: `RecountRequest`, `RecountStatus`, `RecountRequestCreate`, `RecountRequestResponse`

- [ ] **Step 1: Write failing model & schema tests in `backend/tests/test_recount_models.py`**
Test `RecountRequest` instantiation, relationship with `Election`, default status `"pending"`, and Pydantic validation of `RecountRequestCreate` (rejecting reasons < 5 characters and serializing `RecountRequestResponse`).

- [ ] **Step 2: Run pytest to verify tests fail**
Run: `backend\.venv\Scripts\pytest backend\tests\test_recount_models.py -v`
Expected: FAIL with `ImportError: cannot import name 'RecountRequest'`

- [ ] **Step 3: Implement `RecountRequest` and schemas**
In `backend/app/models/election.py`:
- Define `RecountStatus(str, enum.Enum)` with `PENDING = "pending"`, `COMPLETED = "completed"`, `REJECTED = "rejected"`.
- Define `class RecountRequest(ElectionBase)` with columns `id`, `election_id`, `requester_user_id`, `reason`, `status`, `resulting_result_id`, `created_at`, `resolved_at`.
- Add relationship on `Election`: `recount_requests: Mapped[list["RecountRequest"]] = relationship("RecountRequest", back_populates="election", cascade="all, delete-orphan")`.
In `backend/app/schemas/results.py`:
- Add `result_version: int = 1` and `tally_algorithm_version: str = "1.0"` to `ElectionResultResponse`.
- Add `RecountRequestCreate(BaseModel)` with `reason: str = Field(..., min_length=5, max_length=2000)`.
- Add `RecountRequestResponse(BaseModel)`.

- [ ] **Step 4: Run pytest to verify model tests pass**
Run: `backend\.venv\Scripts\pytest backend\tests\test_recount_models.py -v`
Expected: PASS

- [ ] **Step 5: Commit changes**
Run: `git add backend/app/models/election.py backend/app/schemas/results.py backend/tests/test_recount_models.py`
Run: `git commit -m "feat(recount): add RecountRequest model and Pydantic schemas"`

---

### Task 2: Service Layer Recount Implementation in `TallyService`

**Files:**
- Modify: `backend/app/services/tally_service.py`
- Create: `backend/tests/test_tally_recount_service.py`

**Interfaces:**
- Consumes: `RecountRequest`, `ElectionResult`, `Ballot`, `Election`, `AuditEvent`
- Produces: `TallyService.recount_election`, `TallyService.list_recounts`

- [ ] **Step 1: Write failing service tests in `backend/tests/test_tally_recount_service.py`**
Test that:
- Recount raises `AppException(INVALID_STATE_TRANSITION)` if election status is not `tallied` or `published`.
- Recount calculates tally deterministically from `ballot_session`.
- Recount creates a new `ElectionResult` with `result_version = 2` (incremented).
- Recount creates a `RecountRequest` record with `status = "completed"`.
- Recount commits `AuditEvent(event_type="election.recount")`.
- `list_recounts` returns all recount requests for the election ordered by `created_at` descending.

- [ ] **Step 2: Run pytest to verify service tests fail**
Run: `backend\.venv\Scripts\pytest backend\tests\test_tally_recount_service.py -v`
Expected: FAIL with `AttributeError: type object 'TallyService' has no attribute 'recount_election'`

- [ ] **Step 3: Implement `recount_election` and `list_recounts` in `TallyService`**
In `backend/app/services/tally_service.py`:
- Implement `recount_election(ballot_session, election_session, election_id, actor, reason: str)`:
  - Validate election status is `tallied` or `published`.
  - Fetch highest existing `result_version` from `ElectionResult` for this `election_id`.
  - Re-read all ballots for `election_id` from `ballot_session`.
  - Compute candidate counts, abstentions, and winners.
  - Insert new `ElectionResult` with `result_version = max_version + 1`, `approval_status = "pending"`.
  - Create and add `RecountRequest` record with `status = "completed"`, `resulting_result_id = new_result.id`, `resolved_at = datetime.now(UTC)`.
  - Reset election status to `ElectionStatus.TALLIED`.
  - Record audit event with `event_type = "election.recount"`.
  - Commit transaction and return `(new_result, recount_request)`.
- Implement `list_recounts(election_session, election_id)`:
  - Query `RecountRequest` where `election_id == election_id` order by `created_at` desc.
- Update `get_results(election_session, election_id, can_view_unapproved, version: int | None = None)` to fetch by version or default to the highest `result_version`.

- [ ] **Step 4: Run pytest to verify service tests pass**
Run: `backend\.venv\Scripts\pytest backend\tests\test_tally_recount_service.py -v`
Expected: PASS

- [ ] **Step 5: Commit changes**
Run: `git add backend/app/services/tally_service.py backend/tests/test_tally_recount_service.py`
Run: `git commit -m "feat(recount): implement recount_election and list_recounts in TallyService"`

---

### Task 3: Recount REST API Endpoints

**Files:**
- Modify: `backend/app/api/v1/results.py`
- Create: `backend/tests/test_recount_api.py`

**Interfaces:**
- Consumes: `TallyService.recount_election`, `TallyService.list_recounts`, `RecountRequestCreate`
- Produces: `POST /api/v1/elections/{id}/recount`, `GET /api/v1/elections/{id}/recounts`

- [ ] **Step 1: Write failing API tests in `backend/tests/test_recount_api.py`**
Test:
- `POST /api/v1/elections/{id}/recount` with empty body returns 422.
- `POST /api/v1/elections/{id}/recount` by unauthenticated or non-admin user returns 401/403.
- `POST /api/v1/elections/{id}/recount` by admin on tallied election returns 200 with new result version (v2) and recount details.
- `GET /api/v1/elections/{id}/recounts` returns array with the completed recount record.

- [ ] **Step 2: Run pytest to verify API tests fail**
Run: `backend\.venv\Scripts\pytest backend\tests\test_recount_api.py -v`
Expected: FAIL with 404/405 (endpoint not defined)

- [ ] **Step 3: Implement recount endpoints in `backend/app/api/v1/results.py`**
Add:
```python
@router.post(
    "/elections/{id}/recount",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def request_recount(
    id: uuid.UUID,
    payload: RecountRequestCreate,
    ballot_session: AsyncSession = Depends(get_ballot_session),
    election_session: AsyncSession = Depends(get_election_session),
    identity_session: AsyncSession = Depends(get_identity_session),
    current_user: User = Depends(get_current_user),
):
    ...
```
and
```python
@router.get(
    "/elections/{id}/recounts",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def get_election_recounts(
    id: uuid.UUID,
    election_session: AsyncSession = Depends(get_election_session),
    identity_session: AsyncSession = Depends(get_identity_session),
    current_user: User = Depends(get_current_user),
):
    ...
```

- [ ] **Step 4: Run pytest to verify API tests pass**
Run: `backend\.venv\Scripts\pytest backend\tests\test_recount_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit changes**
Run: `git add backend/app/api/v1/results.py backend/tests/test_recount_api.py`
Run: `git commit -m "feat(recount): add recount initiation and history REST endpoints"`

---

### Task 4: Frontend Types & API Client Integration

**Files:**
- Modify: `frontend/src/types/election.ts` (or `frontend/src/types/results.ts`)
- Modify: `frontend/src/lib/api-client.ts`
- Create: `frontend/src/test/api-client-recount.test.ts`

**Interfaces:**
- Consumes: REST endpoints `POST /elections/{id}/recount` and `GET /elections/{id}/recounts`
- Produces: `apiClient.requestRecount(electionId, reason)`, `apiClient.getRecounts(electionId)`

- [ ] **Step 1: Write failing API client tests in `frontend/src/test/api-client-recount.test.ts`**
Test:
- `apiClient.requestRecount(electionId, reason)` makes POST request to `/api/v1/elections/${electionId}/recount` with JSON payload `{ reason }`.
- `apiClient.getRecounts(electionId)` makes GET request to `/api/v1/elections/${electionId}/recounts`.

- [ ] **Step 2: Run vitest to verify tests fail**
Run: `npm --prefix frontend test -- --run src/test/api-client-recount.test.ts`
Expected: FAIL with `apiClient.requestRecount is not a function`

- [ ] **Step 3: Define TypeScript interfaces and add apiClient methods**
In `frontend/src/types/`:
- Define `RecountRequest`: `{ id: string; election_id: string; requester_user_id: string; reason: string; status: string; resulting_result_id?: string; created_at: string; resolved_at?: string; }`.
- Update `ElectionResult` to include `result_version?: number; tally_algorithm_version?: string;`.
In `frontend/src/lib/api-client.ts`:
- Add `requestRecount(electionId: string, reason: string): Promise<{ result: ElectionResult; recount: RecountRequest }>`
- Add `getRecounts(electionId: string): Promise<RecountRequest[]>`

- [ ] **Step 4: Run vitest to verify tests pass**
Run: `npm --prefix frontend test -- --run src/test/api-client-recount.test.ts`
Expected: PASS

- [ ] **Step 5: Commit changes**
Run: `git add frontend/src/types/ frontend/src/lib/api-client.ts frontend/src/test/api-client-recount.test.ts`
Run: `git commit -m "feat(recount): add recount frontend types and apiClient methods"`

---

### Task 5: Recount UI Components & Page Integration

**Files:**
- Create: `frontend/src/components/reports/RecountRequestModal.tsx`
- Modify: `frontend/src/pages/ElectionDetailPage.tsx`
- Modify: `frontend/src/pages/ElectionResultsPage.tsx`
- Create: `frontend/src/test/recount-flow.test.tsx`

**Interfaces:**
- Consumes: `apiClient.requestRecount`, `apiClient.getRecounts`, `RecountRequestModal`
- Produces: Recount request modal, version badges, recount action button in `ElectionDetailPage` & `ElectionResultsPage`

- [ ] **Step 1: Write failing UI flow tests in `frontend/src/test/recount-flow.test.tsx`**
Test that:
- `RecountRequestModal` renders warning note, reason input, submit button, and disables submission when reason < 5 chars.
- Submitting the form calls `apiClient.requestRecount(electionId, reason)` and closes modal.
- `ElectionDetailPage` renders "Request Recount" button when election is in `tallied` or `published` status.
- Displays version indicator (e.g. `Version 2`) and shows recount request history when recounts exist.

- [ ] **Step 2: Run vitest to verify UI tests fail**
Run: `npm --prefix frontend test -- --run src/test/recount-flow.test.tsx`
Expected: FAIL with missing component or button

- [ ] **Step 3: Implement `RecountRequestModal.tsx`**
Create `frontend/src/components/reports/RecountRequestModal.tsx` following Pollwise modal styling:
- Dark mode responsive overlay, Card container with `RotateCcw` / `ShieldAlert` icon.
- Header: "Initiate Official Recount & Audit".
- Informational notice: "A recount deterministically recalculates candidate vote totals from the preserved, immutable ballots in `ballot_db`. It produces a new tally version and requires administrative re-approval before publication."
- Form field: Reason for recount (textarea with character counter, required, min 5 chars).
- Buttons: "Cancel" (ghost/outline), "Initiate Recount" (destructive or primary warning with spinner).

- [ ] **Step 4: Integrate into `ElectionDetailPage.tsx` and `ElectionResultsPage.tsx`**
In `ElectionDetailPage.tsx`:
- Add query for `getRecounts(id)`.
- In Lifecycle Actions card: Add "Request Recount" button (variant="outline", icon `<RotateCcw className="h-4 w-4" />`) next to Approve/Publish buttons when `election.status in ["tallied", "published"]`.
- In Results tab / Certification section: Render version badge (`Version {results.result_version}`) and render a collapsible or clean table of Recount History (Date, Requester ID / Authority, Reason, Status).
In `ElectionResultsPage.tsx`:
- Render version badge in header (`Version {results.result_version || 1}`).
- If `results.result_version > 1`, show a subtle notice banner: "Official Recounted Tally (Version {results.result_version}). Audited and certified from preserved ballots."

- [ ] **Step 5: Run vitest to verify UI tests pass**
Run: `npm --prefix frontend test -- --run src/test/recount-flow.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit changes**
Run: `git add frontend/src/components/reports/RecountRequestModal.tsx frontend/src/pages/ElectionDetailPage.tsx frontend/src/pages/ElectionResultsPage.tsx frontend/src/test/recount-flow.test.tsx`
Run: `git commit -m "feat(recount): add RecountRequestModal and integrate recount workflow into election pages"`

---

### Task 6: Full Regression Verification

**Files:**
- Verify all modified and unmodified test suites across backend and frontend.

- [ ] **Step 1: Run full backend test suite**
Run: `backend\.venv\Scripts\pytest backend\tests`
Verify: All 97+ tests pass.

- [ ] **Step 2: Run full frontend test suite**
Run: `npm --prefix frontend test -- --run`
Verify: All 26+ test files and 145+ tests pass.

- [ ] **Step 3: Verify clean frontend production build**
Run: `npm --prefix frontend run build`
Verify: Vite builds cleanly with 0 TypeScript or bundling errors.

- [ ] **Step 4: Final commit and summary**
Run: `git status`
Run: `git commit -m "chore(recount): complete recount and dispute handling test verification and build check"`

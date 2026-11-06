# Emergency Controls & Live Election Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement formal emergency operational controls (Pause, Resume, Emergency Close, Cancel) with audited justification and build the Live Election Monitoring Dashboard providing real-time turnout velocity, infrastructure health, and privacy-thresholded departmental participation metrics.

**Architecture:**
- **Database & State Machine:** Introduce `ElectionStatus.PAUSED`, add `paused_at` and `pause_reason` to `Election` in `election_db`, and update state transition functions in `ElectionService` to support pause/resume/emergency close with audit event logging.
- **Voter Gate Enforcement:** Halt voter authentication, credential issuance, and ballot box submissions with explicit `409` notifications whenever an election is in `paused` state.
- **Monitoring Service & Privacy Layer:** Implement `ElectionMonitoringService` generating real-time turnout summaries, time-bucketed participation velocity, and departmental turnout enforcing the Doc 01 §11.2 Privacy Threshold (suppressing groups < 10 voters to prevent individual voter deduction), while strictly maintaining the Zero Interim Counts invariant.
- **REST Endpoints:** Expose `POST /api/v1/elections/{id}/pause`, `POST /api/v1/elections/{id}/resume`, and `GET /api/v1/elections/{id}/monitoring` guarded by RBAC (`organization_admin`, `election_manager`, `auditor`).
- **Frontend & UI:** Integrate `EmergencyControlModal` and `EmergencyStatusBanner` into `ElectionDetailPage`, elevate the `participation` tab into the full Live Monitoring Dashboard with custom SVG velocity curves, and render a friendly paused screen in `VotingBoothPage`.

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy 2.0 (asyncio + asyncpg), Pydantic v2, React 19, TypeScript, Tailwind CSS, TanStack Query, Vitest, Pytest.

**Spec:** [`docs/superpowers/specs/2026-11-06-emergency-controls-and-live-monitoring-design.md`](file:///c:/Projects/PollWise/docs/superpowers/specs/2026-11-06-emergency-controls-and-live-monitoring-design.md) (referencing Doc 01 §11.1, §11.2, §11.3; Doc 15 Phase 5).

---

## Global Constraints

- **Zero Interim Counts Invariant:** Candidate vote totals and positions must NEVER be calculated, queried, or displayed while an election is open or paused.
- **Departmental Privacy Threshold:** Subgroups or departments with fewer than 10 eligible voters must be suppressed and aggregated under `"Other / Small Groups (< 10 voters)"` to prevent deduction of individual ballot choices.
- **State Machine Rules:** Only `open` elections can be paused; only `paused` elections can be resumed. A `paused` election may be directly closed or canceled under emergency governance protocol.
- **Audit Immutability:** All emergency operations must record an immutable audit event (`election.paused`, `election.resumed`, `election.closed`, `election.canceled`) with actor ID, timestamp, and mandatory justification.
- **Design Language:** UI changes must strictly adhere to existing Pollwise styling patterns (shadcn/ui Button, Card, Badge, Dialog modal overlay, Tailwind slate/zinc neutral tones, custom SVG charts without external library bloat).
- **Test Integrity:** All existing backend tests (105 tests) and frontend tests (144 tests) must continue to pass without regression.

---

## Review Focus

1. **Attempting pause on non-open election:** Request must be rejected with 409 `INVALID_STATE_TRANSITION`.
2. **Empty or whitespace-only pause reason:** Must be rejected by Pydantic validation with 422 Unprocessable Entity.
3. **Ballot submission during paused state:** Submitting a ballot or requesting voting credentials during `paused` state must be rejected with 409 `INVALID_STATE_TRANSITION` / `ELECTION_PAUSED`.
4. **Emergency close while paused:** A paused election can transition directly to `closed` without requiring resumption.
5. **Departmental privacy threshold enforcement:** When departmental turnout is generated, any department with `< 10` eligible voters is suppressed into an aggregate bucket to prevent voter deduction.

---

### Task 1: Election Model & State Machine (Pause/Resume/Close)

**Files:**
- Modify: `backend/app/models/election.py`
- Modify: `backend/app/schemas/elections.py`
- Modify: `backend/app/services/election_service.py`
- Create: `backend/tests/test_emergency_controls.py`

**Interfaces:**
- Consumes: `Election`, `ElectionStatus`, `AuditEvent` in `backend/app/models/election.py`
- Produces: `ElectionStatus.PAUSED`, `pause_election`, `resume_election`, `close_election` (updated for paused), `PauseElectionRequest`, `ResumeElectionRequest`

- [ ] **Step 1: Write failing tests in `backend/tests/test_emergency_controls.py`**

Test pause from open with reason, rejection of pause from draft/closed, whitespace reason rejection, resume from paused, emergency close from paused, and audit logging.

- [ ] **Step 2: Run test to verify it fails**

Run: `backend\.venv\Scripts\pytest backend\tests\test_emergency_controls.py -v`
Expected: FAIL (missing `PAUSED`, `pause_election`, `resume_election`)

- [ ] **Step 3: Update `backend/app/models/election.py`**

Add `PAUSED = "paused"` to `ElectionStatus` and include in `ALL_STATUSES`. Add `paused_at` and `pause_reason` mapped columns to `Election`.

- [ ] **Step 4: Update `backend/app/schemas/elections.py`**

Add `PauseElectionRequest` (with whitespace-stripped `reason: str = Field(..., min_length=5, max_length=2000)`), `ResumeElectionRequest`, and update `ElectionResponse` / `ElectionDetailResponse` with `paused_at: datetime | None = None` and `pause_reason: str | None = None`.

- [ ] **Step 5: Implement `pause_election` and `resume_election` in `backend/app/services/election_service.py`**

Enforce state checks, set timestamps/reasons, write audit events, and update `close_election` to accept both `OPEN` and `PAUSED`.

- [ ] **Step 6: Run test to verify it passes**

Run: `backend\.venv\Scripts\pytest backend\tests\test_emergency_controls.py -v`
Expected: PASS

- [ ] **Step 7: Commit Task 1**

```bash
git add backend/app/models/election.py backend/app/schemas/elections.py backend/app/services/election_service.py backend/tests/test_emergency_controls.py
git commit -m "feat(election): add paused status and emergency pause/resume/close service methods"
```

---

### Task 2: Voter Gate & Ballot Box Halting on Paused State

**Files:**
- Modify: `backend/app/services/voter_auth_service.py`
- Modify: `backend/app/services/ballot_participation_service.py`
- Modify: `backend/app/api/v1/voter_ballot.py`
- Modify: `backend/tests/test_emergency_controls.py`

**Interfaces:**
- Consumes: `ElectionStatus.PAUSED` from `backend/app/models/election.py`
- Produces: 409 rejection on credential requests and ballot submissions when paused

- [ ] **Step 1: Write failing tests in `backend/tests/test_emergency_controls.py`**

Verify that `voter_auth_service.authenticate_voter` and `ballot_participation_service.submit_ballot_participation` reject attempts when election status is `PAUSED` with 409 error message mentioning emergency pause.

- [ ] **Step 2: Run test to verify it fails**

Run: `backend\.venv\Scripts\pytest backend\tests\test_emergency_controls.py -k "gate" -v`
Expected: FAIL

- [ ] **Step 3: Update `voter_auth_service.py` and `ballot_participation_service.py`**

Check for `election.status == ElectionStatus.PAUSED` and return an explicit `AppException(ErrorCode.INVALID_STATE_TRANSITION, "Voting is temporarily paused under emergency control protocol. Ballot submissions are halted.", status_code=409)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `backend\.venv\Scripts\pytest backend\tests\test_emergency_controls.py -v`
Expected: PASS

- [ ] **Step 5: Commit Task 2**

```bash
git add backend/app/services/voter_auth_service.py backend/app/services/ballot_participation_service.py backend/app/api/v1/voter_ballot.py backend/tests/test_emergency_controls.py
git commit -m "feat(voter): halt credential issuance and ballot submissions when election is paused"
```

---

### Task 3: Emergency REST Endpoints & Live Monitoring Service

**Files:**
- Create: `backend/app/services/monitoring_service.py`
- Modify: `backend/app/api/v1/elections.py`
- Modify: `backend/app/schemas/elections.py`
- Create: `backend/tests/test_monitoring_service.py`

**Interfaces:**
- Consumes: `Ballot` in `ballot_db`, `ElectionVoterRecord` in `election_db`, `ElectionAccessCode`
- Produces: `POST /elections/{id}/pause`, `POST /elections/{id}/resume`, `GET /elections/{id}/monitoring`

- [ ] **Step 1: Write failing tests in `backend/tests/test_monitoring_service.py`**

Test `POST /pause` and `POST /resume` REST endpoints with RBAC checks. Test `GET /monitoring` returning turnout counts, hourly velocity buckets, health checks, and departmental privacy threshold (< 10 voters grouped into "Other / Suppressed").

- [ ] **Step 2: Run test to verify it fails**

Run: `backend\.venv\Scripts\pytest backend\tests\test_monitoring_service.py -v`
Expected: FAIL

- [ ] **Step 3: Implement `ElectionMonitoringService` in `backend/app/services/monitoring_service.py`**

Implement turnout aggregation, time-bucketed hourly velocity from ballot timestamps, departmental breakdown with threshold suppression (< 10 voters), and health telemetry.

- [ ] **Step 4: Expose endpoints in `backend/app/api/v1/elections.py`**

Add `POST /elections/{id}/pause`, `POST /elections/{id}/resume`, and `GET /elections/{id}/monitoring`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `backend\.venv\Scripts\pytest backend\tests\test_monitoring_service.py -v`
Expected: PASS

- [ ] **Step 6: Commit Task 3**

```bash
git add backend/app/services/monitoring_service.py backend/app/api/v1/elections.py backend/app/schemas/elections.py backend/tests/test_monitoring_service.py
git commit -m "feat(monitoring): add pause/resume endpoints and live monitoring service with privacy threshold"
```

---

### Task 4: Frontend Types & API Client Integration

**Files:**
- Modify: `frontend/src/types/election.ts`
- Modify: `frontend/src/lib/api-client.ts`
- Create: `frontend/src/test/api-client-monitoring.test.ts`

**Interfaces:**
- Consumes: Endpoints from Task 3
- Produces: `apiClient.pauseElection`, `apiClient.resumeElection`, `apiClient.getElectionMonitoring`

- [ ] **Step 1: Write failing test in `frontend/src/test/api-client-monitoring.test.ts`**

Test client calls for pause, resume, and get monitoring.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- src/test/api-client-monitoring.test.ts --run`
Expected: FAIL

- [ ] **Step 3: Update `frontend/src/types/election.ts` and `frontend/src/lib/api-client.ts`**

Add `LiveMonitoringData`, `TurnoutVelocityPoint`, `DepartmentTurnoutMetric`, `InfrastructureHealth`, and API methods `pauseElection`, `resumeElection`, and `getElectionMonitoring`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- src/test/api-client-monitoring.test.ts --run`
Expected: PASS

- [ ] **Step 5: Commit Task 4**

```bash
git add frontend/src/types/election.ts frontend/src/lib/api-client.ts frontend/src/test/api-client-monitoring.test.ts
git commit -m "feat(frontend): add monitoring and emergency control types and apiClient methods"
```

---

### Task 5: Emergency UI Components (Modal, Banner & Booth Notice)

**Files:**
- Create: `frontend/src/components/elections/EmergencyControlModal.tsx`
- Create: `frontend/src/components/elections/EmergencyStatusBanner.tsx`
- Modify: `frontend/src/pages/VotingBoothPage.tsx`
- Create: `frontend/src/test/emergency-controls-ui.test.tsx`

**Interfaces:**
- Consumes: `apiClient.pauseElection`, `apiClient.resumeElection`
- Produces: `EmergencyControlModal`, `EmergencyStatusBanner`, in-booth paused state

- [ ] **Step 1: Write failing tests in `frontend/src/test/emergency-controls-ui.test.tsx`**

Test modal rendering, reason requirement, submission, banner display with reason and resume action, and booth paused warning.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- src/test/emergency-controls-ui.test.tsx --run`
Expected: FAIL

- [ ] **Step 3: Create `EmergencyControlModal.tsx` and `EmergencyStatusBanner.tsx`**

Build accessible components adhering strictly to Pollwise styles (Tailwind, dark mode, dialog, validation).

- [ ] **Step 4: Update `VotingBoothPage.tsx` to handle paused election**

Render polite alert when election status is `paused`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm --prefix frontend test -- src/test/emergency-controls-ui.test.tsx --run`
Expected: PASS

- [ ] **Step 6: Commit Task 5**

```bash
git add frontend/src/components/elections/EmergencyControlModal.tsx frontend/src/components/elections/EmergencyStatusBanner.tsx frontend/src/pages/VotingBoothPage.tsx frontend/src/test/emergency-controls-ui.test.tsx
git commit -m "feat(ui): add emergency control modal, status banner, and booth paused screen"
```

---

### Task 6: Live Monitoring Dashboard Tab & Turnout Velocity Chart

**Files:**
- Create: `frontend/src/components/elections/TurnoutVelocityChart.tsx`
- Modify: `frontend/src/pages/ElectionDetailPage.tsx`
- Create: `frontend/src/test/live-monitoring-dashboard.test.tsx`

**Interfaces:**
- Consumes: `getElectionMonitoring`, `TurnoutVelocityPoint`, `DepartmentTurnoutMetric`
- Produces: Live Monitoring Dashboard tab in `ElectionDetailPage`

- [ ] **Step 1: Write failing tests in `frontend/src/test/live-monitoring-dashboard.test.tsx`**

Test live monitoring tab rendering velocity chart, health indicators, departmental table with privacy note, and emergency pause button triggering modal.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- src/test/live-monitoring-dashboard.test.tsx --run`
Expected: FAIL

- [ ] **Step 3: Implement `TurnoutVelocityChart.tsx`**

Create lightweight custom SVG smooth cubic bezier curve chart matching `ElectionOverviewChart`.

- [ ] **Step 4: Integrate into `frontend/src/pages/ElectionDetailPage.tsx`**

Enhance `participation` tab into full Live Monitoring Dashboard and add emergency action buttons and banner.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm --prefix frontend test -- src/test/live-monitoring-dashboard.test.tsx --run`
Expected: PASS

- [ ] **Step 6: Commit Task 6**

```bash
git add frontend/src/components/elections/TurnoutVelocityChart.tsx frontend/src/pages/ElectionDetailPage.tsx frontend/src/test/live-monitoring-dashboard.test.tsx
git commit -m "feat(dashboard): integrate live monitoring dashboard and velocity chart into election detail page"
```

---

### Task 7: Full Verification & Integration Suite

**Files:**
- Test all backend and frontend suites
- Run production build

- [ ] **Step 1: Run full backend pytest suite**

Run: `backend\.venv\Scripts\pytest backend\tests`
Expected: 100% pass (>= 110 tests)

- [ ] **Step 2: Run full frontend vitest suite**

Run: `npm --prefix frontend test -- --run`
Expected: 100% pass (28+ test files)

- [ ] **Step 3: Run production build**

Run: `Push-Location frontend; npx vite build; Pop-Location`
Expected: Clean build (`dist/` generated)

- [ ] **Step 4: Commit and finalize**

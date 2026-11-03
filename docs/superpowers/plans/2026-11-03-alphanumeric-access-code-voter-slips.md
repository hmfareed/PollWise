# Alphanumeric Physical Access Code & Student ID Voting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement physical alphanumeric voter access code generation, printable voter slips, and a secure voter booth flow where voters enter an access code followed by their Student ID, with both expiring permanently upon ballot submission.

**Architecture:** 
- Backend adds an `ElectionAccessCode` table in `election_db` with unique constraint per election, bulk generation endpoint, verification endpoint, and claiming endpoint.
- Ballot submission atomically marks the access code as used, records student ID participation in `election_db`, and casts the secret ballot in `ballot_db`.
- Frontend provides an `AccessCodeManager` component with generation controls, printable slip cards formatted for paper distribution, CSV export, and status tracking in the admin dashboard and election detail tabs.
- The voter voting booth (`/elections/:id/vote`) guides voters through entering their alphanumeric code, followed by their Student ID, ensuring duplicate student IDs are rejected.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (async), PostgreSQL, Pydantic v2, React 18, Vite, TanStack Query, TailwindCSS, Vitest, Pytest.

**Spec:** User prompt 9 & 10: Admin generates $N$ alphanumeric codes, prints them physically to hand to students; student opens link, enters code, if valid enters Student ID (only); student votes; both the access code and student ID expire and cannot vote again in that election.

## Global Constraints

- Access codes must be alphanumeric, uppercase, human-legible, formatted with prefix and grouping (e.g., `PW-XXXX-XXXX`), omitting visually ambiguous characters (`0`, `O`, `1`, `I`).
- Voters must only see the isolated voting booth (`/elections/:id/vote`) without any admin dashboard, navbar, or sidebar.
- Both the access code and the student ID must permanently expire upon ballot submission and be prohibited from subsequent votes in that election.
- Secret ballot integrity must be preserved: selections remain in `ballot_db` with zero correlation to student ID or access code.

## Review Focus

1. **Re-use of Access Code:** Attempting to claim an already-used access code returns an explicit error: `"This access code has already been used and is expired."`
2. **Duplicate Student ID:** Attempting to use a second access code with a Student ID that has already cast a ballot is rejected: `"This Student ID has already voted in this election."`
3. **Concurrent Claims / Race Conditions:** Multiple voters attempting to use the same code concurrently must be handled safely at the database constraint level.
4. **Printable Slips Layout:** The print view must render neatly on standard A4/Letter paper with cut lines, large high-contrast code font, and voting instructions.
5. **Pre-imported Whitelist Compatibility:** If an election administrator has pre-imported an approved student ID list, the entered Student ID is checked against that list; if no pre-imported list exists, any valid unique Student ID is accepted.

---

### Task 1: Database Model & Alembic/Engine Schema

**Files:**
- Modify: `backend/app/models/voter_auth.py:1-232`
- Test: `backend/tests/test_access_codes.py`

- [ ] **Step 1.1**: Define `ElectionAccessCode` model in `backend/app/models/voter_auth.py`.
  Add attributes:
  - `id`: GUID, primary key, default `uuid.uuid4`
  - `election_id`: GUID, foreign key to `elections.id` ondelete `CASCADE`, indexed, nullable=False
  - `code`: String(32), indexed, nullable=False (normalized uppercase, e.g. `PW-7K9M-2X4L`)
  - `status`: String(20), default `"unused"`, indexed, nullable=False (`"unused"` or `"used"`)
  - `used_by_student_id`: String(255), nullable=True, indexed
  - `used_at`: DateTime(timezone=True), nullable=True
  - `created_at`: DateTime(timezone=True), default UTC
  - Unique constraint on `("election_id", "code")`
  Also update `VotingSession` to include `access_code_id: Mapped[uuid.UUID | None]` referencing `election_access_codes.id` (or nullable GUID).

- [ ] **Step 1.2**: In `backend/app/db/session.py` or startup routine, ensure `ElectionBase.metadata.create_all` includes `election_access_codes`.
  Run test/migration verification to ensure table is created in PostgreSQL.

- [ ] **Step 1.3**: Run `pytest backend/tests/test_voter_auth_flow.py` to confirm existing models and schemas compile and pass without regressions.

---

### Task 2: Pydantic Schemas & Backend Services

**Files:**
- Modify: `backend/app/schemas/voter_auth.py`
- Modify: `backend/app/services/voter_admin_service.py`
- Modify: `backend/app/services/voter_auth_service.py`
- Modify: `backend/app/services/ballot_participation_service.py`
- Test: `backend/tests/test_access_codes.py`

- [ ] **Step 2.1**: Define Pydantic schemas in `backend/app/schemas/voter_auth.py`:
  - `GenerateAccessCodesRequest(count: int = Field(ge=1, le=5000))`
  - `AccessCodeItem(id: UUID, code: str, status: str, used_by_student_id: str | None, used_at: datetime | None, created_at: datetime)`
  - `AccessCodeListResponse(items: list[AccessCodeItem], total_count: int, unused_count: int, used_count: int)`
  - `VerifyAccessCodeRequest(code: str)`
  - `VerifyAccessCodeResponse(valid: bool, code: str, election_id: UUID, election_title: str)`
  - `ClaimAccessCodeRequest(code: str, student_id: str)`
  - `ClaimAccessCodeResponse(session_token: str, expires_at: datetime, status: str)`

- [ ] **Step 2.2**: Implement helper generator in `backend/app/services/voter_admin_service.py`:
  - `generate_access_codes(session, election_id, count)`: Generates $N$ unique codes formatted as `PW-XXXX-XXXX` using `secrets.choice("23456789ABCDEFGHJKLMNPQRSTUVWXYZ")`.
  - `list_access_codes(session, election_id, status=None, limit=5000, offset=0)`: Returns items and summary counts.
  - `export_access_codes_csv(session, election_id)`: Generates CSV string for download.

- [ ] **Step 2.3**: Implement access code verification and claiming in `backend/app/services/voter_auth_service.py`:
  - `verify_access_code(session, election_id, raw_code)`: Normalizes code (strips whitespace, hyphens/spaces handled, uppercase). Checks code exists and `status == "unused"`. If used, raises 400 with detail `"This access code has already been used and is expired."`
  - `claim_access_code_and_start_session(session, election_id, raw_code, student_id, terminal_token=None)`:
    - Normalizes `student_id` (strip whitespace, uppercase).
    - Checks that this `student_id` has NOT already participated (`ElectionParticipation` lookup). If participated, raises 409 Conflict: `"Student ID has already voted in this election and cannot vote again."`
    - Checks if election has a pre-registered roster (`ElectionVoterRecord` with `source != 'access_code'`); if so, ensures `student_id` is in the roster. If not, auto-enrolls an eligible `ElectionVoterRecord` with `source="access_code"`.
    - Creates `VotingSession` with `voter_record_id`, `access_code_id`, and active token.

- [ ] **Step 2.4**: Update `backend/app/services/ballot_participation_service.py`:
  In `submit_ballot_atomic`:
  - When recording `ElectionParticipation`, if `voting_sess.access_code_id` is set:
    - Fetch `ElectionAccessCode` by ID.
    - Set `access_code.status = "used"`, `access_code.used_by_student_id = voter.normalized_identifier`, `access_code.used_at = now`.
  - Commit transaction atomically.

---

### Task 3: API Endpoints & Backend Tests

**Files:**
- Modify: `backend/app/api/v1/voter_admin.py`
- Modify: `backend/app/api/v1/voter_auth.py`
- Create: `backend/tests/test_access_codes.py`

- [ ] **Step 3.1**: Add admin endpoints to `backend/app/api/v1/voter_admin.py`:
  - `POST /api/v1/elections/{election_id}/access-codes/generate`
  - `GET /api/v1/elections/{election_id}/access-codes`
  - `GET /api/v1/elections/{election_id}/access-codes/export` (returns text/csv)

- [ ] **Step 3.2**: Add voter endpoints to `backend/app/api/v1/voter_auth.py`:
  - `POST /api/v1/elections/{election_id}/access-codes/verify`
  - `POST /api/v1/elections/{election_id}/access-codes/claim`

- [ ] **Step 3.3**: Write unit and integration tests in `backend/tests/test_access_codes.py`:
  - Test 1: Admin generates 10 access codes; verifies uniqueness and format `PW-XXXX-XXXX`.
  - Test 2: Voter verifies a valid unused access code -> succeeds.
  - Test 3: Voter claims code with Student ID -> gets active voting session.
  - Test 4: Voter submits ballot -> both access code is marked `used` and student ID is marked participated.
  - Test 5: Reusing the same access code fails with 400 (`"This access code has already been used and is expired."`).
  - Test 6: Reusing the same Student ID with a different valid code fails with 409 (`"Student ID has already voted in this election."`).
  - Run `pytest backend/tests/test_access_codes.py -v`.

---

### Task 4: Frontend Types & API Client

**Files:**
- Modify: `frontend/src/types/voter-participation.ts`
- Modify: `frontend/src/lib/api-client.ts`

- [ ] **Step 4.1**: Add TypeScript interfaces in `frontend/src/types/voter-participation.ts`:
  - `AccessCodeItem`: `{ id: string; code: string; status: 'unused' | 'used'; used_by_student_id: string | null; used_at: string | null; created_at: string }`
  - `AccessCodeSummary`: `{ total_count: number; unused_count: number; used_count: number }`
  - `AccessCodeListResponse`: `{ items: AccessCodeItem[]; total_count: number; unused_count: number; used_count: number }`

- [ ] **Step 4.2**: Add methods to `apiClient` in `frontend/src/lib/api-client.ts`:
  - `generateAccessCodes(electionId: string, count: number): Promise<AccessCodeListResponse>`
  - `getAccessCodes(electionId: string): Promise<AccessCodeListResponse>`
  - `exportAccessCodesCsv(electionId: string): Promise<Blob>`
  - `verifyAccessCode(electionId: string, code: string): Promise<{ valid: boolean; code: string; election_id: string; election_title: string }>`
  - `claimAccessCode(electionId: string, code: string, studentId: string): Promise<{ session_token: string; status: string; expires_at: string }>`

---

### Task 5: Admin UI: Access Code Manager & Printable Slips

**Files:**
- Create: `frontend/src/components/admin/AccessCodeManager.tsx`
- Create: `frontend/src/components/admin/PrintableSlipsModal.tsx`
- Modify: `frontend/src/pages/ElectionDetailPage.tsx:1235-1310`
- Modify: `frontend/src/pages/AdminDashboardPage.tsx:1140-1165`

- [ ] **Step 5.1**: Build `PrintableSlipsModal.tsx`:
  - Renders a clean grid of printable voter slips designed for standard paper cutting.
  - Each slip card features:
    - Official Header with election name & PollWise logo/badge.
    - Huge monospace access code (e.g. `PW-7K9M-2X4L`) with a copy button for quick testing.
    - Instructions: `1. Visit voting booth -> 2. Enter code -> 3. Enter your Student ID -> 4. Cast your ballot`.
    - Single-use expiration disclaimer.
  - "Print Slips" button triggers `@media print` layout hiding background/dialog controls and firing `window.print()`.

- [ ] **Step 5.2**: Build `AccessCodeManager.tsx`:
  - Metric cards: Total Codes Generated, Unused (Available), Used (Redeemed).
  - Generation control: Number input (default 50) + "Generate Codes" button with confirmation/loading state.
  - Action buttons: "Print Voter Slips" (opens modal), "Export CSV" (triggers download of `voter_access_codes.csv`).
  - Table of codes with search filter, status badges (`Unused` green, `Used` gray with student ID and timestamp).

- [ ] **Step 5.3**: Integrate `AccessCodeManager.tsx`:
  - In `ElectionDetailPage.tsx`: Replace the legacy email input on Tab 4 ("Voters") with `AccessCodeManager`.
  - In `AdminDashboardPage.tsx` under "Voters & Eligibility": Include `AccessCodeManager` alongside `VoterRosterTable`.

---

### Task 6: Voter UI: Voting Booth Access Code & Student ID Flow

**Files:**
- Create: `frontend/src/components/voter/AccessCodeEntryStep.tsx`
- Create: `frontend/src/components/voter/StudentIDEntryStep.tsx`
- Modify: `frontend/src/pages/VotingBoothPage.tsx`

- [ ] **Step 6.1**: Build `AccessCodeEntryStep.tsx`:
  - Input with placeholder `PW-XXXX-XXXX` (auto-capitalizing, formatted).
  - Clear guidance: "Enter the physical access code from your voter slip."
  - "Verify Code" button with loading spinner.
  - Alert error box for invalid or already-used codes.

- [ ] **Step 6.2**: Build `StudentIDEntryStep.tsx`:
  - Displays verified access code badge (`Verified Slip: PW-7K9M-2X4L`).
  - Input: Student ID (ONLY, as requested).
  - Clear guidance: "Enter your Student ID to proceed to your ballot. This ID will be checked to ensure no duplicate voting."
  - "Proceed to Ballot" button with loading spinner.
  - Error banner handling duplicate student ID rejects.

- [ ] **Step 6.3**: Update `VotingBoothPage.tsx`:
  - Add flow phases: `access_code` and `student_id`.
  - When landing, clicking "Start Voting" opens `access_code` entry.
  - Upon valid code, advances to `student_id` entry.
  - Upon valid student ID, claims session, loads ballot, and advances to ballot positions.
  - Submission confirms ballot and displays clear confirmation that both the code and student ID are now expired.

---

### Task 7: Frontend Vitest Tests

**Files:**
- Create: `frontend/src/test/access-code-voting.test.tsx`

- [ ] **Step 7.1**: Write component and flow tests:
  - `AccessCodeManager` renders summary counters, triggers code generation, and opens printable slips modal.
  - `AccessCodeEntryStep` validates code format, calls verify API, and surfaces error if expired.
  - `StudentIDEntryStep` accepts student ID and calls claim API.
  - Full voting booth transitions through `access_code` -> `student_id` -> ballot -> submission.
- [ ] **Step 7.2**: Run `npm --prefix frontend test` to verify all frontend tests pass.

---

### Task 8: End-to-End Live Verification & Demonstration

**Files:**
- Verification on live services: FastAPI (`http://localhost:8000`) & Vite (`http://localhost:5173`)

- [ ] **Step 8.1**: Open `ElectionDetailPage` for open election `a899a741-f008-4bfc-9eae-17130ccbc3fb` ("Departmental Positions").
- [ ] **Step 8.2**: Generate 5 test access codes via the admin UI. Verify summary updates and table displays codes.
- [ ] **Step 8.3**: Open the Printable Slips preview and verify layout and formatting.
- [ ] **Step 8.4**: Open `/elections/a899a741-f008-4bfc-9eae-17130ccbc3fb/vote`.
- [ ] **Step 8.5**: Enter one generated code -> Enter student ID `STU-TEST-001` -> Cast ballot -> Verify confirmation.
- [ ] **Step 8.6**: Test invalidation 1: Try entering the same code again -> Confirm rejected as used.
- [ ] **Step 8.7**: Test invalidation 2: Try entering another fresh code with student ID `STU-TEST-001` -> Confirm rejected because Student ID has already voted.
- [ ] **Step 8.8**: Verify all test suites (`pytest` and `vitest`) are 100% green.

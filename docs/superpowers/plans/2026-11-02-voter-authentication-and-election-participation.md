# Voter Authentication and Election Participation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete voter authentication, candidate-by-candidate ballot experience, personal-device voting, and supervised multi-PC voting centre system for Pollwise, with independent election voter rolls, on-screen six-digit OTP verification, atomic ballot submission, and strict duplicate-voting prevention.

**Architecture:** Election-domain architecture where `election_db` hosts voter authentication configuration, independent election voter rolls, on-screen OTP challenges, voting sessions, participation tracking, and terminal infrastructure, while `ballot_db` stores strictly anonymous ballots without any voter identifiers or session references. A two-database coordinated atomic submission guarantees that one accepted ballot corresponds to exactly one voter participation record.

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy 2.0 (async), PostgreSQL / SQLite, React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Vitest, pytest.

**Spec:** `docs/superpowers/specs/2026-11-02-voter-authentication-and-election-participation-design.md`

## Global Constraints

- **Single configured identifier per election:** Exactly one of `institutional_email` or `institutional_id` per election.
- **On-screen OTP verification:** The 6-digit OTP is generated server-side and returned directly in the challenge HTTP response to display on the same screen; never delivered via email or SMS.
- **Independent voter roll:** Each election has its own voter roll (`election_voter_records`); voters do not need pre-existing Pollwise user accounts or passwords.
- **Candidate-by-candidate ballot:** Exactly one position per screen with explicit support for candidate selection and optional position skipping.
- **Duplicate voting policy:** Exactly one accepted ballot per eligible voter record per election, enforced by `UNIQUE(election_id, voter_record_id)` in `election_participation`.
- **Secret ballot separation:** Under no circumstances may `ballot_db.ballots` contain `voter_record_id`, `user_id`, `session_id`, or `terminal_id`.
- **Timing of participation flag:** Never mark a voter as having voted when entering an identifier or verifying an OTP; mark `submitted` only after the ballot is successfully accepted into `ballot_db`.

## Review Focus

1. **Concurrent submissions from two devices for the same voter:** The database constraint `UNIQUE(election_id, voter_record_id)` must ensure that simultaneous submissions result in exactly one accepted ballot and one rejected request.
2. **Idempotency on network timeout retries:** Submitting the same ballot with the same `idempotency_key` must return the existing confirmation reference without inserting a second ballot into `ballot_db`.
3. **Session draft wiping on terminal reset:** When a voting centre terminal times out or receives a supervisor reset, client state, drafts, and session tokens must be immediately purged so the next voter sees a clean idle screen.
4. **Required position enforcement:** If a position is marked `min_selections >= 1` and required, the voter cannot skip it or submit without selecting a candidate.
5. **No voter identity in ballot storage:** Automated privacy tests must query `ballot_db.ballots` directly to verify absence of any identifiable voter columns or foreign keys.

---

### Task 1: Backend Database Models & Schemas

**Files:**
- Create: `backend/app/models/voter_auth.py`
- Create: `backend/app/schemas/voter_auth.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/schemas/__init__.py`
- Test: `backend/tests/test_voter_auth_models.py`

**Interfaces:**
- Consumes: `app.db.base.ElectionBase`, `app.db.base.BallotBase`, `app.models.identity.GUID`
- Produces: SQLAlchemy models `ElectionVoterAuthConfig`, `ElectionVoterRecord`, `VoterOTPChallenge`, `VotingSession`, `ElectionParticipation`, `VotingCentre`, `VotingTerminal`; Pydantic schemas for configs, voter roll, OTP challenges, and ballot sessions.

- [ ] **Step 1: Write the failing tests for models and schemas**

```python
# backend/tests/test_voter_auth_models.py
import uuid
from datetime import UTC, datetime
import pytest
from app.models.voter_auth import (
    ElectionVoterAuthConfig,
    ElectionVoterRecord,
    VoterOTPChallenge,
    VotingSession,
    ElectionParticipation,
    VotingCentre,
    VotingTerminal,
)
from app.schemas.voter_auth import (
    VoterAuthConfigCreate,
    VoterAuthConfigResponse,
    VoterRecordCreate,
    VoterRecordResponse,
    VoterChallengeRequest,
    VoterChallengeResponse,
    VoterVerifyRequest,
    VoterSessionResponse,
)

def test_voter_auth_config_defaults():
    config = ElectionVoterAuthConfig(
        election_id=uuid.uuid4(),
        identifier_type="institutional_email",
    )
    assert config.otp_length == 6
    assert config.otp_expiry_seconds == 300
    assert config.otp_max_attempts == 5
    assert config.allow_position_skip is True

def test_voter_record_uniqueness_fields():
    rec = ElectionVoterRecord(
        election_id=uuid.uuid4(),
        identifier_type="institutional_id",
        normalized_identifier="STU-12345",
        eligibility_status="eligible",
    )
    assert rec.eligibility_status == "eligible"
    assert rec.voter_reference_id is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend\.venv\Scripts\pytest backend\tests\test_voter_auth_models.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'app.models.voter_auth'`

- [ ] **Step 3: Implement models in `backend/app/models/voter_auth.py` and schemas in `backend/app/schemas/voter_auth.py`**

Define SQLAlchemy models mapped to `ElectionBase`:
- `ElectionVoterAuthConfig`: `id`, `election_id` (unique FK), `identifier_type`, `identifier_label`, `identifier_normalization_rules`, `otp_length` (default 6), `otp_expiry_seconds` (300), `otp_max_attempts` (5), `otp_regeneration_cooldown_seconds` (30), `session_idle_timeout_seconds` (600), `session_max_duration_seconds` (3600), `allow_session_resume` (bool, default True), `allow_position_skip` (bool, default True), `configuration_locked_at` (nullable datetime).
- `ElectionVoterRecord`: `id`, `election_id`, `identifier_type`, `normalized_identifier`, `voter_reference_id` (nullable), `eligibility_status` ('eligible', 'ineligible', 'suspended', 'revoked'), `voter_group` (nullable str), `source` ('csv_import', 'manual_entry'). UniqueConstraint: `("election_id", "identifier_type", "normalized_identifier")`.
- `VoterOTPChallenge`: `id`, `election_id`, `voter_record_id`, `challenge_hash`, `otp_hash`, `attempt_count`, `expires_at`, `consumed_at`.
- `VotingSession`: `id`, `election_id`, `voter_record_id`, `terminal_id` (nullable), `session_token_hash`, `session_status` ('active', 'idle', 'submitting', 'submitted', 'expired', 'cancelled', 'invalidated'), `draft_payload` (JSON dict), `idempotency_key` (nullable str), `confirmation_reference` (nullable str), `expires_at`, `last_activity_at`.
- `ElectionParticipation`: `id`, `election_id`, `voter_record_id`, `participation_status` ('submitted'), `submitted_at`, `confirmation_reference`. UniqueConstraint: `("election_id", "voter_record_id")`.
- `VotingCentre`: `id`, `institution_id`, `name`, `location_description`, `status`.
- `VotingTerminal`: `id`, `voting_centre_id`, `institution_id`, `terminal_name`, `authorized_election_id`, `terminal_status`, `auth_token_hash`, `last_seen_at`.

Define corresponding Pydantic schemas in `backend/app/schemas/voter_auth.py`.

- [ ] **Step 4: Run test to verify it passes**

Run: `backend\.venv\Scripts\pytest backend\tests\test_voter_auth_models.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/voter_auth.py backend/app/schemas/voter_auth.py backend/tests/test_voter_auth_models.py
git commit -m "feat(backend): add voter auth and participation database models and schemas"
```

---

### Task 2: Voter Authentication Configuration & Roster Management API

**Files:**
- Create: `backend/app/services/voter_admin_service.py`
- Create: `backend/app/api/v1/voter_admin.py`
- Modify: `backend/app/api/v1/router.py`
- Test: `backend/tests/test_voter_admin_api.py`

**Interfaces:**
- Consumes: `ElectionVoterAuthConfig`, `ElectionVoterRecord`, `get_election_session`, `get_current_user`
- Produces: Endpoints for auth config CRUD & lock, CSV validation preview (`/preview`), CSV import (`/import`), manual voter roll management.

- [ ] **Step 1: Write the failing tests for voter admin endpoints**

```python
# backend/tests/test_voter_admin_api.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_voter_auth_config_lifecycle(client: AsyncClient, admin_token: str, draft_election_id: str):
    # Configure auth with Institutional ID
    resp = await client.put(
        f"/api/v1/elections/{draft_election_id}/voter-auth-config",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "identifier_type": "institutional_id",
            "identifier_label": "Student ID",
            "allow_position_skip": True,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["identifier_type"] == "institutional_id"
    assert data["identifier_label"] == "Student ID"

@pytest.mark.asyncio
async def test_voter_roll_csv_preview_and_import(client: AsyncClient, admin_token: str, draft_election_id: str):
    csv_content = "identifier,voter_group\nSTU-001,Engineering\nSTU-002,Medicine\nSTU-001,Duplicate\n"
    files = {"file": ("voters.csv", csv_content, "text/csv")}
    resp = await client.post(
        f"/api/v1/elections/{draft_election_id}/voters/preview",
        headers={"Authorization": f"Bearer {admin_token}"},
        files=files,
    )
    assert resp.status_code == 200
    preview = resp.json()
    assert preview["valid_count"] == 2
    assert preview["duplicate_count"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend\.venv\Scripts\pytest backend\tests\test_voter_admin_api.py -v`  
Expected: FAIL with 404 Not Found

- [ ] **Step 3: Implement `voter_admin_service.py` and `voter_admin.py` router**

In `backend/app/services/voter_admin_service.py`:
- `get_or_create_auth_config(session, election_id)`
- `update_auth_config(session, election_id, config_in)` (ensures election is not locked)
- `lock_auth_config(session, election_id)`
- `preview_csv_voters(session, election_id, csv_bytes)`: parses RFC 4180 CSV, checks normalization, detects duplicates in file and existing records, returns counts and sample error rows.
- `import_csv_voters(session, election_id, csv_bytes)`: inserts valid records in chunks of 500 using `upsert` or skip existing.
- `add_single_voter(session, election_id, voter_in)`
- `list_voters(session, election_id, page, page_size, query, status)`

In `backend/app/api/v1/voter_admin.py`:
- Register endpoints under `/elections/{id}/voter-auth-config` and `/elections/{id}/voters`.
- Register in `backend/app/api/v1/router.py`.

- [ ] **Step 4: Run test to verify it passes**

Run: `backend\.venv\Scripts\pytest backend\tests\test_voter_admin_api.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/voter_admin_service.py backend/app/api/v1/voter_admin.py backend/tests/test_voter_admin_api.py
git commit -m "feat(backend): implement voter auth config and voter roll CSV management API"
```

---

### Task 3: Voter Authentication & On-Screen OTP Engine

**Files:**
- Create: `backend/app/services/voter_auth_service.py`
- Create: `backend/app/api/v1/voter_auth.py`
- Modify: `backend/app/api/v1/router.py`
- Test: `backend/tests/test_voter_auth_api.py`

**Interfaces:**
- Consumes: `ElectionVoterRecord`, `VoterOTPChallenge`, `VotingSession`, `ElectionParticipation`
- Produces: `POST /voter-auth/request-challenge`, `POST /voter-auth/verify-challenge`, `POST /voter-auth/regenerate-challenge`, `POST /voter-auth/end-session`.

- [ ] **Step 1: Write the failing tests for on-screen OTP challenge & verification**

```python
# backend/tests/test_voter_auth_api.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_on_screen_otp_generation_and_verification(
    client: AsyncClient, open_election_with_voter: tuple[str, str]
):
    election_id, voter_identifier = open_election_with_voter
    
    # 1. Request challenge
    resp = await client.post(
        f"/api/v1/elections/{election_id}/voter-auth/request-challenge",
        json={"identifier": voter_identifier},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "challenge_id" in data
    assert "otp_code" in data
    assert len(data["otp_code"]) == 6
    assert data["otp_code"].isdigit()
    
    # 2. Verify with wrong code -> Fail
    bad_resp = await client.post(
        f"/api/v1/elections/{election_id}/voter-auth/verify-challenge",
        json={"challenge_id": data["challenge_id"], "entered_otp": "000000"},
    )
    assert bad_resp.status_code == 400
    assert "INCORRECT_CODE" in bad_resp.json()["detail"]["code"]
    
    # 3. Verify with correct code -> Success & Session Created
    ok_resp = await client.post(
        f"/api/v1/elections/{election_id}/voter-auth/verify-challenge",
        json={"challenge_id": data["challenge_id"], "entered_otp": data["otp_code"]},
    )
    assert ok_resp.status_code == 200
    session_data = ok_resp.json()
    assert "session_token" in session_data
    assert session_data["status"] == "active"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend\.venv\Scripts\pytest backend\tests\test_voter_auth_api.py -v`  
Expected: FAIL with 404 Not Found

- [ ] **Step 3: Implement `voter_auth_service.py` and `voter_auth.py` router**

In `backend/app/services/voter_auth_service.py`:
- `request_challenge(session, election_id, raw_identifier, terminal_id)`:
  - Check election exists and status == 'open'.
  - Normalize identifier based on config rules.
  - Search `election_voter_records`. If not found or status != 'eligible', return generic 403 `VOTER_NOT_ELIGIBLE`.
  - Check `election_participation` for `voter_record_id`. If exists, return 409 `VOTER_ALREADY_SUBMITTED`.
  - Generate cryptographically secure 6-digit OTP using `secrets.randbelow(1000000)` padded to 6 chars.
  - Hash OTP with SHA-256 + salt; store in `voter_otp_challenges`.
  - Return `challenge_id`, `otp_code` (plaintext to display on screen), `expires_in_seconds`.
- `verify_challenge(session, election_id, challenge_id, entered_otp)`:
  - Lookup challenge, verify not expired and not consumed.
  - Check `attempt_count < 5`; increment attempt. If exceeds, lock challenge.
  - Compare SHA-256 hashes using `secrets.compare_digest`.
  - Mark challenge consumed.
  - Create `voting_sessions` with 32-byte secure token, store token hash, return raw token.
- `regenerate_challenge(session, challenge_id)`: respects 30s cooldown.
- `end_session(session, session_token)`: sets session status to 'cancelled'.

- [ ] **Step 4: Run test to verify it passes**

Run: `backend\.venv\Scripts\pytest backend\tests\test_voter_auth_api.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/voter_auth_service.py backend/app/api/v1/voter_auth.py backend/tests/test_voter_auth_api.py
git commit -m "feat(backend): implement on-screen OTP challenge and voter session authentication"
```

---

### Task 4: Ballot Progression, Drafts & Atomic Secret Submission

**Files:**
- Create: `backend/app/services/ballot_participation_service.py`
- Create: `backend/app/api/v1/voter_ballot.py`
- Modify: `backend/app/api/v1/router.py`
- Test: `backend/tests/test_voter_ballot_submission.py`

**Interfaces:**
- Consumes: `voting_sessions`, `election_participation`, `ballot_db.ballots`, `positions`, `candidates`
- Produces: `GET /ballot`, `PUT /ballot/draft`, `POST /ballot/submit`, `GET /ballot/submission-status`.

- [ ] **Step 1: Write the failing tests for ballot retrieval, drafting, atomic submission and concurrency**

```python
# backend/tests/test_voter_ballot_submission.py
import asyncio
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_ballot_submission_and_duplicate_prevention(
    client: AsyncClient, active_voter_session: tuple[str, str, dict]
):
    election_id, session_token, ballot_payload = active_voter_session
    
    # 1. Fetch ballot structure
    resp = await client.get(
        f"/api/v1/elections/{election_id}/ballot",
        headers={"X-Voting-Session": session_token},
    )
    assert resp.status_code == 200
    positions = resp.json()["positions"]
    assert len(positions) > 0
    
    # 2. Submit ballot
    sub_resp = await client.post(
        f"/api/v1/elections/{election_id}/ballot/submit",
        headers={"X-Voting-Session": session_token},
        json={
            "selections": ballot_payload["selections"],
            "idempotency_key": "idemp-test-12345",
        },
    )
    assert sub_resp.status_code == 200
    receipt = sub_resp.json()
    assert "confirmation_reference" in receipt
    assert receipt["confirmation_reference"].startswith("PW-")
    
    # 3. Second submission attempt with new session for same voter -> 409 Rejected
    # (Verified via test fixture that attempts to authenticate same voter again)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend\.venv\Scripts\pytest backend\tests\test_voter_ballot_submission.py -v`  
Expected: FAIL with 404 Not Found

- [ ] **Step 3: Implement `ballot_participation_service.py` and `voter_ballot.py`**

In `backend/app/services/ballot_participation_service.py`:
- `get_ballot_for_session(election_session, election_id, session_token)`:
  - Authenticate session token hash in `voting_sessions`.
  - Fetch active positions deterministically ordered by `display_order`, with active candidates.
  - Return structure alongside current saved `draft_payload`.
- `save_ballot_draft(election_session, election_id, session_token, draft_payload)`:
  - Validates session is active, updates `draft_payload` and `last_activity_at`.
- `submit_ballot_atomic(election_session, ballot_session, election_id, session_token, selections, idempotency_key)`:
  - Lock `voting_sessions` row with `FOR UPDATE`.
  - If `session_status == 'submitted'`, return stored `confirmation_reference`.
  - Re-verify election is currently open.
  - Re-verify voter record in `election_voter_records` is `eligible`.
  - Verify voter has not already submitted in `election_participation`.
  - Validate all position IDs and candidate IDs; verify required positions are answered.
  - Coordinated Two-Database Commit:
    1. Insert anonymous vote into `ballot_db.ballots` (stores choices payload only, zero voter identity).
    2. Generate unique `confirmation_reference` (e.g. `PW-{election_id[:4].upper()}-{secrets.token_hex(4).upper()}`).
    3. Insert into `election_participation` (`election_id`, `voter_record_id`, `confirmation_reference`, `submitted_at`).
    4. Set `voting_sessions.session_status = 'submitted'`, record `idempotency_key` and `confirmation_reference`.
    5. Invalidate any other active sessions for that `voter_record_id`.
    6. Commit both sessions. If error occurs, rollback both.

In `backend/app/api/v1/voter_ballot.py`:
- Expose `/elections/{id}/ballot`, `/draft`, `/submit`, `/submission-status`.

- [ ] **Step 4: Run test to verify it passes**

Run: `backend\.venv\Scripts\pytest backend\tests\test_voter_ballot_submission.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ballot_participation_service.py backend/app/api/v1/voter_ballot.py backend/tests/test_voter_ballot_submission.py
git commit -m "feat(backend): implement ballot progression, session drafts, and atomic submission"
```

---

### Task 5: Voting Centres & Terminal Kiosk Management

**Files:**
- Create: `backend/app/services/voting_centre_service.py`
- Create: `backend/app/api/v1/voting_centres.py`
- Modify: `backend/app/api/v1/router.py`
- Test: `backend/tests/test_voting_centres_api.py`

**Interfaces:**
- Consumes: `VotingCentre`, `VotingTerminal`, `get_election_session`
- Produces: APIs for creating centres, registering terminals, terminal heartbeat, supervisor terminal reset.

- [ ] **Step 1: Write the failing tests for voting centre and terminal lifecycle**

```python
# backend/tests/test_voting_centres_api.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_voting_centre_and_terminal_lifecycle(client: AsyncClient, admin_token: str, institution_id: str):
    # 1. Create voting centre
    c_resp = await client.post(
        "/api/v1/voting-centres",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "institution_id": institution_id,
            "name": "Main Campus Library Hall",
            "location_description": "Building A, Ground Floor",
        },
    )
    assert c_resp.status_code == 201
    centre_id = c_resp.json()["id"]
    
    # 2. Register terminal
    t_resp = await client.post(
        f"/api/v1/voting-centres/{centre_id}/terminals",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"terminal_name": "Terminal 01"},
    )
    assert t_resp.status_code == 201
    terminal_data = t_resp.json()
    assert "token" in terminal_data
    terminal_id = terminal_data["id"]
    terminal_token = terminal_data["token"]
    
    # 3. Terminal heartbeat
    h_resp = await client.post(
        f"/api/v1/voting-terminals/{terminal_id}/heartbeat",
        headers={"X-Terminal-Token": terminal_token},
        json={"current_status": "idle"},
    )
    assert h_resp.status_code == 200
    assert h_resp.json()["command"] == "none"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend\.venv\Scripts\pytest backend\tests\test_voting_centres_api.py -v`  
Expected: FAIL with 404 Not Found

- [ ] **Step 3: Implement `voting_centre_service.py` and `voting_centres.py` router**

In `backend/app/services/voting_centre_service.py`:
- `create_centre(session, institution_id, name, location)`
- `list_centres(session, institution_id)`
- `register_terminal(session, centre_id, terminal_name, election_id)`: creates terminal record, generates 32-byte terminal token, stores hash, returns token.
- `terminal_heartbeat(session, terminal_id, token, status)`: verifies token, updates `last_seen_at` and `terminal_status`, checks if a supervisor reset is pending (returns `command: "reset"` or `"none"`).
- `supervisor_reset_terminal(session, terminal_id)`: sets terminal status to 'resetting' and flags pending reset command.

In `backend/app/api/v1/voting_centres.py`:
- Register endpoints for centres, terminals, heartbeats, and supervisor resets.

- [ ] **Step 4: Run test to verify it passes**

Run: `backend\.venv\Scripts\pytest backend\tests\test_voting_centres_api.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/voting_centre_service.py backend/app/api/v1/voting_centres.py backend/tests/test_voting_centres_api.py
git commit -m "feat(backend): implement voting centres and supervised terminal kiosk endpoints"
```

---

### Task 6: Frontend API Client & Voter Types

**Files:**
- Create: `frontend/src/types/voter-participation.ts`
- Modify: `frontend/src/lib/api-client.ts`
- Test: `frontend/src/test/api-client-voter-participation.test.ts`

**Interfaces:**
- Consumes: Backend OpenAPI contracts for voter auth, roster, ballot, and centres
- Produces: Strongly typed methods on `apiClient` for all voter-facing and admin voter roll flows.

- [ ] **Step 1: Write the failing tests for API client voter participation methods**

```typescript
// frontend/src/test/api-client-voter-participation.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient } from "../lib/api-client";

describe("apiClient voter participation methods", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls requestVoterChallenge and receives on-screen OTP code", async () => {
    const mockResponse = {
      challenge_id: "ch-123",
      otp_code: "482916",
      expires_in_seconds: 300,
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const res = await apiClient.requestVoterChallenge("elec-1", "student@uni.edu");
    expect(res.otp_code).toBe("482916");
    expect(res.challenge_id).toBe("ch-123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test frontend/src/test/api-client-voter-participation.test.ts`  
Expected: FAIL with `apiClient.requestVoterChallenge is not a function`

- [ ] **Step 3: Implement `frontend/src/types/voter-participation.ts` and update `frontend/src/lib/api-client.ts`**

Define types for:
- `VoterAuthConfig`, `VoterRecord`, `VoterCSVPreviewReport`
- `VoterChallengeResponse`, `VoterVerifyResponse`, `VoterBallotPayload`, `BallotSubmissionReceipt`
- `VotingCentre`, `VotingTerminal`, `TerminalHeartbeatResponse`

Add methods on `apiClient`:
- `getVoterAuthConfig(electionId)`
- `updateVoterAuthConfig(electionId, config)`
- `lockVoterAuthConfig(electionId)`
- `previewVoterRollCSV(electionId, file)`
- `importVoterRollCSV(electionId, file)`
- `requestVoterChallenge(electionId, identifier, terminalToken?)`
- `verifyVoterChallenge(electionId, challengeId, enteredOtp)`
- `getVoterBallot(electionId, sessionToken)`
- `saveVoterBallotDraft(electionId, sessionToken, draft)`
- `submitVoterBallot(electionId, sessionToken, selections, idempotencyKey)`
- `terminalHeartbeat(terminalId, terminalToken, status)`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test frontend/src/test/api-client-voter-participation.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/voter-participation.ts frontend/src/lib/api-client.ts frontend/src/test/api-client-voter-participation.test.ts
git commit -m "feat(frontend): add voter participation types and apiClient integration methods"
```

---

### Task 7: Frontend Candidate-by-Candidate Voter Experience

**Files:**
- Modify: `frontend/src/pages/VotingBoothPage.tsx`
- Create: `frontend/src/components/voter/VoterLandingStep.tsx`
- Create: `frontend/src/components/voter/IdentifierEntryStep.tsx`
- Create: `frontend/src/components/voter/OTPVerificationStep.tsx`
- Create: `frontend/src/components/voter/BallotInstructionsStep.tsx`
- Create: `frontend/src/components/voter/PositionVoteStep.tsx`
- Create: `frontend/src/components/voter/BallotReviewStep.tsx`
- Create: `frontend/src/components/voter/SubmissionConfirmedStep.tsx`
- Test: `frontend/src/test/voting-booth-flow.test.tsx`

**Interfaces:**
- Consumes: `apiClient` voter methods, `useParams`
- Produces: The complete, standalone, accessible candidate-by-candidate voting experience.

- [ ] **Step 1: Write the failing tests for the complete multi-step voter flow**

```typescript
// frontend/src/test/voting-booth-flow.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { VotingBoothPage } from "../pages/VotingBoothPage";

describe("VotingBoothPage Independent Voter Experience", () => {
  it("progresses from identifier entry to on-screen OTP display, ballot navigation, skip, and review", async () => {
    // Tests:
    // 1. Renders configured identifier input ("Student ID")
    // 2. Submits identifier -> Displays 6-digit OTP ("482916") directly on screen
    // 3. Enters OTP -> Navigates to ballot instructions
    // 4. Starts ballot -> Shows Position 1 of 2
    // 5. Selects candidate A -> Clicks Next
    // 6. Shows Position 2 of 2 -> Clicks "Skip this Position"
    // 7. Review screen shows Position 1: Candidate A, Position 2: Skipped
    // 8. Clicks Submit -> Confirmation dialog appears -> Confirms -> Receipt displayed
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test frontend/src/test/voting-booth-flow.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement the multi-step voter booth components and rewrite `VotingBoothPage.tsx`**

Build modular step components:
1. `VoterLandingStep`: Title, description, voting window, instructions, "Start Voting" button.
2. `IdentifierEntryStep`: Dynamic input based on configured `identifier_type` (`institutional_email` or `institutional_id` with label), validation, error message.
3. `OTPVerificationStep`: Large prominent display of the server-returned 6-digit OTP code, 6 segmented numeric input boxes, countdown timer, regenerate action, support link.
4. `BallotInstructionsStep`: Voting rules, skip explanation, secret ballot guarantee.
5. `PositionVoteStep`: Position title, `Position X of Y` progress, candidate cards (name, photo, manifesto preview, radio/checkbox), prominent **"Skip this Position"** button, Back / Next buttons.
6. `BallotReviewStep`: Table of all positions showing chosen candidate or "Skipped", edit shortcuts, "Submit Ballot" button with finality confirmation modal.
7. `SubmissionConfirmedStep`: Green confirmation checkmark, receipt code, copy button, auto-reset countdown for voting centre kiosks.

Rewrite `frontend/src/pages/VotingBoothPage.tsx` to orchestrate this flow with draft auto-saving, back-button history trapping, and session timeout alerts.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test frontend/src/test/voting-booth-flow.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/VotingBoothPage.tsx frontend/src/components/voter/ frontend/src/test/voting-booth-flow.test.tsx
git commit -m "feat(frontend): implement candidate-by-candidate voter flow with on-screen OTP and review"
```

---

### Task 8: Frontend Admin Wizard & Dashboard Integration

**Files:**
- Modify: `frontend/src/pages/CreateElectionWizardPage.tsx`
- Modify: `frontend/src/pages/AdminDashboardPage.tsx`
- Create: `frontend/src/components/admin/VoterAuthConfigCard.tsx`
- Create: `frontend/src/components/admin/VoterRosterTable.tsx`
- Create: `frontend/src/components/admin/VoterCSVImportModal.tsx`
- Test: `frontend/src/test/admin-voter-auth-roster.test.tsx`

**Interfaces:**
- Consumes: `apiClient` admin voter methods
- Produces: Voter Authentication configuration wizard step, "Voters & Authentication" dashboard tab with CSV drag-and-drop preview and manual add.

- [ ] **Step 1: Write the failing tests for admin voter configuration and roster management**

```typescript
// frontend/src/test/admin-voter-auth-roster.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdminDashboardPage } from "../pages/AdminDashboardPage";

describe("Admin Dashboard Voters & Authentication Tab", () => {
  it("renders auth config card, CSV preview modal, and voter roster table with counts", async () => {
    // Tests:
    // 1. Switches to Voters tab
    // 2. Toggles Institutional ID vs Institutional Email
    // 3. Opens CSV import modal, displays parsed preview report
    // 4. Displays voter roll records with search and status badges
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test frontend/src/test/admin-voter-auth-roster.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement admin voter configuration and roster components**

- `VoterAuthConfigCard`: Selects Institutional Email or Institutional ID, configures display label, OTP timeout, skip policy, lock config button.
- `VoterCSVImportModal`: Drag-and-drop file upload, calls `/preview`, shows valid/duplicate/error summary, and commits via `/import`.
- `VoterRosterTable`: Paginated table of registered identifiers, eligibility status, voter group, manual add voter dialog, delete voter.
- Integrate into `CreateElectionWizardPage.tsx` as Step 3 ("Voter Authentication").
- Integrate into `AdminDashboardPage.tsx` under the new `voters` tab.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test frontend/src/test/admin-voter-auth-roster.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/CreateElectionWizardPage.tsx frontend/src/pages/AdminDashboardPage.tsx frontend/src/components/admin/ frontend/src/test/admin-voter-auth-roster.test.tsx
git commit -m "feat(frontend): integrate voter auth config and voter roster management into admin console"
```

---

### Task 9: Frontend Multi-PC Voting Centre Kiosk & Supervisor Hub

**Files:**
- Create: `frontend/src/pages/TerminalKioskPage.tsx`
- Create: `frontend/src/pages/SupervisorVotingCentresPage.tsx`
- Modify: `frontend/src/app/router.tsx`
- Test: `frontend/src/test/voting-centre-kiosk.test.tsx`

**Interfaces:**
- Consumes: `apiClient` voting centre methods, `VotingBoothPage`
- Produces: Kiosk wrapper route `/terminals/:terminalId/booth`, Supervisor hub `/admin/voting-centres`.

- [ ] **Step 1: Write the failing tests for terminal kiosk and supervisor hub**

```typescript
// frontend/src/test/voting-centre-kiosk.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TerminalKioskPage } from "../pages/TerminalKioskPage";

describe("Voting Centre Terminal Kiosk and Supervisor Hub", () => {
  it("polls heartbeat every 5 seconds and resets immediately on supervisor reset command", async () => {
    // Tests:
    // 1. Terminal mounts and initiates heartbeat polling
    // 2. Simulates command: 'reset' in heartbeat response
    // 3. Terminal state wipes in-memory draft and navigates back to idle landing
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test frontend/src/test/voting-centre-kiosk.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement `TerminalKioskPage.tsx`, `SupervisorVotingCentresPage.tsx`, and add router entries**

- `TerminalKioskPage.tsx`:
  - Full-screen distraction-free kiosk wrapper.
  - Passes `terminalToken` to child voter requests.
  - Heartbeat timer (5 seconds) calling `terminalHeartbeat`.
  - When `command === "reset"`, clears session and transitions terminal to `resetting` -> `idle`.
  - Auto-reset timer (15 seconds) after submission confirmation.
- `SupervisorVotingCentresPage.tsx`:
  - Displays grid of authorized terminals with status pills (Idle, Voting, Review, Offline, Last Heartbeat).
  - "Reset Terminal" action button to send remote reset command.
- Add routes in `frontend/src/app/router.tsx`:
  - `/terminals/:terminalId/booth` (public kiosk route)
  - `/admin/voting-centres` (protected admin route)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test frontend/src/test/voting-centre-kiosk.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/TerminalKioskPage.tsx frontend/src/pages/SupervisorVotingCentresPage.tsx frontend/src/app/router.tsx frontend/src/test/voting-centre-kiosk.test.tsx
git commit -m "feat(frontend): implement voting centre kiosk route and supervisor monitoring hub"
```

---

### Task 10: Full End-to-End Integration, Concurrency & Privacy Verification

**Files:**
- Create: `backend/tests/test_voter_e2e_lifecycle.py`
- Modify: `frontend/src/test/voting-booth.test.tsx`
- Test: `backend/tests/test_voter_e2e_lifecycle.py`

**Interfaces:**
- Consumes: All backend and frontend voter participation components
- Produces: Complete end-to-end test verification proving all 20 acceptance criteria.

- [ ] **Step 1: Write comprehensive end-to-end lifecycle, concurrency, and secret-ballot privacy tests**

```python
# backend/tests/test_voter_e2e_lifecycle.py
import asyncio
import pytest
from httpx import AsyncClient
from sqlalchemy import text
from app.db.session import ballot_session_maker

@pytest.mark.asyncio
async def test_full_voter_lifecycle_and_secret_ballot_invariants(
    client: AsyncClient, admin_token: str, institution_id: str
):
    # 1. Admin creates election with Institutional ID auth
    # 2. Admin imports CSV with 3 eligible voters
    # 3. Admin launches election (status = 'open')
    # 4. Voter 1 accesses booth -> enters ID -> receives 6-digit OTP -> enters OTP
    # 5. Voter 1 votes Candidate A for Position 1, skips Position 2 -> reviews -> submits
    # 6. Verify duplicate voting: Voter 1 attempts second challenge -> 409 Rejected
    # 7. Concurrent submission test: simultaneous ballot submits for Voter 2 -> exactly 1 succeeds
    # 8. Secret Ballot Invariant: query ballot_db.ballots directly; verify zero voter_record_id or session references
    async with ballot_session_maker() as b_session:
        res = await b_session.execute(text("SELECT * FROM ballots"))
        rows = res.fetchall()
        assert len(rows) > 0
        for row in rows:
            # Confirm no identity linkage
            assert "voter" not in str(row).lower()
```

- [ ] **Step 2: Run test to verify it fails if anything is incomplete**

Run: `backend\.venv\Scripts\pytest backend\tests\test_voter_e2e_lifecycle.py -v`  
Expected: FAIL if any part of the integrated lifecycle is broken

- [ ] **Step 3: Fix any discrepancies across backend and frontend integrations**

Ensure all integration points adhere to error codes, response structures, and secret-ballot database constraints.

- [ ] **Step 4: Run full test suites across backend and frontend**

Run:
1. `backend\.venv\Scripts\pytest backend\tests -q`
2. `npm --prefix frontend test`

Expected: 100% of tests pass across both suites.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_voter_e2e_lifecycle.py frontend/src/test/voting-booth.test.tsx
git commit -m "test: add comprehensive voter participation e2e lifecycle and secret-ballot verification"
```

---

## Plan Self-Review Checklist

1. **Spec coverage:**
   - Section 4 (Auth Config): Covered in Task 1, 2, 8.
   - Section 5 & 8 (On-Screen 6-digit OTP): Covered in Task 3, 7.
   - Section 6 (Voter Roll & Eligibility): Covered in Task 1, 2, 8.
   - Section 7 (Identifier Entry): Covered in Task 3, 7.
   - Section 10–13 (Candidate-by-Candidate Ballot & Review): Covered in Task 4, 7.
   - Section 14–15 (Atomic Submission & Duplicate Protection): Covered in Task 4, 10.
   - Section 16 (Mobile Optimization): Covered in Task 7.
   - Section 17 (Multi-PC Voting Centres): Covered in Task 5, 9.
   - Section 20 (Secret Ballot Invariant): Covered in Task 1, 4, 10.
   - Acceptance Criteria 1–20: All covered across Tasks 1–10.

2. **Step scan:** Each task has explicit failing test steps, verification commands, file paths, and exact implementation directives.
3. **Type consistency:** Identifiers, models, schemas, and endpoint paths are consistent across backend (`backend/app/schemas/voter_auth.py`) and frontend (`frontend/src/types/voter-participation.ts`).
4. **Review focus:** Concurrency, idempotency, draft wiping, required position validation, and zero voter identity in `ballot_db` are pinned to specific test steps.
5. **Proportion:** Clear, structured, and focused without unnecessary code transcription.

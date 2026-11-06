# Recount and Dispute Handling Design

## Intent & The Why
Pollwise is an institutional voting platform built on strict ballot secrecy, immutable records, and auditable election lifecycles. Once an election is closed, results are computed deterministically from the preserved anonymous ballots in `ballot_db`. However, disputes or questions regarding tie resolutions, ballot tally accuracy, or administrative objections may arise before or after publication. 

To resolve disputes with cryptographic integrity and without invalidating the secret-ballot boundary, Pollwise specifies a formal recount mechanism (Doc 01 §12.4, Doc 02 §3.2, Doc 03 §8.5):
1. An authorized institutional authority (Admin, Election Manager, or Auditor) can initiate a formal recount with documented justification.
2. The recount re-runs the deterministic tally calculation directly from the preserved, immutable ballots in `ballot_db`.
3. Instead of overwriting previous results, the recount produces an incremented, versioned record (`result_version = 2, 3, ...`) in `election_results`, linking to the formal `recount_requests` record.
4. The system calculates any discrepancy/delta between tally versions (e.g., verifying ballot counts and candidate vote totals remain perfectly identical or capturing differences if invalid ballots were flagged), updates the approval state to `pending`, and records an immutable audit event (`election.recount`).

## Goals, Non-Goals, and Anti-Goals
- **Goals:**
  - Implement the `RecountRequest` database entity in `election_db` as specified in Doc 02 §3.2.
  - Enable versioned tallies in `ElectionResult` with an incrementing `result_version` and composite uniqueness on `(election_id, result_version)`.
  - Provide `POST /api/v1/elections/{id}/recount` and `GET /api/v1/elections/{id}/recounts` endpoints with RBAC enforcement (`organization_admin`, `election_manager`, `auditor`).
  - Provide a modal (`RecountRequestModal`) following established Pollwise UI patterns (matching `CertifiedCertificateModal`, `VoterCSVImportModal`).
  - Render tally version badges and recount history in `ElectionDetailPage` and `ElectionResultsPage`.
- **Non-Goals:**
  - Altering stored ballots in `ballot_db` (ballots are strictly immutable and never modified or deleted).
  - Unmasking voter identities or correlating ballots with voters.
  - Changing the visual theme, layout framework, or primary navigation patterns.
- **Anti-Goals:**
  - Overwriting prior tally versions: Overwriting history destroys auditability and violates Doc 01 §12.4. Every recount must create a new immutable result version.
  - In-place mutation of approved/published results without formal recount tracking.

## Approaches Considered
1. **Approach 1: In-place Tally Re-calculation (Rejected)**
   - *Description:* Overwrite the existing `ElectionResult` row with updated counts and log an audit entry.
   - *Drawback:* Violates Doc 01 §12.4 and Doc 02 §3.2 which require versioned tally snapshots. Historical results cannot be audited or compared.
2. **Approach 2: Separate Dispute Ticket System (Rejected)**
   - *Description:* Treat disputes purely as support tickets detached from the election state machine.
   - *Drawback:* Adds unnecessary complexity without solving the programmatic re-tallying and tally version progression.
3. **Approach 3: Spec-Compliant Versioned Tally & RecountRequest Entity (Chosen)**
   - *Description:* Implement `RecountRequest` table linked to `election_results` and `elections`. Re-running the deterministic tally generates a new `ElectionResult` with `result_version = previous_version + 1`. Tally queries return the latest version by default while allowing history lookup.
   - *Why:* Exactly fulfills Doc 01 §12.4, Doc 02 §3.2, and Doc 03 §8.5, preserving full auditability and immutability.

## Architectural Changes & Specifications

### 1. Database Schema (`backend/app/models/election.py`)
Add `RecountRequest` model in `election_db`:
```python
class RecountStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    REJECTED = "rejected"

class RecountRequest(ElectionBase):
    __tablename__ = "recount_requests"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    election_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("elections.id", ondelete="CASCADE"), nullable=False, index=True)
    requester_user_id: Mapped[uuid.UUID] = mapped_column(GUID(), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    resulting_result_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("election_results.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    election: Mapped["Election"] = relationship("Election", back_populates="recount_requests")
    resulting_result: Mapped["ElectionResult | None"] = relationship("ElectionResult")
```
Update `Election` model:
- `recount_requests: Mapped[list["RecountRequest"]] = relationship("RecountRequest", back_populates="election", cascade="all, delete-orphan")`
Update `ElectionResult` model:
- Ensure `result_version` starts at 1 and increments.

### 2. Pydantic Schemas (`backend/app/schemas/results.py`)
- `RecountRequestCreate`: `{ reason: str }` (min_length=5, max_length=2000)
- `RecountRequestResponse`: `id`, `election_id`, `requester_user_id`, `reason`, `status`, `resulting_result_id`, `created_at`, `resolved_at`
- Update `ElectionResultResponse` to include `result_version: int` and `tally_algorithm_version: str`.

### 3. Service Layer (`backend/app/services/tally_service.py`)
- `recount_election(ballot_session, election_session, election_id, actor, reason: str) -> tuple[ElectionResult, RecountRequest]`
  - Validates election is in `tallied` or `published` status.
  - Re-reads immutable ballots from `ballot_db`.
  - Re-computes position totals, abstentions, and winners.
  - Determines next `result_version = max(existing_versions) + 1`.
  - Creates and commits `ElectionResult(result_version=next_version, approval_status="pending")`.
  - Creates and commits `RecountRequest(status="completed", resulting_result_id=new_result.id, resolved_at=now)`.
  - Creates `AuditEvent(event_type="election.recount", outcome="success", metadata_json=...)`.
  - Sets election status back to `tallied` if it was published or keeps `tallied`.
- `list_recounts(election_session, election_id) -> list[RecountRequest]`

### 4. API Endpoints (`backend/app/api/v1/results.py`)
- `POST /elections/{id}/recount` (triggers recount, returns `{ data: { result: ElectionResultResponse, recount: RecountRequestResponse }, error: None }`)
- `GET /elections/{id}/recounts` (returns `{ data: list[RecountRequestResponse], error: None }`)

### 5. Frontend Types & API Client (`frontend/src/types/results.ts`, `frontend/src/lib/api-client.ts`)
- Add `RecountRequest` interface.
- Add `apiClient.requestRecount(electionId: string, reason: string)`
- Add `apiClient.getRecounts(electionId: string)`
- Update `ElectionResult` to include `result_version?: number`.

### 6. Frontend UI (`frontend/src/components/reports/RecountRequestModal.tsx` & Pages)
- **RecountRequestModal:**
  - Styled with Pollwise Card/Dialog, warning badge, reason textarea, loading states, and cancellation.
- **ElectionDetailPage.tsx:**
  - In Results section/actions: render "Request Recount" button when election is in `tallied` or `published`.
  - Display current result version badge (e.g. `Version 2 (Recount)`) and historical recount log if recounts exist.
- **ElectionResultsPage.tsx:**
  - Display result version pill and banner if viewing a recounted tally.

# Emergency Controls & Live Election Monitoring Dashboard Specification

**Status:** Approved  
**Author:** Antigravity  
**Date:** 2026-11-06  
**Target:** Option B (Doc 01 §11.1, §11.2, §11.3; Doc 15 Phase 5)

---

## 1. Executive Summary

Pollwise requires robust operational controls and real-time oversight during active elections without compromising secret-ballot privacy or system immutability. This document specifies:
1. **Emergency Operational Controls:** Enabling authorized election administrators to temporarily pause an election during infrastructure issues or governance emergencies, re-enable voting upon resolution, or close/abort under emergency protocol with mandatory audited justification.
2. **Strict Gate Enforcement:** Immediate server-side halts on credential issuance, voter authentication, and ballot box submissions during paused state, coupled with graceful in-booth notices.
3. **Live Monitoring Dashboard:** Real-time operational oversight for Election Managers and Auditors featuring turnout velocity trends, infrastructure health status, and departmental participation breakdowns that enforce the **Doc 01 §11.2 Privacy Threshold** (suppressing subgroups < 10 voters to prevent deduction of individual voter choices) while strictly prohibiting interim candidate counts.

---

## 2. Requirements & Governance Rules

### 2.1 Emergency Controls (§11.3)
- **Pause Election:** Transitions state from `open` to `paused`. Halts ballot acceptance and voter verification immediately. Requires mandatory non-empty justification (`>= 5 characters`).
- **Resume Election:** Transitions state from `paused` back to `open`. Re-enables voting without modifying configuration or existing ballots.
- **Emergency Close:** Allows terminating a paused election directly to `closed` without requiring resumption.
- **Emergency Abort / Cancel:** Allows terminating a paused election to `canceled` with mandatory justification.
- **Audit Logging:** Every emergency action logs an immutable record into `audit_events` (`election.paused`, `election.resumed`, `election.closed`, `election.canceled`) capturing actor ID, timestamp, and justification metadata.
- **RBAC:** Restricted to `organization_admin` and `election_manager`. Unauthorized roles (including ordinary voters) receive `403 Forbidden`.

### 2.2 Live Monitoring & Privacy Invariants (§11.1 & §11.2)
- **Turnout Metrics:** Real-time count of eligible voters, total ballots cast, and aggregate participation percentage.
- **Turnout Velocity:** Time-bucketed participation rate over time (e.g. hourly trend) allowing administrators to detect surges or connectivity anomalies.
- **Departmental Turnout & Privacy Rule (§11.2):** Department/faculty turnout breakdown is supported, but groups with fewer than 10 eligible voters **must be suppressed or aggregated into "Other / Suppressed (< 10 voters)"** to prevent deduction of individual participation choices.
- **Zero Interim Counts Invariant (§11.2):** Candidate vote totals and preferences are **never** queried, computed, or transmitted while an election is `open` or `paused`.
- **Infrastructure Health:** Real-time indicators of ballot-box service responsiveness, credential issuance health, and election lifecycle status.

---

## 3. Data Model & Schema Changes

### 3.1 Election Model (`backend/app/models/election.py`)
- Add `ElectionStatus.PAUSED = "paused"`.
- Update `ElectionStatus.ALL_STATUSES` to include `PAUSED`.
- Add columns to `Election`:
  - `paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)`
  - `pause_reason: Mapped[str | None] = mapped_column(Text, nullable=True)`

### 3.2 Schemas (`backend/app/schemas/elections.py`)
- `PauseElectionRequest`:
  - `reason: str = Field(..., min_length=5, max_length=2000)` with whitespace stripping.
- `ResumeElectionRequest`:
  - `reason: str | None = Field(None, max_length=2000)`
- `TurnoutVelocityPoint`:
  - `timestamp: datetime`
  - `ballots_count: int`
  - `cumulative_ballots: int`
- `DepartmentTurnoutMetric`:
  - `department: str`
  - `eligible_count: int`
  - `voted_count: int`
  - `turnout_percentage: float`
  - `is_suppressed: bool = False`
- `InfrastructureHealth`:
  - `ballot_box_status: str` ("healthy" | "degraded")
  - `credential_service_status: str` ("healthy" | "degraded")
  - `database_status: str` ("healthy" | "degraded")
- `ElectionMonitoringResponse`:
  - `election_id: uuid.UUID`
  - `status: str`
  - `total_eligible: int`
  - `ballots_cast: int`
  - `turnout_percentage: float`
  - `paused_at: datetime | None`
  - `pause_reason: str | None`
  - `velocity: list[TurnoutVelocityPoint]`
  - `departmental_turnout: list[DepartmentTurnoutMetric]`
  - `health: InfrastructureHealth`

---

## 4. API Endpoints

1. `POST /api/v1/elections/{id}/pause`
   - Role: `organization_admin`, `election_manager`
   - Body: `{"reason": "Network outage reported at Central Library kiosk terminal"}`
   - Returns: `ElectionDetailResponse` with status `paused`, `paused_at`, `pause_reason`.
   - Error: `409 INVALID_STATE_TRANSITION` if not in `open` state.

2. `POST /api/v1/elections/{id}/resume`
   - Role: `organization_admin`, `election_manager`
   - Body: `{"reason": "Kiosk network restored"}` (optional)
   - Returns: `ElectionDetailResponse` with status `open`, `paused_at = None`, `pause_reason = None`.
   - Error: `409 INVALID_STATE_TRANSITION` if not in `paused` state.

3. `GET /api/v1/elections/{id}/monitoring`
   - Role: `organization_admin`, `election_manager`, `auditor`
   - Returns: `ElectionMonitoringResponse`.

---

## 5. Frontend Components & UI Design

1. **`EmergencyControlModal`** (`frontend/src/components/elections/EmergencyControlModal.tsx`):
   - Supports `"pause"`, `"resume"`, `"emergency_close"`, and `"emergency_cancel"` actions.
   - Requires explicit justification textarea (min 5 characters) for pause and cancellation.
   - Shows irreversible warning for emergency close / cancellation.
2. **`EmergencyStatusBanner`** (`frontend/src/components/elections/EmergencyStatusBanner.tsx`):
   - Displayed atop `ElectionDetailPage` when `election.status === "paused"`.
   - Styled with amber/red alert tones, warning shield icon, reason text, and action buttons (`Resume Election`, `Close Election`).
3. **`LiveMonitoringTab`** on `ElectionDetailPage.tsx`:
   - Turnout velocity chart using lightweight custom SVG cubic bezier curve matching `ElectionOverviewChart`.
   - Departmental turnout progress cards with explicit privacy note explaining threshold suppression (< 10 voters).
   - System health indicator badges (Ballot box online, token generator active).
   - Manual refresh and automated 15-second polling when tab is active.
4. **`VotingBoothPage` Handling:**
   - If election is paused when voter attempts to enter or vote, renders `ElectionPausedCard` informing voter to check back once resolved.

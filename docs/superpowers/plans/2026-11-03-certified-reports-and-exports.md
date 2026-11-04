# Certified Reports & Export Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a comprehensive Certified Reports & Export Suite (Spec 13) enabling election administrators and auditors to generate, view, print, and export official certified results (with approver signatures and SHA-256 configuration hashes), turnout analytics, complete audit trails, and election governance summaries in CSV, JSON, and printable certificate formats.

**Architecture:** 
- In `election_db`, define `ReportExport` table recording all report generations with requester, SHA-256 payload checksum, report type, and format.
- Backend implements `ReportService` producing deterministic CSV/JSON streams for: Certified Results, Voter Turnout, Audit Trail, and Election Governance Summary, while logging an immutable `AuditEvent`.
- REST API router `/api/v1/elections/{election_id}/reports` exposes generation, listing, and streaming export endpoints with RBAC verification (`organization_admin`, `election_manager`, `auditor`).
- Frontend provides `CertifiedCertificateModal` (high-contrast, printable official results certificate with seal, hash, and approver signature), `ElectionReportsModal` (unified report generation center with download history), and one-click quick export buttons in `ElectionDetailPage` (Results, Activity, and Participation tabs) and `ElectionResultsPage`.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (async), PostgreSQL, Pydantic v2, Python `csv` & `hashlib`, React 18, Vite, TanStack Query, TailwindCSS, Vitest, Pytest.

**Spec:** `docs/spec/01-functional-specification.md` (Section 13: Reports and Exports, Section 12: Tally and Results), `docs/spec/02-database-schema.md` (Section `report_exports`), and `docs/15-implementation-roadmap.md` (Phase 6 & 7).

## Global Constraints

- Certified results exports must strictly include the frozen SHA-256 configuration hash, tally algorithm version, approver name, and approval timestamp.
- Results exports for unpublished elections must be restricted to authorized roles (`organization_admin`, `election_manager`, `auditor`). Ordinary/unauthorized users cannot export interim results.
- Ballot-level data must NEVER be exported in any format that links voter identities to selections (Doc 13.2 & 14).
- Every export generation must be auditable: a `ReportExport` entry and a corresponding `AuditEvent` (`event_type="report.exported"`) must be recorded in `election_db`.
- All printable views (official certificate) must render cleanly on standard Letter/A4 paper via CSS `@media print` without admin navbars or control artifacts.

## Review Focus

1. **Unpublished Results Gate:** Attempting to export results before publication by an unauthorized caller is rejected with HTTP 403.
2. **Deterministic Checksum Integrity:** Each generated export computes and stores a SHA-256 checksum over the exported content for non-repudiation.
3. **Approver Attribution:** Certified results reports explicitly show whether the tally was approved, who approved it, and when; if unapproved, it is prominently marked as `UNAUDITED DRAFT`.
4. **Voter Privacy in Turnout & Audit:** Turnout and audit exports must never contain secret ballot selections or raw auth credentials.
5. **Print Layout Robustness:** The printable certificate modal must correctly isolate printable content and hide modals/buttons during `window.print()`.

---

### Task 1: Database Model & Schema for Report Exports

**Files:**
- Modify: `backend/app/models/election.py`
- Modify: `backend/app/db/session.py`
- Test: `backend/tests/test_reports_api.py`

**Interfaces:**
- Consumes: `ElectionBase`, `GUID`, `TimestampMixin` from `app.db.base` and `app.models.identity`
- Produces: `ReportExport` model in `app.models.election`

- [ ] **Step 1.1: Define `ReportExport` model in `backend/app/models/election.py`**
  Add attributes:
  - `id`: GUID, primary key, default `uuid.uuid4`
  - `election_id`: GUID, foreign key `elections.id` ondelete `CASCADE`, nullable=False, indexed
  - `report_type`: String(50), nullable=False (`"certified_results"`, `"turnout"`, `"summary"`, `"audit_trail"`)
  - `file_format`: String(10), nullable=False (`"csv"`, `"json"`, `"pdf"`)
  - `file_name`: String(255), nullable=False
  - `checksum`: String(64), nullable=True
  - `generated_by`: GUID, nullable=False
  - `created_at`: DateTime(timezone=True), default UTC, nullable=False
  - Relationship to `Election`

- [ ] **Step 1.2: Register `ReportExport` in `backend/app/models/__init__.py` (if applicable) and verify `ElectionBase.metadata.create_all` includes `report_exports`**

- [ ] **Step 1.3: Run `backend\.venv\Scripts\pytest backend\tests\test_elections.py` to ensure schema definitions load cleanly without regressions**

---

### Task 2: Pydantic Schemas & Report Generation Service

**Files:**
- Create: `backend/app/schemas/reports.py`
- Create: `backend/app/services/report_service.py`
- Test: `backend/tests/test_reports_api.py`

**Interfaces:**
- Consumes: `Election`, `ElectionResult`, `ElectionApproval`, `AuditEvent`, `ReportExport`
- Produces: `ReportService.generate_report`, `ReportService.list_reports`

- [ ] **Step 2.1: Create Pydantic schemas in `backend/app/schemas/reports.py`**
  - `GenerateReportRequest`:
    - `report_type`: str (`"certified_results"` | `"turnout"` | `"summary"` | `"audit_trail"`)
    - `file_format`: str (`"csv"` | `"json"`)
  - `ReportExportItem`:
    - `id`: UUID, `election_id`: UUID, `report_type`: str, `file_format`: str, `file_name`: str, `checksum`: str | None, `generated_by`: UUID, `created_at`: datetime
  - `ReportExportListResponse`:
    - `items`: list[ReportExportItem], `total_count`: int

- [ ] **Step 2.2: Implement `ReportService` in `backend/app/services/report_service.py`**
  - `generate_certified_results_csv(election, result, approvals)`:
    - Generates standardized CSV: metadata header with election title, election ID, frozen configuration hash, tally algorithm version, approval status, approver ID/name, approval timestamp, followed by candidate tables (Position, Candidate Name, Candidate ID, Votes, Percentage, Winner Flag, Abstentions).
  - `generate_turnout_csv(election, total_eligible, total_ballots, participation_records)`:
    - Generates CSV: Election Title, Total Eligible Voters, Total Ballots Cast, Turnout Percentage, Method/Source breakdown.
  - `generate_audit_trail_csv(audit_events)`:
    - Generates CSV: Event ID, Timestamp (ISO UTC), Event Type, Outcome, Actor ID, Metadata Details.
  - `generate_summary_csv(election, positions)`:
    - Generates CSV: Election basic information, schedule timestamps, positions, max/min selections, active candidate rosters.
  - `create_and_log_report(election_session, election_id, report_type, file_format, content_str, actor)`:
    - Computes SHA-256 checksum of `content_str`.
    - Inserts `ReportExport` record.
    - Emits `AuditEvent(event_type="report.exported", outcome="success", metadata_json=...)`.
    - Commits transaction and returns `(ReportExport, content_bytes)`.
  - `list_reports(election_session, election_id)`:
    - Returns list of `ReportExport` records ordered by `created_at desc`.

---

### Task 3: Backend API Router & Comprehensive Pytest Suite

**Files:**
- Create: `backend/app/api/v1/reports.py`
- Modify: `backend/app/api/v1/router.py`
- Create: `backend/tests/test_reports_api.py`

**Interfaces:**
- Consumes: `ReportService`, `get_election_session`, `get_identity_session`, `get_current_user`, `verify_user_organization_role`
- Produces: REST endpoints `/api/v1/elections/{election_id}/reports/...`

- [ ] **Step 3.1: Create endpoints in `backend/app/api/v1/reports.py`**
  - `POST /api/v1/elections/{election_id}/reports/generate`:
    - Validates organization role (`organization_admin`, `election_manager`, `auditor`).
    - If `certified_results` requested and election is not published, verifies unapproved results view permissions.
    - Calls `ReportService.create_and_log_report`.
    - Returns JSON metadata with report ID, download URL, and checksum.
  - `GET /api/v1/elections/{election_id}/reports`:
    - Returns list of past report exports.
  - `GET /api/v1/elections/{election_id}/reports/export`:
    - Query params: `report_type: str`, `format: str = "csv"`.
    - Generates and immediately streams the file with appropriate `Content-Disposition` header (`attachment; filename=...`) and media type (`text/csv` or `application/json`).
  - `GET /api/v1/elections/{election_id}/results/export`:
    - Quick shortcut to download certified results in CSV or JSON.

- [ ] **Step 3.2: Register reports router in `backend/app/api/v1/router.py`**

- [ ] **Step 3.3: Write comprehensive tests in `backend/tests/test_reports_api.py`**
  - Test 1: Generate certified results CSV for a tallied/approved election -> verifies headers, winner flag, and hash.
  - Test 2: Generate turnout CSV -> verifies accurate ballot totals and percentage.
  - Test 3: Generate audit trail CSV -> verifies audit event lines and absence of private secrets.
  - Test 4: Attempting to export unpublished results as an unprivileged user fails with 403.
  - Test 5: Verify `ReportExport` record and `report.exported` audit event are persisted.
  - Test 6: Direct export endpoint streams CSV with valid Content-Disposition.

- [ ] **Step 3.4: Run `backend\.venv\Scripts\pytest backend\tests\test_reports_api.py -v` to verify all backend report tests pass**

---

### Task 4: Frontend Types & API Client Integration

**Files:**
- Create: `frontend/src/types/reports.ts`
- Modify: `frontend/src/lib/api-client.ts`

**Interfaces:**
- Consumes: Backend API contracts
- Produces: TypeScript types and `apiClient` methods for report generation and downloads

- [ ] **Step 4.1: Define TypeScript interfaces in `frontend/src/types/reports.ts`**
  - `ReportType`: `'certified_results' | 'turnout' | 'summary' | 'audit_trail'`
  - `ReportFormat`: `'csv' | 'json'`
  - `ReportExportItem`: `{ id: string; election_id: string; report_type: ReportType; file_format: ReportFormat; file_name: string; checksum?: string; generated_by: string; created_at: string; }`
  - `ReportExportListResponse`: `{ items: ReportExportItem[]; total_count: number }`

- [ ] **Step 4.2: Add methods to `apiClient` in `frontend/src/lib/api-client.ts`**
  - `generateReport(electionId: string, payload: { report_type: string; file_format: string }): Promise<ReportExportItem>`
  - `getReportExports(electionId: string): Promise<ReportExportListResponse>`
  - `exportReportDownload(electionId: string, reportType: string, format: string): Promise<Blob>`
  - `exportCertifiedResults(electionId: string, format?: string): Promise<Blob>`

---

### Task 5: Official Printable Certificate & Report Export Modals

**Files:**
- Create: `frontend/src/components/reports/CertifiedCertificateModal.tsx`
- Create: `frontend/src/components/reports/ElectionReportsModal.tsx`

**Interfaces:**
- Consumes: `Election`, `ElectionResultResponse`, `apiClient`
- Produces: Reusable UI modals for official certified printing and multi-format report exports

- [ ] **Step 5.1: Build `CertifiedCertificateModal.tsx`**
  - Clean institutional certificate layout with Pollwise seal / watermark badge.
  - Certified Election Title, Institution name, and Official Declaration.
  - Complete Winners Table (Position, Winner Name, Vote Total, Percentage of Votes).
  - Cryptographic Verification Block:
    - Canonical Ballot SHA-256 Configuration Hash.
    - Deterministic Tally Algorithm Version (`1.0`).
    - Total Certified Ballots Cast.
  - Official Sign-off & Audit Seal:
    - Approver Actor / Role.
    - Timestamp of Certification.
    - "VERIFIED & AUDITED" badge.
  - Print button firing `window.print()` with `@media print` styles hiding background, buttons, and close controls.

- [ ] **Step 5.2: Build `ElectionReportsModal.tsx`**
  - Card-based selector for all 4 official report types:
    1. **Official Certified Results** (CSV, JSON, Printable Certificate)
    2. **Participation & Turnout Analysis** (CSV, JSON)
    3. **Tamper-Evident Audit Trail** (CSV, JSON)
    4. **Election Governance Specification** (CSV, JSON)
  - One-click direct browser download trigger with automatic filename generation (e.g., `pollwise-certified-results-<election-id>.csv`).
  - Table of past exports showing timestamp, report type, format, and instant re-download.

---

### Task 6: UI Integration into Election Detail & Results Pages

**Files:**
- Modify: `frontend/src/pages/ElectionDetailPage.tsx`
- Modify: `frontend/src/pages/ElectionResultsPage.tsx`

**Interfaces:**
- Consumes: `CertifiedCertificateModal`, `ElectionReportsModal`, `apiClient`

- [ ] **Step 6.1: Integrate Report Actions into `ElectionDetailPage.tsx`**
  - In Header action bar: Add "Export Reports" button opening `ElectionReportsModal`.
  - In Tab 9 (Results): Add "Official Certificate" (opens `CertifiedCertificateModal`) and "Export CSV" buttons next to "View Public Results Page".
  - In Tab 8 (Activity): Add "Export Audit Trail (CSV)" button with direct download.
  - In Tab 5 (Participation): Add "Export Turnout Data (CSV)" button with direct download.

- [ ] **Step 6.2: Integrate Report Actions into `ElectionResultsPage.tsx`**
  - Add "Export Certified CSV" and "Print Official Certificate" buttons in the results header.
  - Both buttons available to public / authorized voters once results are published.

---

### Task 7: Frontend Vitest Suite & Verification

**Files:**
- Create: `frontend/src/test/reports-export.test.tsx`

- [ ] **Step 7.1: Write component and flow tests in `frontend/src/test/reports-export.test.tsx`**
  - Test 1: `CertifiedCertificateModal` renders certified winners, SHA-256 hash, and approver signature.
  - Test 2: `CertifiedCertificateModal` triggers `window.print` on print button click.
  - Test 3: `ElectionReportsModal` renders all 4 report cards, handles format selection, and calls `apiClient.exportReportDownload`.
  - Test 4: `ElectionDetailPage` results tab displays certificate and export buttons when election is tallied/published.
  - Test 5: `ElectionResultsPage` triggers certified CSV download and opens certificate modal.

- [ ] **Step 7.2: Run `npm --prefix frontend test -- --run` to ensure all 18+ frontend test suites pass**

---

### Task 8: Full End-to-End Live Verification

**Files:**
- Live verification on running services (`FastAPI` + `PostgreSQL` + `Vite`)

- [ ] **Step 8.1: Run all backend tests: `backend\.venv\Scripts\pytest`**
- [ ] **Step 8.2: Run all frontend tests: `npm --prefix frontend test -- --run`**
- [ ] **Step 8.3: Perform live end-to-end verification:**
  - Open an election with tallied/published results.
  - Click "Official Certificate" -> verify print preview layout with seal, hash, and winners.
  - Click "Export CSV" -> verify downloaded CSV contains exact vote counts, percentages, and config hash.
  - Download Audit Trail CSV -> verify event records are formatted cleanly.
  - Check `ReportExport` table and verify generation was audited.

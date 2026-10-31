# System Specification and Seed Data Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the complete, authoritative Pollwise specification suite in `docs/spec/` (covering functional specs, database schema, API contracts, frontend architecture, and security architecture) and cleanly purge all seeded data and demo scripts from the platform.

**Architecture:** A dedicated specification suite under `docs/spec/` decouples future development from fragmented legacy drafts. PostgreSQL application tables across three isolated databases (`identity_db`, `election_db`, and `ballot_db`) are purged via atomic truncations while preserving Alembic migration metadata, establishing an empty, migration-ready database state.

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy 2.0, PostgreSQL 17, React 19, TypeScript, shadcn/ui, Tailwind CSS, Alembic, Docker.

**Spec:** [docs/superpowers/specs/2026-10-31-system-specification-and-seed-cleanup-design.md](file:///c:/Projects/PollWise/docs/superpowers/specs/2026-10-31-system-specification-and-seed-cleanup-design.md)

## Global Constraints
- Database isolation: Strictly three distinct databases (`identity_db`, `election_db`, `ballot_db`) with separate credentials; cross-database foreign keys and joins are strictly prohibited.
- Ballot secrecy invariant: Ballot records must never contain voter identity, emails, user IDs, IP addresses, or device fingerprints.
- Role-Based Access Control: Canonical 7-role hierarchy (`Platform Super Admin`, `Institution Owner`, `Institution Admin`, `Election Manager`, `Candidate`, `Voter`, `Auditor / Observer`).
- Schema integrity: `alembic_version` tables must remain intact across all three databases during data purge.
- Zero-drift documentation: Markdown files in `docs/spec/` must use standard GitHub Flavored Markdown with precise type signatures, schemas, and endpoints.

## Review Focus
- Database migration history loss: Purge commands must preserve `alembic_version` so `alembic upgrade head` remains functional.
- Lingering demo credentials: No demo emails (`admin@pollwise.local`, `manager@polytechnic.edu`, `alice@polytechnic.edu`, etc.) or demo orgs (`northwestern-poly`) remain in any database.
- Missing role mapping in API/UI: Every endpoint and route must have explicit RBAC definitions for all 7 roles.
- Ballot-box boundary violations: Specifications must forbid session cookies and identity headers on `/ballot-box/v1/*` endpoints.
- Documentation link brokenness: `docs/README.md` must accurately index the new specification suite.

---

### Task 1: Seed Data Purge and Demo Script Removal

**Files:**
- Modify: `README.md:54,126-150`
- Delete: `backend/app/commands/seed.py`
- Test: Docker execution of SQL verification queries across `identity_db`, `election_db`, and `ballot_db`

**Interfaces:**
- Consumes: Running PostgreSQL container `pollwise-postgres` on port 5433
- Produces: Pristine empty database state with 0 application records and intact `alembic_version`

- [ ] **Step 1: Write database purge SQL script and execute clean truncation**

Execute SQL script against `identity_db`, `election_db`, and `ballot_db` via `docker exec -i pollwise-postgres psql -U postgres`:
```sql
-- identity_db
\c identity_db
TRUNCATE TABLE election_eligibility, voting_credentials, organization_memberships, email_verification_tokens, password_reset_tokens, user_sessions, organizations, users CASCADE;

-- election_db
\c election_db
TRUNCATE TABLE election_results, election_approvals, candidates, positions, audit_events, elections CASCADE;

-- ballot_db
\c ballot_db
TRUNCATE TABLE ballot_choices, ballot_credential_redemptions, ballots CASCADE;
```

- [ ] **Step 2: Verify zero row count in all application tables while preserving alembic_version**

Run verification queries:
```powershell
docker exec -i pollwise-postgres psql -U postgres -d identity_db -c "SELECT count(*) FROM users; SELECT count(*) FROM organizations; SELECT version_num FROM alembic_version;"
docker exec -i pollwise-postgres psql -U postgres -d election_db -c "SELECT count(*) FROM elections; SELECT count(*) FROM candidates; SELECT version_num FROM alembic_version;"
docker exec -i pollwise-postgres psql -U postgres -d ballot_db -c "SELECT count(*) FROM ballots; SELECT count(*) FROM ballot_credential_redemptions; SELECT version_num FROM alembic_version;"
```
Expected: `count = 0` for all data tables, and `version_num = f6805a57ae2e` intact.

- [ ] **Step 3: Delete seed.py and its compiled artifacts**

Remove `backend/app/commands/seed.py` and any `__pycache__/*seed*` files. Ensure `backend/app/commands/create_admin.py` is preserved.

- [ ] **Step 4: Update README.md to remove references to seed.py**

Edit `README.md` to reference `create_admin.py` instead of `seed.py` for initializing clean administrative access.

- [ ] **Step 5: Run backend tests to verify clean database compatibility**

Run: `pytest backend/tests -v`
Expected: All backend tests pass.

- [ ] **Step 6: Commit seed cleanup**

```bash
git add backend/app/commands/ README.md
git commit -m "chore: purge seeded database records and remove seed command"
```

---

### Task 2: Authoritative Functional Specification (`docs/spec/01-functional-specification.md`)

**Files:**
- Create: `docs/spec/01-functional-specification.md`

**Interfaces:**
- Consumes: User's definitive 24-section specification text
- Produces: Master functional specification reference for all downstream implementation tasks

- [ ] **Step 1: Create directory `docs/spec` if not present**

Run: `New-Item -ItemType Directory -Force -Path docs/spec`

- [ ] **Step 2: Write complete 24-section functional specification to `docs/spec/01-functional-specification.md`**

Incorporate all 24 numbered sections with full functional workflows:
1. System Roles and Access (7 roles, separation of duties)
2. Public Website (Landing page, public election view)
3. Authentication and Account Management (Registration, login, MFA, password reset, account states)
4. Institution Onboarding (Institution creation, setup wizard, institution settings)
5. Institution Admin Dashboard (KPIs, charts, activity feed, quick actions)
6. Elections (Election list, 8-step wizard, lifecycle states)
7. Positions (Position list, seat rules, display order)
8. Candidates (Candidate management, review flow, candidate portal)
9. Voters and Eligibility (Directory, CSV import, eligibility rules, activation)
10. Voter Dashboard (My elections, voting booth flow, ballot submission states, privacy guarantees)
11. Election Monitoring (Live monitoring aggregate metrics, emergency controls)
12. Tally, Review, and Results (Deterministic tallying, review, multi-role approval, recounts, publication)
13. Reports and Exports (Report types, export formats, privacy invariants)
14. Audit Logs (Tracked events, schema, redaction invariants)
15. Team and Permissions (Team management, granular capabilities)
16. Notifications (Notification types, channels, notification center)
17. Platform Super Admin (Platform dashboard, institution verification, system settings)
18. Overall System Flow (End-to-end workflow diagram)
19. How the Sections Work Together (Dependency matrix)
20. Implementation Phases & Milestones
21. Security and Privacy Requirements (Cryptographic protocols, blind tokens, database boundaries)
22. Core Data Model (24 entities, privacy decoupling)
23. Definition of Done (Quality & security verification gates)
24. Operational Boundaries & Non-Functional Requirements (Performance, disaster recovery, data retention)

- [ ] **Step 3: Verify document completeness and format**

Inspect line count and headings to ensure all 24 sections and sub-clauses are represented without truncation.

- [ ] **Step 4: Commit functional specification**

```bash
git add docs/spec/01-functional-specification.md
git commit -m "docs: add authoritative 24-section functional specification"
```

---

### Task 3: Database Schema Specification (`docs/spec/02-database-schema.md`)

**Files:**
- Create: `docs/spec/02-database-schema.md`

**Interfaces:**
- Consumes: Functional specification data entities and PostgreSQL 17 multi-DB architecture
- Produces: Detailed relational database schema specification for `identity_db`, `election_db`, and `ballot_db`

- [ ] **Step 1: Write comprehensive schema specification to `docs/spec/02-database-schema.md`**

Cover all 24 entities across the three isolated databases:
- **`identity_db`**:
  - `users`: UUID PK, `email_normalized` (unique), `password_hash`, `display_name`, `email_verified_at`, `account_status`, `is_platform_admin`, timestamps
  - `user_sessions`: UUID PK, `user_id` FK, `session_token_hash`, `expires_at`, `idle_expires_at`, `ip_address`, `user_agent`, timestamps
  - `email_verification_tokens`: UUID PK, `user_id` FK, `token_hash`, `expires_at`, `used_at`, timestamps
  - `password_reset_tokens`: UUID PK, `user_id` FK, `token_hash`, `expires_at`, `used_at`, timestamps
  - `organizations`: UUID PK, `name`, `slug` (unique), `institution_type`, `country`, `official_domain`, `status`, metadata JSONB, timestamps
  - `organization_memberships`: UUID PK, `organization_id` FK, `user_id` FK, `role` (enum), `status`, permissions JSONB, timestamps
  - `voter_groups`: UUID PK, `organization_id` FK, `name`, `code`, `description`, timestamps
  - `voter_group_members`: UUID PK, `voter_group_id` FK, `user_id` FK, `member_identifier`, timestamps
  - `election_eligibility`: UUID PK, `election_id` (UUID reference without cross-DB FK), `user_id` FK, `eligibility_status`, `entitlement_status`, timestamps
  - `voting_credentials`: UUID PK, `election_id`, `user_id` FK, `blind_token_hash`, `issued_at`, `status`
  - `audit_events`: UUID PK, `actor_id`, `organization_id`, `event_type`, `payload` JSONB, `created_at`
- **`election_db`**:
  - `elections`: UUID PK, `organization_id`, `title`, `description`, `status` (Draft, Scheduled, Open, Closed, Tallied, Approved, Published, Archived, Cancelled), `opens_at`, `closes_at`, `timezone`, `voting_method`, `configuration_version`, `configuration_hash`, timestamps
  - `election_managers`: UUID PK, `election_id` FK, `user_id` (reference), `role_type`, timestamps
  - `positions`: UUID PK, `election_id` FK, `title`, `description`, `min_selections`, `max_selections`, `display_order`, timestamps
  - `candidates`: UUID PK, `position_id` FK, `name`, `biography`, `manifesto_url`, `photo_url`, `display_order`, `status`, timestamps
  - `candidate_applications`: UUID PK, `position_id` FK, `user_id` (reference), `statement`, `supporting_docs` JSONB, `review_status`, `reviewed_by`, timestamps
  - `eligibility_rules`: UUID PK, `election_id` FK, `rule_type`, `rule_config` JSONB, timestamps
  - `election_approvals`: UUID PK, `election_id` FK, `approval_type` (launch, tally, publication), `approver_user_id`, `decision`, `notes`, timestamps
  - `election_results`: UUID PK, `election_id` FK, `result_version`, `configuration_hash`, `tally_algorithm_version`, `ballot_count`, `result_data` JSONB, `approval_status`, timestamps
  - `recount_requests`: UUID PK, `election_id` FK, `requester_user_id`, `reason`, `status`, `recount_result_id`, timestamps
  - `report_exports`: UUID PK, `election_id` FK, `report_type`, `file_format`, `file_url`, `generated_by`, timestamps
  - `audit_events`: UUID PK, `election_id` FK, `actor_id`, `action`, `outcome`, `metadata` JSONB, `created_at`
- **`ballot_db`**:
  - `ballots`: UUID PK, `election_id` (UUID index), `configuration_hash`, `ballot_payload` JSONB, `accepted_at`, `integrity_metadata` JSONB (strictly no voter identifier)
  - `ballot_choices`: UUID PK, `ballot_id` FK, `position_id`, `candidate_id` (or null if abstain)
  - `ballot_credential_redemptions`: UUID PK, `election_id`, `credential_hash` (unique), `redeemed_at`, `status`
- Indexing strategies, migration rules, and constraints for each table.

- [ ] **Step 2: Review database schema against ballot secrecy and multi-DB invariants**

Verify that `ballot_db` contains zero foreign keys or references to `identity_db.users`.

- [ ] **Step 3: Commit database schema specification**

```bash
git add docs/spec/02-database-schema.md
git commit -m "docs: add comprehensive multi-database schema specification"
```

---

### Task 4: API Contracts Specification (`docs/spec/03-api-contracts.md`)

**Files:**
- Create: `docs/spec/03-api-contracts.md`

**Interfaces:**
- Consumes: Functional specification and database schema
- Produces: Complete REST API contract reference for backend and frontend developers

- [ ] **Step 1: Write API contracts specification to `docs/spec/03-api-contracts.md`**

Document all endpoints under `/api/v1` and `/ballot-box/v1`:
- Conventions: JSON bodies, UUID identifiers, ISO 8601 UTC timestamps, RFC 7807 problem details error format, pagination (`page`, `page_size`, `total_pages`).
- **Auth endpoints (`/api/v1/auth`)**:
  - `POST /register`, `POST /login`, `POST /logout`, `GET /me`, `POST /verify-email`, `POST /forgot-password`, `POST /reset-password`, `POST /mfa/setup`, `POST /mfa/verify`
- **Institution endpoints (`/api/v1/organizations`)**:
  - `GET /`, `POST /`, `GET /{id}`, `PATCH /{id}`, `GET /{id}/members`, `POST /{id}/members/invite`, `POST /{id}/members/import-csv`
- **Election endpoints (`/api/v1/elections`)**:
  - `GET /`, `POST /`, `GET /{id}`, `PATCH /{id}`, `POST /{id}/schedule`, `POST /{id}/open`, `POST /{id}/pause`, `POST /{id}/resume`, `POST /{id}/close`, `POST /{id}/cancel`
- **Position & Candidate endpoints**:
  - `GET /elections/{id}/positions`, `POST /elections/{id}/positions`, `PATCH /positions/{id}`, `DELETE /positions/{id}`
  - `GET /positions/{id}/candidates`, `POST /positions/{id}/candidates`, `POST /positions/{id}/apply`, `PATCH /candidates/{id}/review`
- **Voter & Voting Booth endpoints**:
  - `GET /voter/elections`, `GET /voter/elections/{id}/ballot-spec`
  - `POST /elections/{id}/voting-credential` (Issues blind redemption token to verified eligible voter)
  - `POST /ballot-box/v1/ballots` (Secret ballot acceptance via bearer credential token; rejects identity cookies)
  - `GET /voter/elections/{id}/participation-status`
- **Tally & Results endpoints**:
  - `POST /elections/{id}/tally`, `GET /elections/{id}/results`, `POST /elections/{id}/results/approve`, `POST /elections/{id}/results/publish`, `POST /elections/{id}/recount`
- **Governance & Admin endpoints**:
  - `GET /audit-events`, `POST /reports/export`, `GET /platform/institutions`, `PATCH /platform/institutions/{id}/verification`
- RBAC Permission Matrix mapping all endpoints against the 7 roles.

- [ ] **Step 2: Verify request/response schemas and error handling**

Ensure error codes match application errors (`ALREADY_VOTED`, `BALLOT_ALREADY_ACCEPTED`, `IDENTITY_FIELD_REJECTED`, `ELECTION_NOT_OPEN`, etc.).

- [ ] **Step 3: Commit API contracts specification**

```bash
git add docs/spec/03-api-contracts.md
git commit -m "docs: add complete REST API contracts specification"
```

---

### Task 5: Frontend Routes & Components Specification (`docs/spec/04-frontend-routes-components.md`)

**Files:**
- Create: `docs/spec/04-frontend-routes-components.md`

**Interfaces:**
- Consumes: Functional specification and API contracts
- Produces: Frontend architecture, route tree, view designs, component hierarchy, and UX flows

- [ ] **Step 1: Write frontend routes and components specification to `docs/spec/04-frontend-routes-components.md`**

Cover:
- **Routing structure (React Router 7 / standard SPA)**:
  - Public routes: `/`, `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/elections/public/:id`
  - Institution Admin routes: `/dashboard`, `/elections`, `/elections/create` (8 steps), `/elections/:id/manage`, `/voters`, `/candidates`, `/team`, `/settings`, `/reports`
  - Voter routes: `/voter/elections`, `/vote/:id`, `/vote/:id/review`, `/vote/:id/confirmation`
  - Platform Super Admin routes: `/platform/dashboard`, `/platform/institutions`, `/platform/settings`
- **Layouts & Shell**: `AppShell` with responsive navigation, header, sidebar for admin portal, mobile hamburger navigation, breadcrumbs.
- **Component breakdown (shadcn/ui + Tailwind CSS)**:
  - Primitives: `Button`, `Card`, `Badge`, `StatusBadge`, `Dialog`, `Table`, `Tabs`, `Form`, `Input`, `Select`, `Alert`, `Skeleton`.
  - Feature components: `ElectionCard`, `WizardStepTracker`, `CandidateProfileModal`, `VoterImportDropzone`, `BallotPositionCard`, `LiveMetricsWidget`, `TallyAuditTable`.
- **Client state management**: `AuthContext` (session status, active user, role), TanStack Query hooks (`useElection`, `useVoterElections`, `useTallyResults`), and form handling (React Hook Form + Zod).
- **Interactive UX workflows**: Detailed step-by-step UI state transitions for Voter Voting Booth, 8-Step Election Creation Wizard, and Tally Review & Approval modal.

- [ ] **Step 2: Verify route guard logic across all 7 roles**

Confirm unauthorized attempts redirect cleanly with access denial notifications.

- [ ] **Step 3: Commit frontend specification**

```bash
git add docs/spec/04-frontend-routes-components.md
git commit -m "docs: add frontend routes and components specification"
```

---

### Task 6: Security Architecture Specification (`docs/spec/05-security-architecture.md`)

**Files:**
- Create: `docs/spec/05-security-architecture.md`

**Interfaces:**
- Consumes: System functional specification and threat model
- Produces: Definitive security, privacy, and assurance architecture document

- [ ] **Step 1: Write security architecture specification to `docs/spec/05-security-architecture.md`**

Detail:
- **Ballot Secrecy & Isolated Ballot-Box Protocol**:
  - Two-stage voting flow: (1) Identity verification and single-use credential token issuance; (2) Detached, cookie-free anonymous ballot submission.
  - Verification that timing attacks and correlational metadata (e.g. timestamp clustering) are mitigated via jittered buffering and shuffle mechanisms.
- **Multi-Database Security Boundaries**:
  - Separate PostgreSQL connections and least-privilege credentials (`identity_user`, `election_user`, `ballot_user`, `tally_ro_user`).
  - Strict prohibition of cross-database transactions or joins.
- **Session Management & Authentication**:
  - Argon2id password hashing, HTTP-only secure session cookies, idle timeout (60 min), absolute timeout (12 hours), one-click global session revocation.
- **Comprehensive RBAC Matrix**:
  - Tabular matrix mapping all 7 roles against every system capability.
- **Audit Logging Invariants**:
  - Tamper-evident append-only event logs, actor and IP capture for administrative actions, strict redaction of sensitive credentials and ballot choices.
- **Threat Model Mitigations**:
  - Defenses against ballot stuffing, coercion, credential replay, administrator tampering, and unauthorized early result disclosure.

- [ ] **Step 2: Verify security guarantees against core principles**

Confirm that no administrative privilege can expose an individual voter's selections.

- [ ] **Step 3: Commit security architecture specification**

```bash
git add docs/spec/05-security-architecture.md
git commit -m "docs: add comprehensive security and ballot privacy architecture"
```

---

### Task 7: Documentation Index Modernization and System Verification

**Files:**
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: All created specifications in `docs/spec/`
- Produces: Updated repository documentation index and verified workspace

- [ ] **Step 1: Update `docs/README.md`**

Restructure `docs/README.md` to establish `docs/spec/` as the primary, definitive specification suite:
- Feature links to:
  1. `01-functional-specification.md` (Master Functional Specification)
  2. `02-database-schema.md` (Multi-Database Relational Schema)
  3. `03-api-contracts.md` (REST API & Ballot-Box Contracts)
  4. `04-frontend-routes-components.md` (Frontend Architecture & Routes)
  5. `05-security-architecture.md` (Security & Ballot Privacy Architecture)
- Demarcate legacy numbered files (`01`–`27`) as historical reference documents superseded by `docs/spec/`.

- [ ] **Step 2: Run verification across backend and frontend**

Run tests:
```powershell
pytest backend/tests
npm --prefix frontend test -- --run
```
Expected: All backend and frontend unit/integration tests pass with 0 failures.

- [ ] **Step 3: Commit documentation index modernization**

```bash
git add docs/README.md
git commit -m "docs: modernize documentation index to reference definitive specification suite"
```

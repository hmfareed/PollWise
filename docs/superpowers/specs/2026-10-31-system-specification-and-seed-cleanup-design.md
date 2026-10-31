# System Specification and Seed Data Cleanup — Design Document

## 1. Intent and Why
Pollwise is an institutional election management platform designed for universities, student bodies, organizations, and other eligible institutions. Its core principles are voter eligibility, ballot secrecy, election integrity, accessibility, auditability, and controlled result publication.

The current workspace contains prototype implementations, older fragmented specifications (27+ individual markdown files in `docs/`), and seeded demo data in PostgreSQL across three isolated databases (`identity_db`, `election_db`, and `ballot_db`). To prepare Pollwise for production-grade engineering and align all architectural layers with the definitive 24-section functional specification, we must:
1. Establish a dedicated, unified implementation specification suite under `docs/spec/`.
2. Purge all seeded/mock data from the databases to establish a clean operational baseline.
3. Remove seed scripts from the repository.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Authoritative Functional Specification:** Save the complete 24-section system functional and workflow documentation provided in the prompt directly to `docs/spec/01-functional-specification.md`.
- **Comprehensive Database Schema Specification:** Create `docs/spec/02-database-schema.md` detailing the 3 isolated databases (`identity_db`, `election_db`, `ballot_db`), all 24 entities, fields, constraints, foreign keys, indexes, and privacy invariants.
- **Complete API Contracts Specification:** Create `docs/spec/03-api-contracts.md` defining all REST endpoints, request/response models, query parameters, error responses (RFC 7807 compatible), and role-based access control (RBAC).
- **Frontend Architecture Specification:** Create `docs/spec/04-frontend-routes-components.md` detailing the React + TypeScript + shadcn/ui route hierarchy, layouts, component tree, client state management, and role-guarded user journeys.
- **Security & Privacy Architecture:** Create `docs/spec/05-security-architecture.md` detailing the blind-token / isolated ballot-box privacy architecture, least-privilege DB roles, audit logging boundaries, session security, and threat mitigations.
- **Docs Index Modernization:** Update `docs/README.md` to designate `docs/spec/` as the primary authoritative specification suite.
- **Complete Seed Data Purge:** Cleanly truncate all application data in `identity_db`, `election_db`, and `ballot_db` while preserving the `alembic_version` schema migration tables.
- **Seed Script Removal:** Remove `backend/app/commands/seed.py` and its compiled cache to eliminate hardcoded seed accounts and demo organizations.

### Non-Goals
- Refactoring backend FastAPI routes or React frontend UI components during this specification phase (implementation of missing features or schema adjustments will be handled systematically in subsequent development phases based on these specifications).
- Dropping database tables or recreating the database containers from scratch (preserving Alembic migration state ensures schema stability).

### Anti-Goals
- Leaving residual demo users (`admin@pollwise.local`, `manager@polytechnic.edu`, `alice@polytechnic.edu`, etc.) or demo elections in any database.
- Breaking database migrations by deleting `alembic_version` records.
- Permitting direct foreign keys or linkages between voter identity records and ballot choices.

---

## 3. Constraints
- **Three-Database Isolation:** The architecture strictly isolates `identity_db`, `election_db`, and `ballot_db` using distinct credentials (`identity_user`, `election_user`, `ballot_user`, and `tally_ro_user`). No cross-database joins are allowed.
- **Ballot Secrecy Invariant:** The ballot record must never contain voter identifiers (user ID, email, name, IP address, or user agent). Ballot submission uses detached single-use cryptographic entitlement tokens.
- **Audit Logging Invariant:** Audit logs must capture administrative actions, timestamps, and actors, but must never record ballot choices or credentials.
- **Zero-Trust Administrative Boundaries:** Administrative users cannot view individual voter selections, nor can they view live tally results before an election is closed and tallied.

---

## 4. Approaches Considered
- **Approach A (Selected): Dedicated Implementation Specification Suite under `docs/spec/` + Total Data Purge.**
  - Clean separation of the master specification documents into a focused, navigable structure.
  - Leaves the repository pristine and unambiguous for future planning and implementation.
- **Approach B (Rejected): In-Place Overwrite of 27 Fragmented Files.**
  - Overwriting disparate files across `docs/` maintains legacy fragmentation and makes referencing contracts across tiers cumbersome.

---

## 5. Specification Structure & Details

### 5.1 `docs/spec/01-functional-specification.md`
Contains the complete 24-section documentation directly provided by the functional specification:
1. **System Roles and Access** (Platform Super Admin, Institution Owner, Institution Admin, Election Manager, Candidate, Voter, Auditor / Observer)
2. **Public Website** (Landing Page, Public Election Page)
3. **Authentication and Account Management** (Registration, Login, Password Reset, Profile & Security)
4. **Institution Onboarding** (Create Institution, Setup Wizard, Institution Settings)
5. **Institution Admin Dashboard** (KPIs, Charts, Recent Activity, Quick Actions)
6. **Elections** (Elections List, 8-Step Creation Wizard, Lifecycle States)
7. **Positions** (Position List, Position Details, Seat Rules)
8. **Candidates** (Candidate Management, Application Flow, Candidate Portal)
9. **Voters and Eligibility** (Voter Directory, CSV Import, Eligibility Rules, Activation)
10. **Voter Dashboard** (My Elections, Election Details, Ballot Flow, Submission States, Privacy Guarantees)
11. **Election Monitoring** (Live Monitoring Dashboard, Restrictions, Emergency Controls)
12. **Tally, Review, and Results** (Tally Process, Results Review, Approval Workflow, Recounts, Publication)
13. **Reports and Exports** (Report Types, CSV/PDF Formats, Privacy Invariants)
14. **Audit Logs** (Tracked Events, Event Schema, Privacy Exclusions)
15. **Team and Permissions** (Team Management, Granular Permissions)
16. **Notifications** (Notification Types, Channels, Notification Center)
17. **Platform Super Admin** (Platform Dashboard, Institution Verification, Platform Settings)
18. **Security and Privacy Requirements** (Auth, Authorization, Integrity, Ballot Secrecy, Infrastructure)
19. **Core Data Model** (Entities, Privacy-preserving Decoupling)
20. **Overall System Flow** (End-to-End Workflow Diagram)
21. **How the Sections Work Together** (Dependency Matrix)
22. **Recommended Implementation Phases** (Phases 1–6)
23. **Definition of Done** (Verification Gates)
24. **Operational Boundaries & Non-Functional Requirements** (SLA, Encryption, Recovery)

### 5.2 Authoritative 7-Role RBAC Model
The platform defines 7 distinct system roles:
1. **Platform Super Admin:** Manages Pollwise platform, verifies institutions, configures global settings.
2. **Institution Owner:** Owns institution profile, appoints administrators, sets governance and billing policies.
3. **Institution Admin:** Manages elections, voters, candidate rosters, settings, and team access.
4. **Election Manager:** Manages assigned elections, positions, schedules, candidate applications, and eligibility.
5. **Candidate:** Manages candidate profile, biography, statement, and campaign material.
6. **Voter:** Browses eligible elections, obtains voting entitlement token, casts secret ballot, views personal participation receipt.
7. **Auditor / Observer:** Read-only access to election configuration, participation aggregates, audit event logs, certified tallies, and recounts.

*Granular Capabilities:* Task-specific administrative privileges (e.g. candidate reviewer, tally officer, results approver) are modeled as granular permission flags granted to Election Managers, Institution Admins, or Auditors to maintain strict separation of duties.

### 5.3 `docs/spec/02-database-schema.md`
Details PostgreSQL schemas across three databases:
- **`identity_db`**: `users`, `user_sessions`, `email_verification_tokens`, `password_reset_tokens`, `organizations`, `organization_memberships`, `voter_groups`, `voter_group_members`, `election_eligibility`, `voting_credentials`, `audit_events`.
- **`election_db`**: `elections`, `election_managers`, `positions`, `candidates`, `candidate_applications`, `eligibility_rules`, `election_approvals`, `election_results`, `recount_requests`, `report_exports`, `audit_events`.
- **`ballot_db`**: `ballots`, `ballot_choices`, `ballot_credential_redemptions`.
Provides SQL DDL definitions, UUID primary keys, UTC timestamps, JSONB metadata structures, unique constraints, foreign keys (within-DB only), and index strategies.

### 5.4 `docs/spec/03-api-contracts.md`
Details RESTful endpoints under `/api/v1` and `/ballot-box/v1`:
- **Auth endpoints:** `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/verify-email`, `/auth/forgot-password`, `/auth/reset-password`.
- **Institution endpoints:** CRUD, settings, team invitations, member management, bulk CSV import.
- **Election endpoints:** CRUD, wizard persistence, schedule, open, emergency pause/resume, close, cancel.
- **Position & Candidate endpoints:** Position CRUD, candidate application, review status updates, approved roster.
- **Voter & Ballot endpoints:** Voter dashboard elections, voting credential issuance (`POST /elections/{id}/voting-credential`), anonymous ballot submission (`POST /ballot-box/v1/ballots`), participation receipt.
- **Tally & Results endpoints:** Deterministic tally computation, review, approval sign-off, recount request, publication.
- **Governance & Monitoring:** Live participation metrics, audit logs, report generation, platform admin endpoints.
Defines Pydantic request/response models, query parameters, error response formats, and RBAC requirements for all 7 roles.

### 5.5 `docs/spec/04-frontend-routes-components.md`
Details React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui frontend:
- **Route hierarchy:**
  - Public: `/`, `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/elections/public/:id`
  - Institution: `/onboarding`, `/dashboard`, `/elections`, `/elections/create`, `/elections/:id`, `/elections/:id/manage`, `/voters`, `/candidates`, `/team`, `/settings`
  - Voter: `/voter/elections`, `/vote/:id`, `/vote/:id/receipt`
  - Results: `/results/:id`
  - Platform Admin: `/admin/platform`
- Component library requirements (Buttons, Cards, Dialogs, Tables, Tabs, Form controls, Skeletons, Alerts).
- State management and API integration (`useAuth`, React Query / Axios).
- Role guards for each of the 7 roles.
- Critical user journeys: Voting Booth, Creation Wizard, Live Monitoring, and Results Review.

### 5.6 `docs/spec/05-security-architecture.md`
Details security principles and implementations:
- **Isolated Ballot-Box & Blind Credential Protocol:** Structural and process isolation preventing voter-to-ballot linkage.
- **Session Management:** HTTP-only cookies, sliding idle timeouts (60 min), absolute expiration (12 hrs), CSRF protection.
- **RBAC Matrix:** Permissions mapped across all 7 roles.
- **Audit Logging Invariants:** Append-only event store, strict redaction of secrets and ballot selections.
- **Rate limiting and abuse defense:** Rate limiters on auth, credential issuance, and ballot box.
- **Threat model mitigations:** Ballot stuffing, coercion, admin tampering, and data leakage defenses.

---

## 6. Seed Data Purge Execution Plan

1. **Identity DB Cleanup:**
   - Execute TRUNCATE CASCADE on: `election_eligibility`, `voting_credentials`, `organization_memberships`, `email_verification_tokens`, `password_reset_tokens`, `user_sessions`, `organizations`, `users`.
   - Preserve: `alembic_version`.
2. **Election DB Cleanup:**
   - Execute TRUNCATE CASCADE on: `election_results`, `election_approvals`, `candidates`, `positions`, `audit_events`, `elections`.
   - Preserve: `alembic_version`.
3. **Ballot DB Cleanup:**
   - Execute TRUNCATE CASCADE on: `ballot_choices`, `ballot_credential_redemptions`, `ballots`.
   - Preserve: `alembic_version`.
4. **File Purge:**
   - Delete `backend/app/commands/seed.py` and its compiled cache.
   - Retain `backend/app/commands/create_admin.py` so a clean platform administrator account can be created after database purge.

---

## 7. What is Left to the Builder
- Implementing database migrations when extending schema models in subsequent phases.
- Implementing backend endpoints and frontend views according to the specifications.
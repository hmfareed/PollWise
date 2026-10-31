# Pollwise — Full System Functionality & Workflow Documentation

**Product:** Pollwise  
**Purpose:** Secure institutional elections for universities, student bodies, organizations, and other eligible institutions  
**Frontend:** React, TypeScript, shadcn/ui, Tailwind CSS  
**Backend:** Python, FastAPI, SQLAlchemy 2.0  
**Database:** PostgreSQL (Isolated 3-Database Architecture: `identity_db`, `election_db`, `ballot_db`)  
**Core Principles:** Voter eligibility, ballot secrecy, election integrity, accessibility, auditability, and controlled result publication.

---

## 1. System Roles and Access

Pollwise enforces strict role-based access control (RBAC). Users should only see and perform actions permitted by their role and institution.

| Role | Main Responsibilities |
| :--- | :--- |
| **Platform Super Admin** | Manages the Pollwise platform, verifies institutions, configures global platform settings, monitors system health, and manages operational rate limits. |
| **Institution Owner** | Owns institution setup, appoints administrators, manages organization-wide governance, verification, and default election settings. |
| **Institution Admin** | Creates elections, manages eligible voters and candidates, configures election settings, and coordinates overall election operations. |
| **Election Manager** | Manages assigned elections, positions, candidate approvals, schedules, and voter eligibility rolls. |
| **Candidate** | Manages their candidate profile, statement, biography, and permitted campaign materials within assigned elections. |
| **Voter** | Views eligible elections, requests blind voting credentials, casts anonymous ballots, and checks personal participation status. |
| **Auditor / Observer** | Views permitted election records, participation turnout metrics, tamper-evident audit logs, and certified tallies without modifying election data. |

### Important Access Invariants
1. **Separation of Duties:** Administrative access must not automatically grant access to individual voter choices or ballot storage.
2. **Decoupled Operations:** Election management, voter eligibility verification, ballot storage, and vote tallying are separated by least-privilege permissions and database boundaries.
3. **Multi-Tenant Isolation:** Institutional data is strictly segregated; an administrator of one institution can never view or modify data belonging to another institution.

---

## 2. Public Website

### 2.1 Landing Page
**What it contains:**
- Pollwise logo and responsive navigation
- Product overview and value proposition
- How it works (step-by-step institutional workflow)
- Security and ballot privacy overview
- Institution-focused use cases (universities, colleges, student unions, professional associations)
- Prominent Sign In and Get Started calls to action
- Support, contact, terms, privacy policy, and accessibility links

**How it works:**
- *Get Started* routes new users to registration (personal voter account or institutional onboarding).
- *Sign In* routes existing users to secure authentication.
- Public election information is displayed only when an institution has explicitly marked an election as publicly visible.
- The landing page must never expose private voter rosters, draft elections, or unpublished tallies.

### 2.2 Public Election Page
For elections configured with public visibility:
- Displays institution name, logo, election title, and description.
- Displays voting period dates and current lifecycle status (Upcoming, Open, Closed, Tallied, Published).
- Displays positions, seat counts, and approved candidate statements.
- Displays eligibility requirements and instructions on how eligible voters participate.
- Displays certified results after official publication.
- Strictly hides voter identities, private ballots, and interim vote counts.

---

## 3. Authentication and Account Management

### 3.1 Registration
**Fields:**
- Full name (First name, Last name)
- Email address (normalized and unique)
- Password (minimum 8 characters, complexity enforced)
- Optional phone number
- Account type selection or institution invitation token

**Registration Flow:**
1. User submits registration details.
2. Backend validates fields, normalizes email, and verifies email uniqueness.
3. Password is securely hashed using Argon2id with unique salt.
4. User record is created in `identity_db` in `unverified` status.
5. Pollwise generates an expiring, single-use email verification token.
6. Verification link or code is sent to the user's email.
7. User clicks the link to verify their email address.
8. User is routed to the appropriate onboarding flow based on account type:
   - *Create an institution:* Starts institution creation and setup wizard.
   - *Join an institution:* Prompts for invitation code or submits access request.
   - *Voter account:* Ready to access eligible institutional elections.

### 3.2 Login
**Contains:**
- Email address and password fields
- Forgot password link
- Optional Single Sign-On (SSO / SAML / OAuth) if enabled by institution
- Multi-factor authentication (MFA / TOTP) challenge if enabled
- Clear, security-conscious error messages (preventing user enumeration)

**Login Flow:**
1. User submits credentials over HTTPS.
2. Backend validates credentials against Argon2id hash and verifies account status.
3. If MFA is active, an MFA challenge is issued and validated.
4. Backend issues an HTTP-only secure session cookie with sliding idle timeout (60 minutes) and absolute timeout (12 hours).
5. User is redirected to their role-specific dashboard.

**Account States:**
- `Unverified`: Registered but email not yet confirmed.
- `Active`: Fully verified and authorized.
- `Pending Approval`: Institutional access request awaiting administrator confirmation.
- `Suspended`: Temporarily disabled by administrator.
- `Locked`: Locked due to consecutive failed login attempts or security triggers.
*Suspended or locked accounts are strictly prohibited from accessing protected endpoints.*

### 3.3 Password Reset
1. User requests password reset via email address.
2. Backend verifies email existence silently and generates a time-limited (15 minutes), single-use cryptographic token.
3. Reset link is delivered via email.
4. User submits a new compliant password.
5. Password hash is updated, the token is marked used, and all active sessions are revoked.
6. Security confirmation email is sent.

### 3.4 Profile and Security Settings
Contains:
- Display name and optional profile avatar
- Registered email and phone number
- Password change modal with current password verification
- Multi-factor authentication (TOTP) configuration with backup codes
- Active sessions viewer with device type, IP address, last activity, and "Sign out of other sessions" action
- Notification delivery preferences
- Account deactivation or deletion request (subject to statutory and institutional record retention rules)

---

## 4. Institution Onboarding

### 4.1 Create Institution
**Fields:**
- Institution name (e.g., University or Student Union name)
- Institution type (University, College, Student Union, Professional Body, School, Corporate, Nonprofit)
- Country and geographical region
- Official website URL
- Official email domain (e.g., `@polytechnic.edu`)
- Logo upload
- Institution description
- Primary administrative contact details

**Onboarding Lifecycle Flow:**
1. Owner submits institution details during registration.
2. Institution record is created in `identity_db` in `Pending Verification` status.
3. Owner confirms their official institutional email domain.
4. Platform Super Admin reviews details if manual verification is mandated by platform policy.
5. Institution transitions to `Active` status.
6. Owner is granted `Institution Owner` role and directed to the Institution Setup Wizard.

### 4.2 Institution Setup Wizard
The wizard guides the Institution Owner through 6 structured steps:
1. **Institution Profile:** Verify branding, logo, contact information, and timezones.
2. **Election Preferences:** Configure default election duration, timezone, and voter authentication options.
3. **Governance Settings:** Define election approval requirements, separation-of-duty rules, and result publication policy.
4. **Team Setup:** Invite initial Institution Admins, Election Managers, and Auditors.
5. **Voter Setup:** Select default voter ingestion methods (manual entry, bulk CSV import, or student information system integration).
6. **Review & Completion:** Validate settings, save configuration, and enter the main Institution Admin Dashboard.
*The wizard automatically persists draft progress so onboarding can be resumed at any time.*

### 4.3 Institution Settings
- Institution branding, logo, and theme colors
- Allowed official email domains for automated membership mapping
- Default election configurations and voting rules
- Voter authentication requirements (password, MFA, SSO)
- Role definitions and granular permission assignments
- Notification templates and automated dispatch rules
- Data retention policies
*Settings affecting currently active elections are locked or require an explicit audited multi-signature change process.*

---

## 5. Institution Admin Dashboard

### 5.1 Dashboard Overview
**Key Performance Indicators (KPI Cards):**
- Total Elections
- Draft Elections
- Scheduled Elections
- Active / Open Elections
- Total Eligible Voters
- Pending Approvals

**Analytics & Visualizations:**
- Elections by lifecycle status
- Voter turnout and participation trends over time
- Aggregate participation comparisons across elections
- Administrative activity timeline

**Operational Sections:**
- Upcoming scheduled elections widget
- Recent administrative activity feed (linked to audit logs)
- Pending tasks queue (applications to review, tallies awaiting approval)
- Quick action buttons:
  - *Create Election*
  - *Import Voters*
  - *Add Candidate*
  - *Invite Team Member*
  - *View Reports*

### 5.2 Privacy Rule for Dashboards
Dashboard metrics and aggregate charts must never expose interim candidate vote tallies while an election is open, nor reveal individual voter selections.

---

## 6. Elections

### 6.1 Elections List
**Metadata displayed:**
- Election title and election type
- Start date/time and end date/time
- Current lifecycle status badge
- Total eligible voters count
- Turnout count and percentage
- Assigned Election Manager
- Permitted contextual actions

**Filter Tabs:**
`Draft` | `Scheduled` | `Open` | `Closed` | `Tallied` | `Approved` | `Published` | `Archived`

**Actions:**
- `View`: Inspect election details and live monitoring
- `Edit`: Modify configuration (permitted in `Draft` only)
- `Duplicate`: Clone structure for a new election cycle
- `Manage`: Control election lifecycle transitions
- `Archive`: Move concluded election to historical archive
- `Cancel`: Terminate election under formal governance rules

### 6.2 Create Election Wizard (8 Steps)
1. **Basic Information:** Election title, description, institutional unit, election type, and election timezone.
2. **Schedule:** Nomination period, campaign period, voting start and end times, result release schedule, and contingency rules.
3. **Positions:** Position titles, descriptions, number of seats available, candidate eligibility criteria, and voting method (single choice per position).
4. **Candidates:** Candidate profile creation, position assignment, biography, manifesto documents, and approval status.
5. **Voters & Eligibility:** Target voter groups selection, CSV voter roll import, duplicate validation, and eligible voter count verification.
6. **Ballot Configuration:** Ballot layout, candidate ordering rules (alphabetical, randomized per voter), instructions, and optional abstention choice.
7. **Security & Governance:** Voter authentication requirements, separation-of-duty approval workflow, audit settings, and recount rules.
8. **Review & Schedule:** Comprehensive configuration summary, validation check for missing data, and final choice to *Save as Draft* or *Schedule Election* (which computes and freezes the configuration SHA-256 hash).

### 6.3 Election Lifecycle State Machine
```
Draft ──> Scheduled ──> Open ──> Closed ──> Tallied ──> Approved ──> Published ──> Archived
  │          │            │
  └─── Cancelled ─────────┘
```
- **Draft:** Fully editable by authorized managers.
- **Scheduled:** Configuration is frozen with a SHA-256 hash. Changes are locked.
- **Open:** Eligible voters cast secret ballots. Election structure is immutable.
- **Closed:** Voting deadline reached; ballot submission endpoint permanently terminates acceptance.
- **Tallied:** Automated deterministic tally computes vote counts and integrity checksums.
- **Approved:** Independent authorized reviewers review and sign off on tally results.
- **Published:** Official results are released publicly or to authorized voters according to policy.
- **Archived:** Historical record retained for compliance and research.
- **Cancelled:** Aborted under emergency governance policy with mandatory audit justification.
*All state transitions are strictly validated by backend state machines.*

---

## 7. Positions

### 7.1 Position List
Displays for each position:
- Position name (e.g., President, Treasurer, Student Trustee)
- Parent election
- Number of seats available
- Candidate count
- Eligibility requirements summary
- Position status

### 7.2 Position Details
- Description and responsibilities
- Candidate roster with application statuses
- Position-specific eligibility rules (e.g., department, faculty, academic year)
- Ballot presentation configuration and candidate ordering
- Official certified results once published

### 7.3 Position Functionality
- Positions belong to an election and structure the ballot choices.
- If a voter is eligible for an election but not for a specific department position, that position is excluded from their ballot.
- Enforces minimum selections (e.g., 0 if abstention allowed, 1 if required) and maximum selections (number of seats).

---

## 8. Candidates

### 8.1 Candidate Management
**Profile Fields:**
- Full name
- Profile photograph URL
- Candidate statement / manifesto
- Biography and academic/organizational background
- Assigned position
- Supporting verification documents
- Approved campaign links

**Candidate Statuses:**
`Draft` ──> `Submitted` ──> `Under Review` ──> `Approved` | `Rejected` | `Withdrawn`

### 8.2 Candidate Application Flow
1. Prospective candidate submits application with statement and verification documents.
2. Election Manager or Candidate Reviewer inspects credentials and eligibility.
3. Manager records approval or rejection with reason.
4. Candidate receives notification of status decision.
5. Approved candidates are automatically attached to the election ballot upon scheduling.

### 8.3 Candidate Portal
Authorized candidates can:
- View assigned election rules and deadlines
- Update permitted biography fields before the lock deadline
- Monitor application review status
- Access campaign guidelines
*Candidates are strictly prohibited from accessing voter identities, interim vote totals, or private ballots.*

---

## 9. Voters and Eligibility

### 9.1 Voter Directory
Maintains institutional voter records:
- Full name
- Institutional identifier (e.g., Student ID / Employee ID)
- Normalized official email
- Department, faculty, or group
- Account status (`Active`, `Invited`, `Suspended`)
- General institutional eligibility status
*Access to the voter directory is restricted to authorized administrators.*

### 9.2 Bulk CSV Voter Import
**Supported columns:** `member_id`, `first_name`, `last_name`, `email`, `department`, `status`.

**Import Workflow:**
1. Administrator uploads CSV file.
2. System parses file and maps columns.
3. System validates required fields and email formats.
4. System detects duplicates (within file and against existing database).
5. Shows preview table with valid rows and flagged errors.
6. Administrator confirms import.
7. System transactionally creates voter records and issues activation invitations.
8. System generates a downloadable error report for invalid rows.

### 9.3 Eligibility Rules
Eligibility evaluation can be scoped by:
- General institution membership
- Department, faculty, or division
- Class year or graduation cohort
- Designated voter groups
- Position-specific criteria
*Eligibility rolls are frozen when an election transitions to Scheduled.*

### 9.4 Voter Invitation and Activation
1. Eligible voter receives an email invitation with an activation token.
2. Voter clicks the link and verifies identity.
3. Voter establishes their password and account credentials.
4. System checks voter eligibility against all active elections.
5. Eligible elections appear in the Voter Dashboard.

---

## 10. Voter Dashboard

### 10.1 My Elections
Displays elections partitioned by status:
- **Active Elections:** Currently open; displays *Vote Now* button if voter is eligible and has not yet voted.
- **Upcoming Elections:** Scheduled elections opening soon with countdown timer.
- **Completed Elections:** Closed elections with links to published results.
- **Participation Status:** Clear indicator showing whether the voter has cast their ballot.

### 10.2 Election Details (Voter View)
- Election title, description, and institutional context
- Voting window (open and close timestamps in voter's local timezone)
- Election governance rules and contact information
- List of positions with approved candidates, biographies, and manifestos
- Instructions for completing and submitting the ballot

### 10.3 Ballot Flow and Privacy-Preserving Voting Protocol
```
[Voter Authenticated] ──> Request Voting Credential ──> [Issue Blind Single-Use Bearer Token]
                                                                   │
                                                                   ▼
[Detached Anonymous Client] ──> Submit Choices + Bearer Token ──> [Ballot-Box API]
                                                                   │
                                                                   ▼
                                                 Validate Token & Atomic Redemption
                                                 Store Ballot in ballot_db (NO IDENTITY)
                                                 Record Used Entitlement in identity_db
```

1. **Eligibility Check:** Authenticated voter enters open election. Backend verifies active eligibility and ensures no prior vote was cast.
2. **Credential Issuance:** `POST /elections/{id}/voting-credential` generates a cryptographically signed, single-use bearer token and marks the voter's entitlement status as *issued*.
3. **Ballot Presentation:** Voter selects candidate choices for each eligible position.
4. **Client Validation:** Frontend verifies that required selections and seat limits are satisfied.
5. **Review Screen:** Voter reviews summary of selections before confirming.
6. **Anonymous Submission:** Client submits choices and single-use bearer token to `POST /ballot-box/v1/ballots`.
   - *Privacy Protection:* The submission strictly omits session cookies, authorization headers, voter IDs, and IP tracking.
7. **Atomic Redemption & Storage:** The isolated ballot-box service atomically verifies the token, records the redemption hash, and stores the anonymous ballot in `ballot_db`.
8. **Participation Confirmation:** Voter receives a cryptographically verifiable participation receipt confirming their vote has been safely accepted.

### 10.4 Ballot Submission States
- `Not Started`: Voter has not opened the voting booth.
- `In Progress`: Voter is selecting candidates.
- `Submitted`: Ballot transmitted to ballot-box.
- `Submission Confirmed`: Single-use token redeemed, ballot stored, receipt returned.
- `Already Voted`: Entitlement already redeemed; further voting attempts rejected.
- `Submission Failed`: Error occurred (e.g. deadline expired); clear error message displayed without duplicate ballot creation.

---

## 11. Election Monitoring

### 11.1 Live Monitoring Dashboard
Provides real-time operational oversight for Election Managers and Auditors:
- Total eligible voters count
- Total ballots cast and aggregate turnout percentage
- Participation trends over time (hourly distribution)
- Turnout breakdown by department (only when group size exceeds anonymity thresholds)
- Election status and infrastructure health indicators
- Log of operational lifecycle events

### 11.2 Monitoring Restrictions
- **Zero Interim Counts:** Candidate vote totals are never calculated or displayed while an election is open.
- **Zero Individual Tracking:** Individual voter choices are never displayed or stored.
- **K-Anonymity Thresholds:** Departmental turnout is suppressed for groups smaller than 10 voters to prevent deduction.

### 11.3 Emergency Controls
Authorized Election Managers can execute:
- **Pause Election:** Temporarily halts ballot acceptance during emergencies.
- **Resume Election:** Re-enables voting after resolution of emergency.
- **Close Election:** Terminates voting at scheduled deadline or under emergency protocol.
- **Cancel Election:** Formally aborts election under institutional governance policy.
*All control actions require two-factor confirmation, mandatory reason justification, and an immutable audit log entry.*

---

## 12. Tally, Review, and Results

### 12.1 Tally Process
1. Voting window closes; ballot-box permanently rejects subsequent submissions.
2. Automated ballot integrity validation confirms that all stored ballots match the frozen election configuration hash.
3. Tally service counts valid ballots using the deterministic `single_choice_per_position` tally algorithm.
4. Total votes per candidate, abstentions, and total valid ballots are calculated.
5. Tally record with version number, algorithm version, timestamp, and SHA-256 checksum is generated in `election_db`.
6. Election transitions to `Tallied` status.

### 12.2 Results Review
Displays for authorized reviewers:
- Position title and available seats
- Candidate name, vote count, and percentage of valid votes
- Abstention counts and invalid ballot counts
- Tie status indicators and winner determinations
- Cryptographic tally integrity checksum

### 12.3 Approval Workflow
- Separation of duties: The user who created the election cannot be the sole approver of the tally.
- Election Manager submits tally for institutional review.
- Institution Admin or Electoral Auditor reviews the tally against audit logs.
- Reviewer approves the tally or requests a recount.
- Approval decision is permanently recorded in `election_approvals`.

### 12.4 Recount and Dispute Handling
- Authorized users may request a recount with documented justification.
- Recount service re-runs deterministic tally against the preserved, immutable ballots in `ballot_db`.
- Generates a new tally version (e.g. `version 2`) without altering original ballot records.
- Documents recount discrepancies, auditor notes, and reconciliation results.

### 12.5 Publish Results
- When approved and the results release time arrives, election transitions to `Published`.
- Results become accessible to voters and on public election pages (if enabled).
- Automated notifications dispatched to candidates and voters.
- Official certified summary reports become available for export.

---

## 13. Reports and Exports

### 13.1 Report Types
- **Election Summary Report:** High-level overview of schedule, turnout, winners, and certification.
- **Participation & Turnout Report:** Departmental and aggregate turnout analytics.
- **Certified Results Report:** Complete candidate vote breakdowns, percentages, and approver signatures.
- **Audit Trail Report:** Complete chronicle of administrative events and lifecycle state transitions.
- **Voter Eligibility Roll Report:** List of registered eligible voters and account statuses.
- **Recount & Reconciliation Report:** Comparative analysis across tally versions.

### 13.2 Export Formats & Privacy Rules
- Supported formats: CSV, PDF, and JSON.
- Exports require specific role authorization (`export_reports`).
- Ballot-level data must never be exported in any format that could correlate voter identities with selections.
- All export generations are recorded in the audit log.

---

## 14. Audit Logs

### 14.1 Tracked System Events
- User authentication, login failures, password changes, and MFA events
- Institution profile and settings updates
- Election creation, schedule changes, and configuration freezing
- Candidate application submissions, approvals, and rejections
- Voter CSV imports and eligibility updates
- Election lifecycle transitions (Schedule, Open, Pause, Resume, Close, Cancel)
- Voting credential issuance events
- Tally computation, recount requests, and approval sign-offs
- Result publication and report exports

### 14.2 Audit Log Schema
- `event_id`: Unique UUID
- `timestamp`: ISO 8601 UTC timestamp
- `actor_id`: User UUID or system service identifier
- `organization_id`: Target institution UUID
- `election_id`: Related election UUID (if applicable)
- `action`: Specific action identifier (e.g., `election.open`, `tally.approve`)
- `outcome`: `SUCCESS`, `FAILURE`, or `DENIED`
- `ip_address` & `user_agent`: Network origin metadata
- `details`: JSONB payload of change details (strictly excluding secrets and ballot choices)

---

## 15. Team and Permissions

### 15.1 Team Roles & Governance
Institutional team management covers:
- **Institution Owner:** Full administrative authority and governance oversight.
- **Institution Admin:** Day-to-day administration across all elections and voter rolls.
- **Election Manager:** Scoped management of specific assigned elections.
- **Auditor / Observer:** Independent oversight and read-only inspection.

### 15.2 Granular Permissions Matrix
Capabilities are assigned to roles following least privilege:
- `institution.manage`
- `election.create`, `election.edit`, `election.schedule`, `election.open`, `election.close`
- `candidate.manage`, `candidate.review`
- `voter.import`, `voter.manage_eligibility`
- `tally.compute`, `tally.review`, `tally.approve`
- `results.publish`
- `reports.export`
- `audit.view`

---

## 16. Notifications

### 16.1 Notification Triggers
- Email verification and password recovery links
- Institutional team invitation
- Voter eligibility notification and election invitation
- Candidate application status updates
- Election scheduled and opening reminders
- Voting reminder (24 hours prior to deadline)
- Election closure and results published announcements
- Recount notifications and security alerts

### 16.2 Delivery Channels & Notification Center
- **In-App Notifications:** Real-time badge counter, read/unread states, direct deep-links to relevant election resources.
- **Transactional Email:** Reliable delivery via SMTP / Mailpit / transactional email providers.
- Configurable preferences allowing users to manage non-critical announcements.

---

## 17. Platform Super Admin

### 17.1 Platform Dashboard
Platform-level oversight for Pollwise system operators:
- Total registered institutions (active, pending, suspended)
- Global user counts and active sessions
- Total ongoing and scheduled elections
- Platform operational health, database connections, and latency
- Pending institution verification queue
- System error rates and rate-limiting alerts

### 17.2 Institution Verification & Management
- Review institutional accreditation and domain ownership verification requests
- Activate, suspend, or reactivate institutional accounts
- Configure platform-level usage limits (maximum concurrent elections, voter caps)
- Record mandatory administrative justifications for platform interventions

### 17.3 Global Platform Settings
- Platform authentication policies and session lifetimes
- Global rate limits and anti-abuse thresholds
- Email and SMS provider configurations
- Platform maintenance mode toggles
- Backup schedules and disaster recovery controls

---

## 18. Overall System Flow

```
Public Website
    │
    ▼
Register / Sign In
    │
    ▼
Verify Email & Identity
    │
    ▼
Create or Join Institution
    │
    ▼
Institution Verification & Setup Wizard
    │
    ▼
Institution Admin Dashboard
    │
    ▼
Create Election (8-Step Wizard)
    │
    ▼
Configure Positions & Seat Rules
    │
    ▼
Add & Approve Candidates
    │
    ▼
Import & Verify Eligible Voters (CSV)
    │
    ▼
Review & Freeze Configuration Hash (SHA-256)
    │
    ▼
Schedule Election
    │
    ▼
Election Opens (Voting Window Active)
    │
    ▼
Voters Authenticate & Receive Single-Use Credential Token
    │
    ▼
Voters Cast Secret Ballots (Detached, Cookie-Free to Ballot-Box)
    │
    ▼
Election Closes (Submissions Terminated)
    │
    ▼
Automated Ballot Integrity Checks
    │
    ▼
Deterministic Tally Generated (Version 1)
    │
    ▼
Review / Multi-Signature Approval / Recount (if requested)
    │
    ▼
Official Results Published
    │
    ▼
Reports Exported & Audit Records Archived
    │
    ▼
Election Archived
```

---

## 19. Core Data Model Summary

The platform defines 24 core architectural entities across three physically isolated databases:

- **`identity_db` (Tenant & Voter Identity):**
  1. `User`
  2. `UserSession`
  3. `EmailVerificationToken`
  4. `PasswordResetToken`
  5. `Organization` (Institution)
  6. `OrganizationMembership`
  7. `VoterGroup`
  8. `VoterGroupMember`
  9. `ElectionEligibility`
  10. `VotingCredential`
  11. `IdentityAuditEvent`

- **`election_db` (Election Configuration & Governance):**
  12. `Election`
  13. `ElectionManager`
  14. `Position`
  15. `Candidate`
  16. `CandidateApplication`
  17. `EligibilityRule`
  18. `ElectionApproval`
  19. `ElectionResult`
  20. `RecountRequest`
  21. `ReportExport`
  22. `ElectionAuditEvent`

- **`ballot_db` (Anonymous Secret Ballot Storage):**
  23. `Ballot`
  24. `BallotChoice`
  25. `BallotCredentialRedemption`

*Strict Isolation Rule:* `ballot_db` contains no foreign keys, user IDs, or metadata referencing `identity_db`.

---

## 20. How Sections Work Together

| Section | Consumes From | Feeds Into |
| :--- | :--- | :--- |
| **Authentication** | User credentials, sessions | All protected platform areas |
| **Institution Setup** | Verified user account | Permissions, institution dashboard |
| **Elections** | Institution settings, managers | Positions, candidates, voter rolls, monitoring |
| **Positions** | Election configuration | Candidate assignment, ballot structure |
| **Candidates** | Positions, candidate applications | Ballot presentation, certified results |
| **Voters & Eligibility**| Institution members, CSV uploads | Entitlement verification, voting booth access |
| **Ballot-Box** | Credential token, election state | Anonymous ballot storage, participation receipts |
| **Monitoring** | Anonymous ballot events | Admin turnout metrics, emergency controls |
| **Tally & Results** | Preserved ballots, election hash | Results review, approval workflow, publication |
| **Reports** | Concluded tallies, audit logs | Certified PDF/CSV downloads |
| **Audit Logs** | Security events across all tiers | Governance oversight, electoral compliance |

---

## 21. Security and Privacy Requirements

1. **Ballot Secrecy:** Stored ballots must be completely decoupled from voter identity. No administrator or system query can determine how a specific individual voted.
2. **Blind Bearer Tokens:** Credential issuance and ballot casting are decoupled into separate transactions.
3. **Database Privilege Separation:** Distinct PostgreSQL users (`identity_user`, `election_user`, `ballot_user`, `tally_ro_user`) prevent cross-database privilege escalation.
4. **Configuration Freezing:** An election configuration is hashed (SHA-256) upon scheduling. Ballots submitted against mismatched hashes are rejected.
5. **Deterministic Tallying:** Results are fully reproducible from the preserved ballot set.
6. **Transport & Data Security:** HTTPS everywhere, Argon2id password hashing, encrypted backups, and rate-limited endpoints.

---

## 22. Recommended Implementation Phases

- **Phase 1 — Foundation:** Multi-database isolation, authentication, session security, baseline admin dashboard.
- **Phase 2 — Election Setup:** Election creation wizard, positions, candidate review flow, voter registry, and bulk CSV ingestion.
- **Phase 3 — Secret Ballot Infrastructure:** Blind credential issuance, detached ballot-box API, voter booth UX, duplicate prevention.
- **Phase 4 — Results & Governance:** Deterministic tallying, review and approval workflows, recounts, result publication.
- **Phase 5 — Operations & Compliance:** Real-time monitoring, tamper-evident audit logs, PDF/CSV report exports, notification center.
- **Phase 6 — Platform Administration:** Platform Super Admin dashboard, institution verification, rate limiting, and release verification.

---

## 23. Definition of Done

A Pollwise deployment is considered production-ready only when:
- Users can register, verify email, and authenticate with Argon2id and MFA.
- Institutions can onboard, configure branding, and invite team members.
- Administrators can configure elections, positions, candidates, and eligible voters.
- Eligible voters can securely access voting booths and cast anonymous ballots.
- Duplicate voting is strictly prevented by atomic credential redemptions.
- Stored ballots contain zero voter identity linkages.
- Election configuration is cryptographically frozen before voting begins.
- Tallying is deterministic, auditable, and requires multi-role approval before publication.
- Audit logs capture all operational events without leaking secrets or ballot choices.
- All unit, integration, and security verification tests pass with 100% reliability.

---

## 24. Operational Boundaries & Non-Functional Requirements

- **Availability & SLA:** Designed for 99.9% uptime during active election windows.
- **Throughput:** Capable of handling peak voting traffic (1,000+ votes/minute) via connection pooling and decoupled async ballot acceptance.
- **Retention:** Audit logs and certified election results retained according to institutional policy; transient session tokens purged automatically.
- **Disaster Recovery:** Automated multi-DB backups with point-in-time recovery to preserve election integrity.

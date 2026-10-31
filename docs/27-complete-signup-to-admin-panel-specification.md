# 27 — Complete Signup-to-Admin-Panel Specification

**POLLWISE — Complete Signup-to-Admin-Panel Documentation**  
**Product Specification · Version 1.0 · October 2026**  
*Product:* Pollwise  
*Category:* Institutional Election Management Platform  
*Frontend:* React + TypeScript + shadcn/ui + Tailwind CSS  
*Backend:* Python + FastAPI + SQLAlchemy 2.0  
*Database:* PostgreSQL (Isolated Multi-DB Architecture)  
*Purpose:* Secure, transparent, and manageable institutional elections.

---

## 1. Product Overview

Pollwise is an institutional election management platform designed for universities, student unions, schools, associations, professional bodies, and organizations.
The platform allows institutions to manage their entire election lifecycle digitally.

The system supports:
1. Institutional registration and account creation.
2. Organization and administrator management.
3. Election creation and configuration.
4. Multiple election positions.
5. Candidate registration and approval.
6. Registered voter management and eligibility verification.
7. Secret ballot voting.
8. Election monitoring.
9. Vote tallying and result verification.
10. Result approval and publication.
11. Audit logs and administrative accountability.

The platform has two primary experiences:
- **Public and voter experience:** Registration, authentication, viewing eligible elections, voting, and checking published results.
- **Administrative experience:** Institution management, election configuration, voter eligibility, candidates, election operations, results, and governance.

---

## PART A — SIGNUP AND ONBOARDING

### 2. Public Landing Page

The landing page is the first point of contact for institutions and prospective users.

#### 2.1 Navigation
The navigation bar contains:
- **Pollwise logo**: Returns to homepage
- **Home**: Landing page
- **Features**: Product features
- **For Institutions**: Institutional use cases
- **Security**: Security and privacy information
- **About**: About Pollwise
- **Sign In**: Opens authentication
- **Get Started**: Starts registration
The navigation remains accessible on desktop and mobile.

#### 2.2 Hero Section
- **Headline**: *Every Vote Matters. Every Election Counts.*
- **Supporting text**: *Pollwise helps institutions organize, manage, and conduct secure elections with confidence. From voter eligibility to verified results, everything happens in one platform.*
- **Primary CTA**: Get Started
- **Secondary CTA**: Explore Platform

#### 2.3 Landing Page Sections
1. Hero section
2. Platform capabilities
3. How Pollwise works
4. Built for institutions
5. Security and ballot secrecy
6. Election management preview
7. Frequently asked questions
8. Final call to action
9. Footer

> [!IMPORTANT]
> The security section must explain the actual controls implemented. Avoid unsupported claims such as guaranteed absolute anonymity or unvetted cryptographic claims.

---

### 3. Registration

Registration is the beginning of the Pollwise onboarding process.

#### 3.1 Registration Page
The page offers two distinct registration paths:
1. **Personal Account**: For voters and individual users who need to access elections.
2. **Institution Account**: For universities, organizations, and administrators who want to manage elections.

*Distinction:* Registering an ordinary voter must not automatically grant institutional administration privileges.

#### 3.2 Personal Account Registration
**Fields:**
- First name (Required)
- Last name (Required)
- Email address (Required, unique)
- Password (Required, min 8 chars)
- Confirm password (Required)
- Terms acceptance (Required)
- *Optional:* Phone number, Profile image

**Actions:** Create Account, Continue with OAuth (if enabled), Sign In link, View terms & privacy policy.

#### 3.3 Institution Account Registration
**Fields:**
- Institution name (Required)
- Institution type (Required: University, College, Secondary school, Professional association, Student union, Corporate organization, Nonprofit organization, Other)
- Official email (Required)
- Administrator first name (Required)
- Administrator last name (Required)
- Password (Required)
- Confirm password (Required)
- Country (Required)
- Terms acceptance (Required)

#### 3.4 Registration Validation
The backend must:
- Validate all required fields.
- Normalize email addresses.
- Check email uniqueness.
- Enforce password policies.
- Hash passwords using Argon2id.
- Create user record.
- Create institution/organization record for institutional registration.
- Create initial institution administrator membership (`organization_admin`).
- Generate single-use email verification token.
- Record security audit event.
- Never store plaintext passwords or expose password hashes.

#### 3.5 Email Verification
Content: *Verify your email address. We sent a verification link to your registered email address. Verify your email to continue setting up your Pollwise account.*
- Single-use, expiring tokens.
- Rate-limited resend action.
- Server-side token validation.

---

### 4. Login and Authentication

#### 4.1 Login Page
- Email address & Password.
- Actions: Sign In, Remember me (session policy), Forgot password?, Create an account.

#### 4.2 Login Process & Role-Based Redirects
- Validate credentials with Argon2id.
- Check account status (`active`).
- Create secure HttpOnly session.
- Role-based destination:
  - **Platform Administrator**: Platform administration
  - **Institution Administrator**: Institution dashboard (`/admin`)
  - **Election Manager**: Election management dashboard (`/admin`)
  - **Auditor**: Audit dashboard (`/audit` / `/admin`)
  - **Voter / Member**: Voter console (`/elections`)

#### 4.3 Forgot / Reset Password
- Enter email -> generic response (prevent account enumeration).
- Dispatched single-use token -> `/reset-password?token=...`.
- Updates password hash & invalidates prior active sessions.

---

## PART B — INSTITUTION SETUP

### 5. Institution Onboarding Wizard

After verifying email and signing in, an institution administrator enters the multi-step onboarding wizard:

- **Step 1: Institution Profile**: Name, abbreviation, type, country, region, city, website, contact email/phone, logo.
- **Step 2: Institution Details**: Description, approximate member count, departments/faculties count, registration identifier.
- **Step 3: Administrator Profile**: Full name, title/position, department, email, phone.
- **Step 4: Institution Structure**: Defining faculties, departments, schools, student unions, committees.
- **Step 5: Security Setup**: Admin MFA policy, approved email domains, invitation permissions, session policy, approval thresholds.
- **Step 6: Review and Submit**: Summary with Save Draft and Complete Setup.

#### 5.1 Institution Verification
Statuses: `Draft`, `Pending verification`, `Verified`, `Rejected`, `Suspended`.
Domain check and institutional documentation review.

### 6. Institution Dashboard Initialization
Initial zero-state welcome screen guiding new administrators through:
1. Completing profile.
2. Inviting co-administrators.
3. Creating departments.
4. Importing voter registry.
5. Creating first election.

---

## PART C — ADMINISTRATIVE DASHBOARD

### 7. Main Admin Dashboard

#### 7.1 Layout
- **Left Sidebar**:
  1. Dashboard
  2. Elections
  3. Positions
  4. Candidates
  5. Voters & Eligibility
  6. Organizations
  7. Reports
  8. Audit Logs
  9. Team & Permissions
  10. Settings
- **Top Bar**: Global search, Organization context switcher, Notifications, Profile menu.
- **Main Area**: Overview KPI metrics, status distribution charts, upcoming deadlines, action-required queues, and quick actions.

#### 7.2 Dashboard KPI Cards
- Total Elections
- Eligible Voters
- Registered Candidates
- Active Elections
- Completed Elections
- Pending Approvals

#### 7.3 Visualizations & Charts (Recharts)
- Election status distribution (Donut chart: Draft, Scheduled, Open, Closed, Tallied, Published, Cancelled).
- Voter participation & aggregate turnout progress.

#### 7.4 Action-Required Queue & Upcoming Deadlines
- Scheduled elections awaiting managerial launch approvals.
- Closed elections awaiting post-close tally computation.
- Tallied elections awaiting publication sign-off.

---

## PART D — ELECTION MANAGEMENT

### 8. Elections Overview
Elections data table with status filters (`All`, `Draft`, `Scheduled`, `Open`, `Closed`, `Tallied`, `Published`, `Cancelled`), unit filters, date filters, search, and lifecycle action shortcuts.

### 9. Create Election Wizard (8 Steps)
1. **Basic Information**: Title, description, election type, academic year/cycle, institution unit, election manager.
2. **Election Structure**: Single-position vs Multiple-position election.
3. **Voting Rules**: Selections per position (min/max), abstention allowance, tie policies.
4. **Election Schedule**: Opening date/time, closing date/time, timezone.
5. **Voter Eligibility**: Entire institution, department, specific membership group, or imported CSV.
6. **Candidate Configuration**: Manager registration vs candidate application workflow.
7. **Security & Approval Settings**: Managerial sign-off requirements, recount policies.
8. **Review & Freeze**: Summary with configuration freezing (SHA-256 hash generation).

#### 9.1 Lifecycle States
`Draft` → `Scheduled` (frozen hash) → `Open` → `Closed` → `Tallied` → `Approved` → `Published` (or `Cancelled`).

### 10. Positions Management
Attach positions to multi-position elections. Define minimum and maximum selections, candidate limits, and display order. Locked upon election opening.

### 11. Candidate Management
Candidate profiles (name, photo, biography, manifesto, department). Application review statuses (`Draft`, `Submitted`, `Under review`, `Approved`, `Rejected`, `Withdrawn`). Locked upon election opening.

### 12. Voters and Eligibility Management
- **Voter Overview & Registry**: Member ID, name, email, department, membership status.
- **Bulk CSV Import**: Parsing `member_id, first_name, last_name, email, department, status` with row-level error reporting, preview table, and duplicate detection.
- **Eligibility Assignment**: Scope evaluation per election.
- **Voting Authorization**: Entitlement token issuance without creating identity-to-ballot linkage.

---

## PART E — ELECTION OPERATIONS

### 13. Election Detail & Control Center
Per-election management hub with tabs: Overview, Positions, Candidates, Voters, Participation, Schedule, Security, Activity, Results.
Live participation monitoring (percentages, aggregate counts) without exposing individual voter selections.

### 14. Tallying and Results
- **Initiation Gate**: Only permissible once election is closed and submissions terminated.
- **Deterministic Tally**: Count valid ballots, compute votes per candidate, tally abstentions, generate immutable tally record.
- **Approval Workflow**: Separation of duties review by authorized Election Manager or Auditor.
- **Publication**: Transition to `Published` status with public or authenticated inspection.
- **Recounts**: Preserves historical versions (`version 1 → version 2`), records audit trail and reconciliation notes.

---

## PART F — REPORTS AND GOVERNANCE

### 15. Reports and Analytics
PDF, CSV, and certified audit summaries. Turnout reports, candidate result tables, and participation timelines.

### 16. Audit Logs
Tamper-evident system logs tracking actor, action, resource, timestamp, and metadata. Strictly excludes ballot selections or secrets.

### 17. Team and Permissions
Granular institutional roles:
- `institution_admin`: Full institution administration
- `election_manager`: Manage assigned elections
- `candidate_reviewer`: Review candidate applications
- `voter_manager`: Manage voter records and eligibility
- `tally_officer`: Execute authorized tally processes
- `results_approver`: Review and approve results
- `auditor`: Read-only audit and election oversight
- `member`: Eligible voter

### 18. Notifications
In-app notification drawer and email dispatcher for lifecycle events (election opening, closing reminders, tally completion, results publication).

---

## PART G — SETTINGS

### 19. Institution Settings
Institution profile, unit structure (faculties, departments), security & MFA policies, default voting rules, branding (logo, primary color).

### 20. Administrator Profile Settings
Profile details, password change, active sessions list with one-click revocation.

---

## PART H — USER EXPERIENCE AND SYSTEM BEHAVIOR

### 21. Interface States & Component Design
- Loading skeletons, empty states with clear calls to action, server validation alerts, session expiration prompts, and confirmation dialogs for destructive/lifecycle actions.
- Responsive design: Full desktop sidebar, collapsible tablet navigation, mobile navigation drawer.

---

## PART I — ARCHITECTURE & SECURITY

### 22. Database & Data Isolation
- Three isolated logical databases (`identity_db`, `election_db`, `ballot_db`) with least-privilege PostgreSQL roles.
- The ballot schema strictly omits voter IDs, personal emails, or session tokens.
- Transactional single-use credential redemption.

---

## PART L — IMPLEMENTATION PHASES

| Phase | Scope |
|---|---|
| **Phase 1** | Project foundation & architecture baseline (Completed) |
| **Phase 2** | Registration & authentication (Personal & Institution accounts) |
| **Phase 3** | Institution onboarding wizard & structure setup |
| **Phase 4** | Unified admin navigation & full dashboard suite |
| **Phase 5** | Advanced election management & creation wizard |
| **Phase 6** | Positions & candidate review workflow |
| **Phase 7** | Voter registry & bulk CSV ingestion |
| **Phase 8** | Secret-ballot voting infrastructure (Completed baseline) |
| **Phase 9** | Election operations & live monitoring |
| **Phase 10** | Tallying, approvals, publication & recounts (Completed baseline) |
| **Phase 11** | Governance: Reports, audit explorer, team permissions, notifications |
| **Phase 12** | Hardening, security review & production release gate |

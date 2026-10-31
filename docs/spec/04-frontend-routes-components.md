# Pollwise — Frontend Architecture, Routes & Components Specification

**Document:** 04-frontend-routes-components.md  
**Status:** Authoritative  
**Stack:** React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form, Zod  
**UX Focus:** Responsive, accessible (WCAG 2.1 AA), role-aware, privacy-preserving  

---

## 1. Route Hierarchy & Navigation Architecture

Pollwise organizes client-side routing into four distinct security domains: Public, Institution Administrative, Voter Booth, and Platform Super Admin.

```
/ (Root Layout: AppShell)
│
├── [Public Domain]
│   ├── /                                       (Landing / Marketing Page)
│   ├── /login                                  (Authentication & SSO Gateway)
│   ├── /register                               (Voter & Institution Registration)
│   ├── /verify-email                           (Email Verification Link Landing)
│   ├── /forgot-password                        (Password Reset Initiation)
│   ├── /reset-password                         (Token-based Password Reset Form)
│   └── /elections/public/:id                   (Public Certified Election Overview)
│
├── [Institution Admin Domain - Protected: Owner, Admin, Manager, Auditor]
│   ├── /onboarding                             (6-Step Institution Setup Wizard)
│   ├── /dashboard                              (Institution Admin KPI Overview)
│   ├── /elections                              (Elections List & Lifecycle Actions)
│   ├── /elections/create                       (8-Step Election Creation Wizard)
│   ├── /elections/:id                          (Election Detail Overview)
│   ├── /elections/:id/manage                   (Operations, Schedule, & Emergency Controls)
│   ├── /elections/:id/positions                (Positions & Seat Configurations)
│   ├── /elections/:id/candidates               (Candidate Applications & Roster)
│   ├── /elections/:id/voters                   (Eligibility Rolls & Scope Management)
│   ├── /elections/:id/monitoring               (Live Aggregate Turnout Dashboard)
│   ├── /elections/:id/results                  (Tally Review, Approval, & Recounts)
│   ├── /voters                                 (Institution Voter Directory & CSV Ingestion)
│   ├── /candidates                             (Institutional Candidate Master Index)
│   ├── /team                                   (Team Roles & Granular Permissions)
│   ├── /audit-logs                             (Institution Security Audit Log Explorer)
│   ├── /reports                                (Certified PDF/CSV Report Generator)
│   └── /settings                               (Institution Branding, Domains, & Defaults)
│
├── [Voter Domain - Protected: Voter / Member]
│   ├── /voter/elections                        (My Eligible Elections Hub)
│   ├── /vote/:id                               (Interactive Voting Booth)
│   ├── /vote/:id/review                        (Ballot Verification & Review Screen)
│   └── /vote/:id/receipt                       (Detached Participation Confirmation Receipt)
│
└── [Platform Super Admin Domain - Protected: Platform Super Admin]
    ├── /platform/dashboard                     (Global Platform Metrics & Health)
    ├── /platform/institutions                  (Institution Verification Queue & Tenant Controls)
    └── /platform/settings                      (Global Authentication & Abuse Limits)
```

---

## 2. Layouts and Shell Architecture

### 2.1 `AppShell` Component
The top-level application wrapper manages responsive chrome and role-aware navigation:
- **Header:**
  - Pollwise brand logo with active tenant institution switcher (for multi-institution users).
  - Environment status badge (`Development` / `Production`).
  - Notification center bell with unread badge counter.
  - User profile avatar dropdown with *Profile*, *Security Settings*, and *Sign Out*.
- **Sidebar (Admin Portal):**
  - Collapsible on tablet, full-height pinned on desktop (width 260px).
  - Links: *Dashboard*, *Elections*, *Voters*, *Candidates*, *Reports*, *Audit Logs*, *Team*, *Settings*.
  - Displays assigned role pill (`Owner`, `Admin`, `Election Manager`, `Auditor`).
- **Mobile Navigation Drawer:**
  - Full-screen slide-over drawer triggered by hamburger button on viewport `< 768px`.
  - Accessible focus trap with keyboard `ESC` dismissal.
- **Breadcrumbs:**
  - Auto-generated contextual breadcrumb navigation (e.g. `Home > Elections > 2026 Student Union General Election > Positions`).

---

## 3. Component Hierarchy & Library Standards

Pollwise uses modular, accessible shadcn/ui primitives styled with Tailwind CSS utility tokens.

### 3.1 UI Primitives (`src/components/ui/`)
- `Button`: Primary, secondary, outline, destructive, ghost, and link variants with loading spinner states.
- `Card`: Composable `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter`.
- `Badge` & `StatusBadge`: Semantic coloring for election lifecycle states (`Draft`: Slate, `Scheduled`: Blue, `Open`: Green, `Closed`: Amber, `Tallied`: Purple, `Published`: Emerald, `Cancelled`: Red).
- `Dialog` & `AlertDialog`: Accessible modal dialogs for destructive actions (e.g. pausing an election, rejecting candidate application).
- `Table`: Virtualized tables supporting sorting, pagination, and multi-row selection.
- `Tabs`: Segmented controls for switching views (e.g. election tabs: *Overview*, *Positions*, *Candidates*, *Voters*, *Results*).
- `Form`, `Input`, `Select`, `Checkbox`, `RadioGroup`: React Hook Form integrated controls with accessible ARIA error messages.
- `Skeleton`: Content-placeholder pulsing skeletons for smooth loading states.

### 3.2 Domain-Specific Feature Components

#### `WizardStepTracker`
Horizontal stepper widget indicating progress, completed steps, current active step, and locked upcoming steps across multi-step flows (Institution Onboarding and 8-Step Election Creation Wizard).

#### `CandidateProfileCard`
Displays candidate photograph, full name, position contested, short manifesto excerpt, and links to full statement. Includes visual selection toggle in the voting booth.

#### `VoterImportDropzone`
Drag-and-drop CSV file ingestion component with real-time browser validation, row preview table, duplicate warning banners, and error report download button.

#### `LiveMetricsWidget`
Turnout monitoring card rendering real-time participation counts, turnout percentages, and animated progress bars without disclosing candidate choices.

#### `TallyAuditTable`
Results presentation component displaying candidate votes, percentages, abstention counts, certified approver signatures, and configuration SHA-256 integrity pills.

---

## 4. State Management & API Integration

### 4.1 Authentication Context (`AuthContext`)
Centralized React context managing user credentials, session state, and tenant memberships:
- `user`: Authenticated user profile (`user_id`, `email`, `display_name`, `is_platform_admin`).
- `activeOrganization`: Currently selected institution metadata and user role.
- `isAuthenticated`: Boolean session indicator.
- `isLoading`: Initial session verification state.
- `login(credentials)`: Submits credentials, sets session cookie, redirects.
- `logout()`: Revokes session on backend, clears local state, redirects to `/login`.
- `switchOrganization(orgId)`: Changes active institutional context.

### 4.2 TanStack Query Integration
Server-state caching and background synchronization:
- `useElections(filters)`: Queries `/api/v1/elections` with automatic cache invalidation on lifecycle transitions.
- `useElection(id)`: Fetches election details, positions, and candidate lists.
- `useVoterElections()`: Queries active elections available for current voter.
- `useTallyResults(id)`: Retrieves certified election results.
- `useAuditEvents(query)`: Paginated query of institutional audit logs.

### 4.3 Form Management & Validation
All forms use React Hook Form paired with Zod schemas:
- Client-side validation runs before network submission.
- Standardized error mapping translates backend RFC 7807 problem details into field-level error messages.

---

## 5. Critical User Journey Workflows

### 5.1 Interactive Voting Booth Workflow (`/vote/:id`)
```
[Step 1: Welcome & Rules] ──> [Step 2: Position Selections] ──> [Step 3: Review Selections] ──> [Step 4: Anonymous Casting] ──> [Step 5: Verified Receipt]
```
1. **Entry Gate:** Checks voter eligibility and election open state. If not eligible or already voted, displays clear notification banner.
2. **Selection Flow:** Iterates through each contested position. Voters select candidate radio cards or choose *Abstain* (if permitted). Minimum and maximum selections are enforced dynamically.
3. **Review Screen:** Presents a structured summary of choices before submission with a confirmation warning that choices are final.
4. **Detached Submission:**
   - Issues blind token via `POST /elections/{id}/voting-credential`.
   - Dispatches cookie-free anonymous payload to `POST /ballot-box/v1/ballots`.
5. **Participation Receipt:** Displays cryptographic receipt hash and offers a downloadable verification receipt.

### 5.2 8-Step Election Creation Wizard (`/elections/create`)
1. **Step 1 — Basic Information:** Title, description, election type, and timezone.
2. **Step 2 — Schedule:** Opening and closing date/time pickers with automated timezone conversion.
3. **Step 3 — Positions:** Add/edit positions with seat counts and selection limits.
4. **Step 4 — Candidates:** Nominate candidates or configure application review settings.
5. **Step 5 — Voter Roll:** Assign target voter groups or upload CSV roster.
6. **Step 6 — Ballot Layout:** Configure candidate ordering (alphabetical, random) and instructions.
7. **Step 7 — Governance:** Multi-signature approval requirements and recount policies.
8. **Step 8 — Review & Freeze:** Comprehensive summary. Clicking *Schedule Election* freezes configuration and generates SHA-256 digest.

### 5.3 Results Review and Approval Modal (`/elections/:id/results`)
1. **Tally Inspection:** Displays total valid ballots counted, candidate votes, vote shares, and ties.
2. **Integrity Validation:** Displays configuration hash match status and tally algorithm checksum.
3. **Approval Sign-Off:** Reviewer enters sign-off comments and clicks *Approve Tally* or *Request Recount*.
4. **Publication Trigger:** When approved, authorized admin triggers *Publish Results*, immediately updating voter and public views.

---

## 6. Route Guard Logic Across Roles

| Route Pattern | Required Role / Guard | Fallback / Redirect |
| :--- | :--- | :--- |
| `/login`, `/register` | Public / Unauthenticated | Redirect to `/dashboard` or `/voter/elections` if signed in |
| `/dashboard`, `/elections` | `Owner`, `Admin`, `Election Manager`, `Auditor` | Redirect to `/login` or `/voter/elections` |
| `/elections/create` | `Owner`, `Admin`, `Election Manager` | HTTP 403 Forbidden alert |
| `/elections/:id/manage` | `Owner`, `Admin`, `Election Manager` (assigned) | HTTP 403 Forbidden alert |
| `/voter/*`, `/vote/*` | `Voter` / `Member` (verified email) | Redirect to `/login` or `/verify-email` |
| `/platform/*` | `Platform Super Admin` | Redirect to `/dashboard` with access denied banner |

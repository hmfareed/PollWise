# Pollwise — Multi-Database Relational Schema Specification

**Document:** 02-database-schema.md  
**Status:** Authoritative  
**Engine:** PostgreSQL 17  
**ORM:** SQLAlchemy 2.0 (Asyncpg)  
**Migrations:** Alembic multi-database configuration  

---

## 1. Architectural Principles & Isolation Boundaries

Pollwise enforces structural isolation by separating data into three distinct, decoupled PostgreSQL databases:

```
┌─────────────────────────────────┐      ┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│           identity_db           │      │           election_db           │      │            ballot_db            │
│  (Tenant & Voter Identity DB)   │      │  (Governance & Operations DB)   │      │    (Anonymous Ballot-Box DB)    │
│                                 │      │                                 │      │                                 │
│  Role: identity_user            │      │  Role: election_user            │      │  Role: ballot_user              │
│  Access: RW on identity_db only │      │  Access: RW on election_db only │      │  Role: tally_ro_user (RO)       │
│  NO ACCESS to ballot_db         │      │  NO ACCESS to ballot_db         │      │  NO ACCESS to identity_db       │
└─────────────────────────────────┘      └─────────────────────────────────┘      └─────────────────────────────────┘
```

### Invariants
1. **Zero Cross-Database Joins:** Queries and transactions operate within a single database connection. Cross-database foreign keys are architecturally forbidden.
2. **Decoupled References:** References across database domains (e.g. `organization_id` or `election_id`) are stored as raw UUIDs without foreign key constraints across database boundaries.
3. **Ballot Secrecy Invariant:** `ballot_db` contains zero columns for user ID, voter ID, member email, IP address, or session token.
4. **Credential Isolation:** Single-use cryptographic voting credentials are issued by `identity_db` and redeemed blindly inside `ballot_db`.

---

## 2. Database 1: `identity_db` (Tenant & Voter Identity)

### 2.1 Entity Relationship Model
```
users ──────────< user_sessions
  │   ──────────< email_verification_tokens
  │   ──────────< password_reset_tokens
  │   ──────────< organization_memberships >────────── organizations
  │   ──────────< voter_group_members      >────────── voter_groups
  │   ──────────< election_eligibility
  └─────────────< voting_credentials
```

### 2.2 Table Definitions

#### `users`
Core user authentication and platform identity table.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Unique user identifier |
| `email_normalized` | `VARCHAR(255)` | `NOT NULL, UNIQUE` | Lowercase trimmed email |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | Argon2id password hash |
| `display_name` | `VARCHAR(255)` | `NOT NULL` | Full user name |
| `email_verified_at` | `TIMESTAMPTZ` | `NULL` | Timestamp of email verification |
| `account_status` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'pending'` | `pending`, `active`, `suspended`, `disabled` |
| `is_platform_admin` | `BOOLEAN` | `NOT NULL, DEFAULT FALSE` | Super admin privileges flag |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Record modification timestamp |

*Indexes:* `ix_users_email_normalized` (`email_normalized`).

---

#### `user_sessions`
Active user authentication sessions and refresh tokens.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Session ID |
| `user_id` | `UUID` | `NOT NULL, FK(users.id, CASCADE)` | Associated user |
| `session_token_hash`| `VARCHAR(64)` | `NOT NULL, UNIQUE` | SHA-256 hash of session secret |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | Absolute expiration (12h) |
| `idle_expires_at` | `TIMESTAMPTZ` | `NOT NULL` | Sliding idle expiration (60m) |
| `ip_address` | `VARCHAR(45)` | `NULL` | Client IP address for security audits |
| `user_agent` | `TEXT` | `NULL` | Client browser user agent |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Login timestamp |
| `last_active_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Sliding window update timestamp |

*Indexes:* `ix_user_sessions_token_hash` (`session_token_hash`), `ix_user_sessions_user_id` (`user_id`).

---

#### `email_verification_tokens`
Expiring tokens for registration and email validation.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Token ID |
| `user_id` | `UUID` | `NOT NULL, FK(users.id, CASCADE)` | Target user |
| `token_hash` | `VARCHAR(64)` | `NOT NULL, UNIQUE` | SHA-256 hash of token |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | Expiration timestamp (24h) |
| `used_at` | `TIMESTAMPTZ` | `NULL` | Timestamp when consumed |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Issuance timestamp |

---

#### `password_reset_tokens`
Single-use time-limited tokens for account password recovery.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Token ID |
| `user_id` | `UUID` | `NOT NULL, FK(users.id, CASCADE)` | Target user |
| `token_hash` | `VARCHAR(64)` | `NOT NULL, UNIQUE` | SHA-256 hash of token |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | Expiration timestamp (15m) |
| `used_at` | `TIMESTAMPTZ` | `NULL` | Timestamp when consumed |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Issuance timestamp |

---

#### `organizations`
Tenant institutions (universities, colleges, student unions, professional associations).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Institution ID |
| `name` | `VARCHAR(255)` | `NOT NULL` | Institution legal/display name |
| `slug` | `VARCHAR(100)` | `NOT NULL, UNIQUE` | URL-friendly identifier |
| `institution_type`| `VARCHAR(100)` | `NOT NULL, DEFAULT 'university'` | University, college, union, etc. |
| `country` | `VARCHAR(100)` | `NOT NULL, DEFAULT 'United States'` | Country of registration |
| `official_domain` | `VARCHAR(255)` | `NULL` | Email domain for auto-verification |
| `status` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'active'` | `pending_verification`, `active`, `suspended` |
| `settings` | `JSONB` | `NOT NULL, DEFAULT '{}'` | Tenant branding, defaults, preferences |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Registration timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Update timestamp |

*Indexes:* `ix_organizations_slug` (`slug`).

---

#### `organization_memberships`
Role assignments and membership status of users within an institution.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Membership record ID |
| `organization_id` | `UUID` | `NOT NULL, FK(organizations.id, CASCADE)` | Institution |
| `user_id` | `UUID` | `NOT NULL, FK(users.id, CASCADE)` | Member user |
| `role` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'member'` | `owner`, `admin`, `election_manager`, `auditor`, `member` |
| `status` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'active'` | `invited`, `active`, `suspended`, `removed` |
| `permissions` | `JSONB` | `NOT NULL, DEFAULT '{}'` | Granular permission overrides |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Membership grant timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Membership update timestamp |

*Constraints:* `UNIQUE(organization_id, user_id)` (`uq_org_member`).

---

#### `voter_groups`
Named cohorts (e.g. "Class of 2026", "Faculty of Engineering", "Graduate Union").

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Group ID |
| `organization_id` | `UUID` | `NOT NULL, FK(organizations.id, CASCADE)` | Institution |
| `name` | `VARCHAR(255)` | `NOT NULL` | Group name |
| `code` | `VARCHAR(100)` | `NOT NULL` | Short code |
| `description` | `TEXT` | `NULL` | Description |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Creation timestamp |

*Constraints:* `UNIQUE(organization_id, code)` (`uq_org_group_code`).

---

#### `voter_group_members`
Association between voters and voter groups.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Member record ID |
| `voter_group_id` | `UUID` | `NOT NULL, FK(voter_groups.id, CASCADE)` | Target voter group |
| `user_id` | `UUID` | `NOT NULL, FK(users.id, CASCADE)` | Voter user |
| `member_identifier`| `VARCHAR(100)` | `NULL` | Institutional student/staff ID |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Enrollment timestamp |

*Constraints:* `UNIQUE(voter_group_id, user_id)` (`uq_group_member`).

---

#### `election_eligibility`
Voter eligibility roll per election, tracking entitlement usage without revealing ballot data.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Eligibility ID |
| `election_id` | `UUID` | `NOT NULL` | Target election UUID (index, unconstrained) |
| `user_id` | `UUID` | `NOT NULL, FK(users.id, CASCADE)` | Voter user |
| `eligibility_status`| `VARCHAR(50)` | `NOT NULL, DEFAULT 'eligible'` | `eligible`, `ineligible`, `revoked` |
| `entitlement_status`| `VARCHAR(50)` | `NOT NULL, DEFAULT 'unused'` | `unused`, `issued`, `used` |
| `eligible_from` | `TIMESTAMPTZ` | `NULL` | Beginning of voting eligibility |
| `eligible_until` | `TIMESTAMPTZ` | `NULL` | Expiration of voting eligibility |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Status update timestamp |

*Constraints:* `UNIQUE(election_id, user_id)` (`uq_election_user_eligibility`).  
*Indexes:* `ix_eligibility_election_id` (`election_id`), `ix_eligibility_user_id` (`user_id`).

---

#### `voting_credentials`
Log of issued blind single-use redemption credentials.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Credential record ID |
| `election_id` | `UUID` | `NOT NULL` | Target election UUID |
| `user_id` | `UUID` | `NOT NULL, FK(users.id, CASCADE)` | Recipient voter |
| `credential_hash` | `VARCHAR(64)` | `NOT NULL, UNIQUE` | SHA-256 hash of issued blind token |
| `issued_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Issuance timestamp |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | Expiration timestamp |
| `status` | `VARCHAR(32)` | `NOT NULL, DEFAULT 'issued'` | `issued`, `redeemed`, `expired` |

*Indexes:* `ix_voting_credentials_hash` (`credential_hash`), `ix_voting_credentials_election` (`election_id`).

---

#### `identity_audit_events`
Audit log for authentication, tenant onboarding, and identity actions.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Event ID |
| `actor_id` | `UUID` | `NULL` | User performing the action |
| `organization_id` | `UUID` | `NULL` | Related organization |
| `event_type` | `VARCHAR(100)` | `NOT NULL` | Action code (e.g., `user.login`, `mfa.enable`) |
| `outcome` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'SUCCESS'` | `SUCCESS`, `FAILURE`, `DENIED` |
| `ip_address` | `VARCHAR(45)` | `NULL` | Origin IP |
| `payload` | `JSONB` | `NOT NULL, DEFAULT '{}'` | Context details (excluding secrets) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Event timestamp |

---

## 3. Database 2: `election_db` (Governance & Operations)

### 3.1 Entity Relationship Model
```
elections ──────────< election_managers
  │       ──────────< positions ──────────< candidates
  │       │                   ──────────< candidate_applications
  │       ──────────< eligibility_rules
  │       ──────────< election_approvals
  │       ──────────< election_results
  │       ──────────< recount_requests
  │       ──────────< report_exports
  └─────────────────< election_audit_events
```

### 3.2 Table Definitions

#### `elections`
Institutional election master entity.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Election ID |
| `organization_id` | `UUID` | `NOT NULL` | Owning institution UUID |
| `title` | `VARCHAR(255)` | `NOT NULL` | Election title |
| `description` | `TEXT` | `NULL` | Election summary and description |
| `status` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'draft'` | `draft`, `scheduled`, `open`, `closed`, `tallied`, `approved`, `published`, `archived`, `canceled` |
| `opens_at` | `TIMESTAMPTZ` | `NULL` | Voting window start |
| `closes_at` | `TIMESTAMPTZ` | `NULL` | Voting window close |
| `timezone` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'UTC'` | Display timezone |
| `voting_method` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'single_choice_per_position'` | Voting algorithm rules |
| `configuration_version`| `INTEGER` | `NOT NULL, DEFAULT 1` | Revision number |
| `configuration_hash`| `VARCHAR(64)` | `NULL` | SHA-256 frozen configuration digest |
| `created_by` | `UUID` | `NULL` | Creator user UUID |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Update timestamp |

*Indexes:* `ix_elections_organization_id` (`organization_id`), `ix_elections_status` (`status`).

---

#### `election_managers`
Manager assignments for an election.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Assignment ID |
| `election_id` | `UUID` | `NOT NULL, FK(elections.id, CASCADE)` | Associated election |
| `user_id` | `UUID` | `NOT NULL` | Assigned manager user UUID |
| `role_type` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'primary_manager'` | `primary_manager`, `co_manager`, `auditor` |
| `assigned_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Assignment timestamp |

*Constraints:* `UNIQUE(election_id, user_id)` (`uq_election_manager`).

---

#### `positions`
Offices/seats contested in an election.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Position ID |
| `election_id` | `UUID` | `NOT NULL, FK(elections.id, CASCADE)` | Parent election |
| `title` | `VARCHAR(255)` | `NOT NULL` | Position title (e.g., President) |
| `description` | `TEXT` | `NULL` | Position description |
| `min_selections` | `INTEGER` | `NOT NULL, DEFAULT 1` | Min choices required (0 if abstention allowed) |
| `max_selections` | `INTEGER` | `NOT NULL, DEFAULT 1` | Max choices allowed (seats) |
| `display_order` | `INTEGER` | `NOT NULL, DEFAULT 0` | Ballot display order |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Update timestamp |

*Indexes:* `ix_positions_election_id` (`election_id`).

---

#### `candidates`
Approved candidates appearing on the official ballot.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Candidate ID |
| `position_id` | `UUID` | `NOT NULL, FK(positions.id, CASCADE)` | Contested position |
| `name` | `VARCHAR(255)` | `NOT NULL` | Candidate full name |
| `biography` | `TEXT` | `NULL` | Short biography |
| `manifesto_url` | `VARCHAR(500)` | `NULL` | Link to candidate platform / statement |
| `photo_url` | `VARCHAR(500)` | `NULL` | Avatar / portrait photo URL |
| `display_order` | `INTEGER` | `NOT NULL, DEFAULT 0` | Display rank on ballot |
| `status` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'active'` | `active`, `withdrawn`, `disqualified` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Update timestamp |

*Indexes:* `ix_candidates_position_id` (`position_id`).

---

#### `candidate_applications`
Candidate nomination and vetting applications.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Application ID |
| `position_id` | `UUID` | `NOT NULL, FK(positions.id, CASCADE)` | Position applied for |
| `user_id` | `UUID` | `NOT NULL` | Applicant user UUID |
| `statement` | `TEXT` | `NOT NULL` | Candidate platform statement |
| `supporting_docs` | `JSONB` | `NOT NULL, DEFAULT '[]'` | Array of document links |
| `review_status` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'submitted'` | `submitted`, `under_review`, `approved`, `rejected` |
| `reviewed_by` | `UUID` | `NULL` | Reviewing manager UUID |
| `reviewed_at` | `TIMESTAMPTZ` | `NULL` | Review decision timestamp |
| `review_notes` | `TEXT` | `NULL` | Internal justification |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Application submission timestamp |

---

#### `eligibility_rules`
Dynamic scoping criteria for election and position eligibility.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Rule ID |
| `election_id` | `UUID` | `NOT NULL, FK(elections.id, CASCADE)` | Parent election |
| `position_id` | `UUID` | `NULL, FK(positions.id, CASCADE)` | Position (or null for election-wide) |
| `rule_type` | `VARCHAR(50)` | `NOT NULL` | `voter_group`, `domain_match`, `csv_roll` |
| `rule_config` | `JSONB` | `NOT NULL, DEFAULT '{}'` | Matching parameters |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Creation timestamp |

---

#### `election_approvals`
Multi-signature sign-offs for election lifecycle gates.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Approval record ID |
| `election_id` | `UUID` | `NOT NULL, FK(elections.id, CASCADE)` | Target election |
| `approval_type` | `VARCHAR(50)` | `NOT NULL` | `launch`, `tally`, `publication` |
| `approver_user_id`| `UUID` | `NOT NULL` | Signing user UUID |
| `decision` | `VARCHAR(50)` | `NOT NULL` | `approved`, `rejected` |
| `notes` | `TEXT` | `NULL` | Justification or comments |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Approval timestamp |

---

#### `election_results`
Deterministic certified vote tallies.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Result ID |
| `election_id` | `UUID` | `NOT NULL, FK(elections.id, CASCADE)` | Associated election |
| `result_version` | `INTEGER` | `NOT NULL, DEFAULT 1` | Increments on recounts (1, 2, ...) |
| `configuration_hash`| `VARCHAR(64)` | `NOT NULL` | Verified election config hash |
| `tally_algorithm_version`| `VARCHAR(32)` | `NOT NULL, DEFAULT '1.0'` | Algorithm identifier |
| `ballot_count` | `INTEGER` | `NOT NULL` | Total valid ballots counted |
| `result_data` | `JSONB` | `NOT NULL` | Breakdown of votes, percentages, winners |
| `computed_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Computation timestamp |
| `computed_by` | `UUID` | `NULL` | User or system actor initiating tally |
| `approval_status` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'pending'` | `pending`, `approved`, `disputed` |
| `published_at` | `TIMESTAMPTZ` | `NULL` | Release timestamp |

*Constraints:* `UNIQUE(election_id, result_version)` (`uq_election_result_version`).

---

#### `recount_requests`
Dispute and formal recount audit trail.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Recount request ID |
| `election_id` | `UUID` | `NOT NULL, FK(elections.id, CASCADE)` | Contested election |
| `requester_user_id`| `UUID` | `NOT NULL` | User requesting recount |
| `reason` | `TEXT` | `NOT NULL` | Formal reason/justification |
| `status` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'pending'` | `pending`, `accepted`, `rejected`, `completed` |
| `resulting_result_id`| `UUID` | `NULL, FK(election_results.id)` | Result version produced by recount |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Request timestamp |
| `resolved_at` | `TIMESTAMPTZ` | `NULL` | Resolution timestamp |

---

#### `report_exports`
Audit log of generated reports and downloadable deliverables.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Report record ID |
| `election_id` | `UUID` | `NOT NULL, FK(elections.id, CASCADE)` | Target election |
| `report_type` | `VARCHAR(50)` | `NOT NULL` | `summary`, `turnout`, `certified_results`, `audit_trail` |
| `file_format` | `VARCHAR(10)` | `NOT NULL` | `pdf`, `csv`, `json` |
| `file_url` | `VARCHAR(500)` | `NOT NULL` | Secure access URL |
| `generated_by` | `UUID` | `NOT NULL` | Requesting user UUID |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Generation timestamp |

---

#### `election_audit_events`
Audit log for administrative and lifecycle events within `election_db`.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Event ID |
| `election_id` | `UUID` | `NOT NULL, FK(elections.id, CASCADE)` | Related election |
| `actor_id` | `UUID` | `NULL` | User UUID performing action |
| `action` | `VARCHAR(100)` | `NOT NULL` | Action code (e.g., `election.open`, `tally.approve`) |
| `outcome` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'SUCCESS'` | `SUCCESS`, `FAILURE`, `DENIED` |
| `metadata` | `JSONB` | `NOT NULL, DEFAULT '{}'` | Non-sensitive context |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Event timestamp |

---

## 4. Database 3: `ballot_db` (Anonymous Secret Ballot Storage)

### 4.1 Entity Relationship Model
```
ballot_credential_redemptions (Atomic Single-Use Token Redemption)

ballots (Anonymous Encrypted Ballot)
  └──────────< ballot_choices (Candidate Selections)
```

### 4.2 Table Definitions

#### `ballot_credential_redemptions`
Atomic single-use token redemption table preventing duplicate voting.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Redemption ID |
| `election_id` | `UUID` | `NOT NULL` | Target election UUID |
| `credential_hash` | `VARCHAR(64)` | `NOT NULL, UNIQUE` | SHA-256 hash of single-use bearer token |
| `redeemed_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Redemption timestamp |
| `status` | `VARCHAR(32)` | `NOT NULL, DEFAULT 'accepted'` | `accepted`, `rejected` |

*Constraints:* `UNIQUE(election_id, credential_hash)` (`uq_redemption_election_hash`).  
*Indexes:* `ix_redemptions_hash` (`credential_hash`), `ix_redemptions_election` (`election_id`).

---

#### `ballots`
Anonymous ballot records containing zero identity information.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Ballot ID (unlinked to voter) |
| `election_id` | `UUID` | `NOT NULL` | Target election UUID |
| `configuration_hash`| `VARCHAR(64)` | `NOT NULL` | Election configuration SHA-256 hash at vote time |
| `ballot_payload` | `JSONB` | `NOT NULL` | Serialized candidate choices |
| `accepted_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Timestamp of ballot acceptance |
| `integrity_metadata`| `JSONB` | `NULL` | Cryptographic signature of ballot hash |

*Indexes:* `ix_ballots_election_id` (`election_id`).

---

#### `ballot_choices`
Relational decomposition of ballot choices for deterministic tally processing.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Choice ID |
| `ballot_id` | `UUID` | `NOT NULL, FK(ballots.id, CASCADE)` | Parent anonymous ballot |
| `position_id` | `UUID` | `NOT NULL` | Position contested |
| `candidate_id` | `UUID` | `NULL` | Candidate chosen (or null if abstention) |

*Indexes:* `ix_ballot_choices_ballot_id` (`ballot_id`), `ix_ballot_choices_position_id` (`position_id`), `ix_ballot_choices_candidate_id` (`candidate_id`).

---

## 5. Security Invariant Matrix

| Security Rule | Enforcement Mechanism |
| :--- | :--- |
| **No cross-database linkage** | PostgreSQL user grants restrict `ballot_user` to `ballot_db` only. |
| **No voter ID on ballots** | `ballots` table DDL contains zero user, identity, or network columns. |
| **Duplicate vote prevention** | Unique index on `ballot_credential_redemptions(credential_hash)` guarantees single redemption. |
| **Configuration integrity** | Ballots with `configuration_hash` not matching frozen election config are rejected. |
| **Audit separation** | Audit events log administrative actions, never ballot contents. |

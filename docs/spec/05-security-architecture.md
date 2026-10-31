# Pollwise — Security, Privacy & Ballot Assurance Architecture Specification

**Document:** 05-security-architecture.md  
**Status:** Authoritative  
**Domain:** Security Architecture, Cryptography, Privacy Preserving Protocols & Assurance  
**Compliance Standards:** OWASP Top 10, WCAG 2.1 AA, NIST SP 800-63B  

---

## 1. Core Security Principles

Pollwise is engineered from the ground up for high-assurance institutional elections. The architecture balances voter eligibility verification, election integrity, and absolute ballot secrecy.

```
       Voter Identity Layer                 Decoupled Token                     Isolated Ballot-Box
      ┌─────────────────────┐            ┌────────────────────┐              ┌──────────────────────┐
      │     identity_db     │            │    Blind Bearer    │              │      ballot_db       │
      │                     │ ─────────> │     Credential     │ ───────────> │                      │
      │ User Identity       │   Issues   │                    │   Redeems    │ Anonymous Ballots    │
      │ Eligibility Status  │            │ "bb_7a9f8b1c..."   │              │ Zero Voter Metadata  │
      │ Entitlement Usage   │            │                    │              │ Single-Use Tokens    │
      └─────────────────────┘            └────────────────────┘              └──────────────────────┘
                 │                                                                      │
                 ▼                                                                      ▼
       Admin Visibility Only                                                  Tally Officer Only
       (Knows WHO can vote)                                                   (Counts WHAT was voted)
       CANNOT SEE BALLOTS                                                     CANNOT SEE IDENTITIES
```

---

## 2. Ballot Secrecy & Isolated Ballot-Box Protocol

### 2.1 The Two-Stage Voting Protocol
To eliminate any direct linkage between voter identity and cast ballots, Pollwise decouples voter authorization from ballot acceptance into two separate transactions:

#### Stage 1: Credential Issuance (`POST /api/v1/elections/{id}/voting-credential`)
1. Voter authenticates with active session credentials.
2. Backend verifies voter eligibility in `identity_db`:
   - Account status is `active` and email is verified.
   - Voter is in eligible voter group for the election.
   - Voter has not already voted (`entitlement_status == 'unused'`).
   - Election lifecycle status is `open`.
3. System generates a cryptographically random, high-entropy 256-bit blind bearer token (`bb_<64 hex chars>`).
4. System computes SHA-256 hash of the token (`credential_hash`).
5. System marks the voter's entitlement status as `issued` and records `credential_hash` in `identity_db.voting_credentials`.
6. Raw bearer token is returned to voter client over TLS. The token is never logged or stored in plaintext on the server.

#### Stage 2: Anonymous Ballot Submission (`POST /ballot-box/v1/ballots`)
1. Client browser strips all session cookies (`pollwise_session`), user authorization headers, and identifying request metadata.
2. Client submits payload containing:
   - Target `election_id`
   - Single-use bearer token (`voting_credential`)
   - Current election `configuration_hash`
   - Position candidate choices
3. The isolated ballot-box service validates the request against strict hygiene invariants:
   - **Cookie Guard:** If `pollwise_session` cookie is present, request is immediately rejected with HTTP 422.
   - **Header Guard:** If non-bearer authorization headers are present, request is rejected.
   - **Payload Guard:** If any voter name, email, or user ID field is present, request is rejected.
4. The service begins an atomic transaction in `ballot_db`:
   - Checks `ballot_credential_redemptions` for `credential_hash`. If already present, transaction aborts (`BALLOT_ALREADY_ACCEPTED`).
   - Inserts `credential_hash` with timestamp into `ballot_credential_redemptions`.
   - Verifies submitted `configuration_hash` matches frozen election configuration.
   - Inserts ballot payload into `ballots` and choices into `ballot_choices`.
5. Transaction commits.
6. A participation receipt hash is returned to the client.

### 2.2 Mitigation of Timing and Metadata Correlation
Separating database tables alone does not guarantee privacy if an adversary can correlate database insertion timestamps. Pollwise implements structural timing defenses:
- **Jittered Batch Buffering:** In high-concurrency environments, incoming ballots are queued in a transient memory buffer and shuffled before bulk insertion.
- **Microsecond Timestamp Stripping:** Stored ballot acceptance timestamps are truncated to minutes or generic intervals to prevent correlated millisecond timestamp analysis.
- **Connection Segregation:** Ballot-box requests execute over dedicated database connection pools distinct from identity session queries.

---

## 3. Multi-Database Security Boundaries

Pollwise uses three physically isolated PostgreSQL databases. The system enforces least-privilege database user credentials:

| Database Role | Database Access | Permitted Operations | Forbidden Operations |
| :--- | :--- | :--- | :--- |
| `identity_user` | `identity_db` | Full CRUD on users, sessions, orgs, eligibility | Zero access to `ballot_db` or `election_db` |
| `election_user` | `election_db` | Full CRUD on elections, candidates, results | Zero access to `ballot_db` |
| `ballot_user` | `ballot_db` | Insert-only on ballots, choices, redemptions | Zero access to `identity_db` or `election_db` |
| `tally_ro_user` | `ballot_db` | Read-only `SELECT` during tally calculation | Zero write access; zero access to `identity_db` |

*Invariant:* Even if an attacker obtains full SQL injection in the administrative portal (`election_db`), PostgreSQL role permissions prevent querying or corrupting `ballot_db`.

---

## 4. Authentication & Session Management

### 4.1 Password Security
- Passwords hashed using **Argon2id** (`time_cost=3`, `memory_cost=65536` KiB, `parallelism=4`).
- Minimum password length: 8 characters with upper, lower, numeric, and symbol complexity requirements.
- Zero plaintext password storage; password hashes never returned in API payloads.

### 4.2 Session Management
- Sessions tracked via HTTP-only, secure, SameSite=Lax cookies (`pollwise_session`).
- Dual timeout mechanism:
  - **Sliding Idle Timeout:** 60 minutes of inactivity revokes session.
  - **Absolute Expiration:** 12 hours from initial sign-in enforces re-authentication.
- Instant Revocation:
  - Password change revokes all active sessions for the user.
  - Users can review all active sessions (IP, device type, last activity) and revoke them individually or globally.

---

## 5. Role-Based Access Control (RBAC) Matrix

Permissions are enforced on every backend request:

| Capability | Platform Super Admin | Institution Owner | Institution Admin | Election Manager | Candidate | Voter | Auditor |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `platform.manage` | Yes | No | No | No | No | No | No |
| `institution.verify` | Yes | No | No | No | No | No | No |
| `institution.manage` | Read | Yes | Yes | No | No | No | Read |
| `team.invite` | No | Yes | Yes | No | No | No | No |
| `election.create` | No | Yes | Yes | Yes | No | No | No |
| `election.edit_draft` | No | Yes | Yes | Yes (assigned)| No | No | No |
| `election.freeze_schedule`| No | Yes | Yes | Yes (assigned)| No | No | No |
| `election.emergency_pause`| No | Yes | Yes | Yes (assigned)| No | No | No |
| `election.close` | No | Yes | Yes | Yes (assigned)| No | No | No |
| `candidate.review` | No | Yes | Yes | Yes (assigned)| No | No | Read |
| `candidate.edit_profile` | No | No | No | No | Yes (own) | No | No |
| `voter.import_csv` | No | Yes | Yes | Yes (assigned)| No | No | No |
| `voting.claim_credential`| No | No | No | No | No | Yes (eligible)| No |
| `voting.submit_ballot` | No | No | No | No | No | Bearer Token | No |
| `tally.calculate` | No | Yes | Yes | Yes (assigned)| No | No | No |
| `tally.approve` | No | Yes | Yes (distinct)| No | No | No | Yes |
| `results.publish` | No | Yes | Yes | Yes (approved)| No | No | No |
| `recount.request` | No | Yes | Yes | Yes | No | No | Yes |
| `audit.view_logs` | Yes (all)| Yes | Yes | Yes (assigned)| No | No | Yes |
| `reports.export` | Yes | Yes | Yes | Yes | No | No | Yes |

---

## 6. Audit Logging Invariants

Audit logs provide an immutable chronicle of all administrative actions:
1. **Append-Only Store:** Audit log tables (`identity_audit_events` and `election_audit_events`) permit `INSERT` and `SELECT` only. Updates and deletions are blocked by PostgreSQL database triggers.
2. **Actor Accountability:** Every event records `actor_id`, client `ip_address`, `user_agent`, and target `election_id`.
3. **Strict Redaction Invariant:** Audit log payloads must **never** contain:
   - Plaintext passwords or session secrets
   - Single-use voting bearer tokens
   - Individual candidate selections or voter ballot choices

---

## 7. Threat Model & Security Mitigations

### 7.1 Threat: Ballot Stuffing & Duplicate Voting
- *Attack Vector:* Malicious voter or compromised client attempts to submit multiple ballots.
- *Mitigation:* Single-use voting credentials. The token hash is atomically written to `ballot_credential_redemptions` under a PostgreSQL unique constraint. Second attempts collide and are aborted immediately.

### 7.2 Threat: Ballot Secrecy Violation by Malicious Administrator
- *Attack Vector:* Administrator inspects database records to identify how specific faculty members or students voted.
- *Mitigation:* `ballot_db` contains zero voter identity columns, IP addresses, or user IDs. The bearer token submitted with the ballot is cryptographically blind; `identity_db` only stores whether a token was issued, not which ballot it created.

### 7.3 Threat: Administrator Tampering with Live Vote Totals
- *Attack Vector:* Election Manager alters candidate votes during active voting.
- *Mitigation:* Ballots are stored as immutable records in `ballot_db` (accessible only by `ballot_user`). Vote tallies are computed only after the election is closed. The tally algorithm verifies that the count matches the frozen SHA-256 configuration hash.

### 7.4 Threat: Early Result Disclosure
- *Attack Vector:* Administrator queries interim vote counts while an election is open to influence turnout.
- *Mitigation:* The API does not compute or expose candidate vote counts while an election is in `open` status. Only aggregate turnout percentages (without candidate distributions) are exposed to monitoring dashboards.

### 7.5 Threat: Denial of Service & Rate-Limiting Abuse
- *Attack Vector:* Botnet floods login or ballot endpoints.
- *Mitigation:* Sliding window rate limiters (in-memory / Redis):
  - Login: 10 requests / minute per IP.
  - Credential issuance: 5 requests / minute per user.
  - Ballot submission: 20 requests / minute per IP.

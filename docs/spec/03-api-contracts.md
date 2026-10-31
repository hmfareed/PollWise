# Pollwise — Complete REST API & Ballot-Box Contracts Specification

**Document:** 03-api-contracts.md  
**Status:** Authoritative  
**Base URLs:**  
- Main API: `http://localhost:8000/api/v1`  
- Isolated Ballot-Box API: `http://localhost:8000/ballot-box/v1`  
**Data Format:** JSON (`application/json`)  
**Auth:** HTTP-only secure cookie session (`pollwise_session`) or single-use blind token for ballot submission.

---

## 1. General Conventions & Standards

1. **Identifiers:** All entity IDs are RFC 4122 Version 4 UUID strings (`[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}`).
2. **Timestamps:** ISO 8601 UTC timestamps with explicit offset (e.g. `2026-10-31T12:00:00Z`).
3. **Response Envelope:** Every API response adheres to the standard Pollwise envelope:
   ```json
   {
     "data": { ... } | [ ... ] | null,
     "meta": {
       "page": 1,
       "page_size": 20,
       "total_records": 100,
       "total_pages": 5
     },
     "error": null | {
       "code": "ERROR_CODE_STRING",
       "message": "Human readable description",
       "details": [ ... ]
     }
   }
   ```
4. **Standard Error Codes:**
   - `UNAUTHORIZED`: Authentication required or session expired.
   - `FORBIDDEN`: Role or permissions insufficient for action.
   - `NOT_FOUND`: Resource does not exist.
   - `VALIDATION_ERROR`: Malformed input payload.
   - `ELECTION_NOT_OPEN`: Attempt to vote in an election that is not open.
   - `ALREADY_VOTED`: Entitlement token already claimed or used.
   - `BALLOT_ALREADY_ACCEPTED`: Bearer credential already redeemed in `ballot_db`.
   - `IDENTITY_FIELD_REJECTED`: Ballot submission contained forbidden cookies, headers, or voter metadata.
   - `CONFIGURATION_LOCKED`: Attempt to edit an election after scheduling/opening.

---

## 2. Authentication & Account Management (`/api/v1/auth`)

### 2.1 `POST /auth/register`
Register a personal voter account or start institution onboarding.

**Request Body:**
```json
{
  "account_type": "personal", // "personal" | "institution"
  "email": "voter@polytechnic.edu",
  "password": "SecurePassword123!",
  "confirm_password": "SecurePassword123!",
  "display_name": "Maya Patel",
  "phone": "+15551234567", // optional
  "institution_name": "Northwestern Poly", // required if account_type == "institution"
  "institution_type": "university", // required if account_type == "institution"
  "country": "United States" // required if account_type == "institution"
}
```

**Response (`201 Created`):**
```json
{
  "data": {
    "user_id": "cdd0d42f-bf38-4e3c-9aa7-0cb2e8c472b0",
    "email": "voter@polytechnic.edu",
    "display_name": "Maya Patel",
    "account_status": "unverified",
    "verification_email_sent": true
  },
  "meta": null,
  "error": null
}
```

---

### 2.2 `POST /auth/login`
Authenticate with email and password to create an HTTP-only secure session.

**Request Body:**
```json
{
  "email": "voter@polytechnic.edu",
  "password": "SecurePassword123!"
}
```

**Response (`200 OK`):**
*Sets `Set-Cookie: pollwise_session=...; HttpOnly; Secure; SameSite=Lax; Path=/`*
```json
{
  "data": {
    "user_id": "cdd0d42f-bf38-4e3c-9aa7-0cb2e8c472b0",
    "email": "voter@polytechnic.edu",
    "display_name": "Maya Patel",
    "is_platform_admin": false,
    "memberships": [
      {
        "organization_id": "63add525-2ca5-4cc0-b759-2c49a9ab8836",
        "organization_name": "Northwestern Poly",
        "role": "member",
        "status": "active"
      }
    ]
  },
  "meta": null,
  "error": null
}
```

---

### 2.3 `POST /auth/logout`
Revoke the current session and clear the session cookie.

**Response (`200 OK`):**
*Clears `pollwise_session` cookie.*
```json
{
  "data": { "revoked": true },
  "meta": null,
  "error": null
}
```

---

### 2.4 `GET /auth/me`
Retrieve currently authenticated user identity and active institutional memberships.

**Response (`200 OK`):**
```json
{
  "data": {
    "user_id": "cdd0d42f-bf38-4e3c-9aa7-0cb2e8c472b0",
    "email": "voter@polytechnic.edu",
    "display_name": "Maya Patel",
    "email_verified": true,
    "is_platform_admin": false,
    "memberships": [
      {
        "organization_id": "63add525-2ca5-4cc0-b759-2c49a9ab8836",
        "role": "election_manager",
        "status": "active",
        "permissions": ["election.create", "election.manage"]
      }
    ]
  },
  "meta": null,
  "error": null
}
```

---

### 2.5 `POST /auth/verify-email`
Confirm email verification token.

**Request Body:**
```json
{
  "token": "a4f89b02c814..."
}
```

**Response (`200 OK`):**
```json
{
  "data": { "verified": true, "email": "voter@polytechnic.edu" },
  "meta": null,
  "error": null
}
```

---

### 2.6 `POST /auth/forgot-password` & `POST /auth/reset-password`
Request single-use recovery token and submit new password.

**Reset Request Body:**
```json
{
  "token": "e819ac21...",
  "new_password": "NewSecurePassword2026!",
  "confirm_password": "NewSecurePassword2026!"
}
```

---

## 3. Institution Management (`/api/v1/organizations`)

### 3.1 `GET /organizations` & `POST /organizations`
List visible institutions or create a new institution.

### 3.2 `GET /organizations/{id}` & `PATCH /organizations/{id}`
Retrieve or update institution profile, allowed domains, and branding.

### 3.3 `POST /organizations/{id}/members/import-csv`
Upload and ingest bulk voter roster via multipart form-data.

**Request:** `multipart/form-data` with `file: voters.csv`

**Response (`200 OK`):**
```json
{
  "data": {
    "total_rows_parsed": 500,
    "valid_rows_imported": 498,
    "duplicate_rows_skipped": 2,
    "invalid_rows_count": 0,
    "errors": []
  },
  "meta": null,
  "error": null
}
```

---

## 4. Election Management (`/api/v1/elections`)

### 4.1 `GET /elections`
List elections with filtering.

**Query Parameters:**
- `organization_id`: UUID (optional)
- `status`: `draft`, `scheduled`, `open`, `closed`, `tallied`, `published`, `archived`
- `page`: integer (default 1)
- `page_size`: integer (default 20)

**Response (`200 OK`):**
```json
{
  "data": [
    {
      "id": "f1e2b913-0217-4c33-ab26-fc097792239d",
      "organization_id": "63add525-2ca5-4cc0-b759-2c49a9ab8836",
      "title": "2026 Student Union General Election",
      "status": "open",
      "opens_at": "2026-10-30T09:00:00Z",
      "closes_at": "2026-11-06T17:00:00Z",
      "timezone": "UTC",
      "total_eligible_voters": 1250,
      "total_ballots_cast": 420,
      "turnout_percentage": 33.6
    }
  ],
  "meta": { "page": 1, "page_size": 20, "total_records": 1, "total_pages": 1 },
  "error": null
}
```

---

### 4.2 `POST /elections`
Create a draft election.

**Request Body:**
```json
{
  "organization_id": "63add525-2ca5-4cc0-b759-2c49a9ab8836",
  "title": "Faculty Senate Representative Election 2026",
  "description": "Annual elections for academic faculty representation.",
  "timezone": "UTC",
  "opens_at": "2026-11-10T09:00:00Z",
  "closes_at": "2026-11-15T17:00:00Z",
  "voting_method": "single_choice_per_position"
}
```

---

### 4.3 `POST /elections/{id}/schedule`
Freeze election configuration and schedule for opening.

**Response (`200 OK`):**
```json
{
  "data": {
    "election_id": "f1e2b913-0217-4c33-ab26-fc097792239d",
    "status": "scheduled",
    "configuration_version": 1,
    "configuration_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "opens_at": "2026-11-10T09:00:00Z"
  },
  "meta": null,
  "error": null
}
```

---

### 4.4 Lifecycle Control Actions
- `POST /elections/{id}/open`: Transition to `open` (validates start window).
- `POST /elections/{id}/pause`: Emergency halt.
- `POST /elections/{id}/resume`: Resume from pause.
- `POST /elections/{id}/close`: Conclude voting.
- `POST /elections/{id}/cancel`: Abort election with reason payload.

---

## 5. Positions & Candidates

### 5.1 `GET /elections/{id}/positions` & `POST /elections/{id}/positions`
Create and inspect election positions.

**Position Creation Body:**
```json
{
  "title": "Union President",
  "description": "Executive student leadership.",
  "min_selections": 1,
  "max_selections": 1,
  "display_order": 0
}
```

---

### 5.2 `GET /positions/{id}/candidates` & `POST /positions/{id}/candidates`
Create approved candidate or list position candidates.

---

### 5.3 `POST /positions/{id}/apply`
Submit candidate nomination application.

**Request Body:**
```json
{
  "statement": "I pledge to expand 24-hour campus study centers...",
  "supporting_docs": ["https://cdn.pollwise.org/docs/manifesto.pdf"]
}
```

---

### 5.4 `PATCH /candidates/{id}/review`
Review candidate application.

**Request Body:**
```json
{
  "status": "approved", // "approved" | "rejected"
  "review_notes": "All academic eligibility criteria verified."
}
```

---

## 6. Voter Booth & Blind Token Protocol

### 6.1 `GET /voter/elections`
List elections where current voter is eligible.

---

### 6.2 `GET /voter/elections/{id}/ballot-spec`
Retrieve ballot structure for an active election.

**Response (`200 OK`):**
```json
{
  "data": {
    "election_id": "f1e2b913-0217-4c33-ab26-fc097792239d",
    "title": "2026 Student Union General Election",
    "configuration_hash": "e3b0c442...",
    "positions": [
      {
        "position_id": "open_pos1_id",
        "title": "Union President",
        "min_selections": 1,
        "max_selections": 1,
        "candidates": [
          { "candidate_id": "cand_1", "name": "Maya Patel", "biography": "..." },
          { "candidate_id": "cand_2", "name": "Jordan Lee", "biography": "..." }
        ]
      }
    ]
  },
  "meta": null,
  "error": null
}
```

---

### 6.3 `POST /elections/{id}/voting-credential`
Issue single-use blind voting bearer token to eligible voter.

**Response (`200 OK`):**
```json
{
  "data": {
    "election_id": "f1e2b913-0217-4c33-ab26-fc097792239d",
    "voting_credential": "bb_7a9f8b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a",
    "expires_at": "2026-11-06T17:00:00Z"
  },
  "meta": null,
  "error": null
}
```

---

## 7. Isolated Ballot-Box API (`/ballot-box/v1/ballots`)

### 7.1 `POST /ballot-box/v1/ballots`
Submit secret ballot into `ballot_db`.

**Boundary Enforcement Rules:**
1. Requests containing `pollwise_session` cookie are immediately rejected with HTTP 422 (`IDENTITY_FIELD_REJECTED`).
2. Requests containing standard `Authorization: Bearer <user_jwt>` are rejected.
3. Payload must contain zero voter identifiers.

**Request Body:**
```json
{
  "election_id": "f1e2b913-0217-4c33-ab26-fc097792239d",
  "voting_credential": "bb_7a9f8b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a",
  "configuration_hash": "e3b0c442...",
  "selections": [
    {
      "position_id": "open_pos1_id",
      "candidate_id": "cand_1"
    }
  ]
}
```

**Response (`201 Created`):**
```json
{
  "data": {
    "status": "accepted",
    "accepted_at": "2026-10-31T12:00:00Z",
    "receipt_hash": "9c1a5b4e3f2d1c0b8a7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a"
  },
  "meta": null,
  "error": null
}
```

---

## 8. Tally, Review & Results (`/api/v1/elections/{id}/...`)

### 8.1 `POST /elections/{id}/tally`
Trigger deterministic vote tally for a closed election.

### 8.2 `GET /elections/{id}/results`
Retrieve certified tally results.

**Response (`200 OK`):**
```json
{
  "data": {
    "election_id": "f1e2b913-0217-4c33-ab26-fc097792239d",
    "result_version": 1,
    "total_ballots": 485,
    "approval_status": "approved",
    "published_at": "2026-11-07T12:00:00Z",
    "positions": [
      {
        "position_id": "open_pos1_id",
        "title": "Union President",
        "total_votes": 485,
        "abstain_count": 5,
        "candidates": [
          { "candidate_id": "cand_1", "name": "Maya Patel", "votes": 310, "percentage": 63.92 },
          { "candidate_id": "cand_2", "name": "Jordan Lee", "votes": 170, "percentage": 35.05 }
        ],
        "winner_ids": ["cand_1"]
      }
    ]
  },
  "meta": null,
  "error": null
}
```

---

### 8.3 `POST /elections/{id}/results/approve`
Record multi-signature approval of tally.

**Request Body:**
```json
{
  "approval_type": "tally",
  "decision": "approved",
  "notes": "Verified against ballot totals and reconciliation report."
}
```

---

### 8.4 `POST /elections/{id}/results/publish`
Release certified results to voters and public.

---

### 8.5 `POST /elections/{id}/recount`
Initiate formal recount against preserved ballots.

**Request Body:**
```json
{
  "reason": "Auditor requested recalculation due to tie resolution dispute."
}
```

---

## 9. Role-Based Access Control (RBAC) Matrix

| Endpoint Group | Super Admin | Inst. Owner | Inst. Admin | Elec. Manager | Candidate | Voter | Auditor |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Auth & Profile** | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **Platform Settings** | Yes | No | No | No | No | No | No |
| **Institution Settings**| Read | Yes | Yes | No | No | No | Read |
| **Create Elections** | No | Yes | Yes | Yes (if assigned)| No | No | No |
| **Edit Draft Elections**| No | Yes | Yes | Yes (if assigned)| No | No | No |
| **Open / Close Elections**| No | Yes | Yes | Yes (if assigned)| No | No | No |
| **Manage Candidates** | No | Yes | Yes | Yes (if assigned)| Profile Only | No | Read |
| **Manage Voter Roll** | No | Yes | Yes | Yes (if assigned)| No | No | Read |
| **Claim Ballot Credential**| No | No | No | No | No | Yes (Eligible)| No |
| **Submit Anonymous Ballot**| No | No | No | No | No | Bearer Token Only | No |
| **Compute Tally** | No | Yes | Yes | Yes (if assigned)| No | No | No |
| **Approve Tally** | No | Yes | Yes (Distinct) | No | No | No | Yes |
| **Publish Results** | No | Yes | Yes | Yes (if approved)| No | No | No |
| **View Audit Logs** | Yes (Platform)| Yes | Yes | Yes (Election) | No | No | Yes |
| **Export Reports** | Yes | Yes | Yes | Yes | No | No | Yes |

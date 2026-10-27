# 04 — Identity Database Schema (`identity_db`)

## users

| Field | Notes |
| --- | --- |
| `id` | UUID primary key |
| `email_normalized` | unique, non-null |
| `password_hash` | Argon2id hash |
| `display_name` | non-null |
| `email_verified_at` | nullable timestamp |
| `account_status` | pending, active, suspended, disabled |
| `created_at`, `updated_at` | timestamps |

Requirements: never store plaintext passwords; normalize emails consistently; database uniqueness constraints; do not expose internal account fields in public API responses.

## organizations

| Field | Notes |
| --- | --- |
| `id` | UUID primary key |
| `name` | organization name |
| `slug` | unique identifier |
| `status` | active or suspended |
| `created_at` | timestamp |

## organization_memberships

| Field | Notes |
| --- | --- |
| `id` | UUID primary key |
| `organization_id` | FK → organizations |
| `user_id` | FK → users |
| `role` | organization_admin, election_manager, auditor, member |
| `status` | invited, active, suspended, removed |
| `created_at` | timestamp |

Constraints: unique `(organization_id, user_id)`; roles cannot be self-assigned by ordinary users.

## election_eligibility

| Field | Notes |
| --- | --- |
| `id` | UUID primary key |
| `election_id` | election identifier |
| `user_id` | FK → users |
| `eligibility_status` | eligible, suspended, revoked |
| `entitlement_status` | unused, issued, redeemed, revoked |
| `eligible_from`, `eligible_until` | nullable timestamps |
| `created_at` | timestamp |

Constraints:

- Unique `(election_id, user_id)`.
- Only authorized services change eligibility or entitlement status.
- Every state change follows a documented transition policy.
- Once a credential is issued, eligibility changes follow a controlled revocation procedure.

Records eligibility and participation status — **not** ballot selections.

## voting_credentials

| Field | Notes |
| --- | --- |
| `id` | UUID primary key |
| `election_id` | election identifier |
| `eligibility_id` | FK → election_eligibility |
| `credential_hash` | hash of the high-entropy credential, where applicable |
| `status` | issued, redeemed, revoked, expired |
| `issued_at` | timestamp |
| `expires_at` | nullable timestamp |

Constraints:

- Unique credential hash.
- Unique credential issuance per entitlement unless an approved replacement procedure exists.
- No plaintext credential persistence.
- No voter-identifying information sent to the ballot-box service.

The ballot-box maintains its own redemption state. Do not expose its redemption records to ordinary identity administrators.

## Entitlement state transitions

| From | To | Trigger |
| --- | --- | --- |
| unused | issued | Eligible voter obtains credential |
| issued | redeemed | Ballot accepted (confirmed to identity service) |
| unused / issued | revoked | Controlled revocation procedure (audited) |

`redeemed` is terminal.

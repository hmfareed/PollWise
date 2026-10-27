# 06 — Ballot Database Schema (`ballot_db`)

## ballot_credential_redemptions

| Field | Notes |
| --- | --- |
| `id` | UUID primary key |
| `election_id` | UUID |
| `credential_hash` | unique, election-scoped credential hash |
| `redeemed_at` | operational timestamp |
| `status` | accepted or rejected |

Must not contain voter IDs or email addresses.

Redemption and ballot acceptance are atomic from the ballot-box's perspective. If the ballot cannot be stored, the credential must not be irreversibly consumed unless a documented recovery protocol exists.

## ballots

| Field | Notes |
| --- | --- |
| `id` | random UUID primary key |
| `election_id` | UUID |
| `configuration_hash` | hash of the election configuration |
| `ballot_payload` | structured candidate selections |
| `accepted_at` | nullable or coarsened timestamp, only if needed |
| `integrity_metadata` | approved non-identifying integrity data |

The schema must **not** contain: `voter_id`, `user_id`, email address, identity-provider subject, raw voting credential, or a direct foreign key to an identity/eligibility record. Ballot identifiers must not encode the voter or credential identifier.

## ballot_choices

| Field | Notes |
| --- | --- |
| `id` | UUID primary key |
| `ballot_id` | FK → ballots |
| `position_id` | UUID |
| `candidate_id` | UUID |

Constraints:

- No duplicate candidate selection within the same position and ballot.
- Candidate and position belong to the same frozen election configuration.
- All selections satisfy configured ballot rules.

Alternatively store the whole ballot payload as a validated, versioned JSON document. Either way: strict schema validation and deterministic tallying.

## Database consistency

Use transactions for credential redemption, ballot insertion, ballot-choice insertion, and acceptance confirmation. Use database uniqueness constraints to enforce one-time credential use. Never rely on a frontend disabled button or a backend check-then-insert sequence.

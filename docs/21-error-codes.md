# 21 — Error Codes (Added)

| Code | HTTP | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 422 | Schema or rule validation failed |
| `MALFORMED_REQUEST` | 400 | Request could not be parsed |
| `UNAUTHENTICATED` | 401 | Login required |
| `SESSION_EXPIRED` | 401 | Session timed out |
| `REAUTH_REQUIRED` | 401 | Sensitive action needs recent authentication |
| `FORBIDDEN` | 403 | Insufficient permission |
| `NOT_FOUND` | 404 | Missing or undisclosed resource |
| `EMAIL_NOT_VERIFIED` | 403 | Email not verified |
| `NOT_ELIGIBLE` | 403 | Not eligible for this election |
| `CREDENTIAL_ALREADY_ISSUED` | 409 | Entitlement already has a credential |
| `ELECTION_NOT_OPEN` | 409 | Election not open yet |
| `ELECTION_CLOSED` | 409 | Election no longer accepts ballots |
| `INVALID_STATE_TRANSITION` | 409 | Lifecycle transition not allowed |
| `CONFIG_LOCKED` | 409 | Configuration frozen |
| `CREDENTIAL_INVALID` | 401 | Malformed, unknown, expired, or revoked credential |
| `CREDENTIAL_WRONG_ELECTION` | 403 | Credential scoped to a different election |
| `BALLOT_ALREADY_ACCEPTED` | 409 | Entitlement already used |
| `BALLOT_INVALID` | 422 | Selections violate ballot rules |
| `CONFIG_HASH_MISMATCH` | 409 | Ballot built against a different configuration |
| `IDEMPOTENCY_CONFLICT` | 409 | Key reused with a different payload |
| `IDENTITY_FIELD_REJECTED` | 422 | Ballot-box payload contained identity fields |
| `APPROVAL_REQUIRED` | 409 | Required approval missing |
| `RESULTS_NOT_PUBLISHED` | 403 | Results not yet visible |
| `IMPORT_INVALID` | 422 | Voter import contains errors |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected failure (no internals exposed) |

Error responses must never reveal another voter's status or internal details.

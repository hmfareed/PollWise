# 09 — API Contracts

Base path: `/api/v1`

## Conventions

- JSON for ordinary bodies; multipart only for approved file-import workflows.
- UUID identifiers.
- Timezone-aware ISO 8601 timestamps.
- Pydantic validation.
- Consistent error response structure and stable error codes ([21-error-codes.md](21-error-codes.md)).
- Pagination on list endpoints.
- Rate limiting on authentication and sensitive operations.
- Idempotency keys on ballot submission.
- No sensitive fields in API responses.

## Authentication

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/auth/register` | Create an account |
| POST | `/auth/login` | Authenticate |
| POST | `/auth/logout` | Revoke the current session |
| GET | `/auth/me` | Return the current account |
| POST | `/auth/verify-email` | Verify an account |
| POST | `/auth/forgot-password` | Request password recovery |
| POST | `/auth/reset-password` | Complete password recovery |

## Organizations

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/organizations` | List organizations visible to the user |
| POST | `/organizations` | Create an organization if permitted |
| GET | `/organizations/{id}` | Retrieve an authorized organization |
| PATCH | `/organizations/{id}` | Update permitted fields |
| GET | `/organizations/{id}/members` | List authorized membership info |
| POST | `/organizations/{id}/members/import` | Start a validated member import |
| PATCH | `/organizations/{id}/members/{member_id}` | Update membership or role |

## Elections

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/elections` | List visible elections |
| POST | `/elections` | Create a draft |
| GET | `/elections/{id}` | Retrieve authorized details |
| PATCH | `/elections/{id}` | Update permitted draft fields |
| POST | `/elections/{id}/schedule` | Schedule a reviewed election |
| POST | `/elections/{id}/open` | Open an authorized election |
| POST | `/elections/{id}/close` | Close an election |
| POST | `/elections/{id}/cancel` | Cancel under the approved policy |
| GET | `/elections/{id}/positions` | List ballot positions |
| POST | `/elections/{id}/positions` | Add a position before the lock |
| PATCH | `/positions/{id}` | Update a permitted draft position |
| POST | `/positions/{id}/candidates` | Add a candidate |
| PATCH | `/candidates/{id}` | Update a permitted candidate |
| DELETE | `/candidates/{id}` | Remove a candidate before the lock |

## Eligibility

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/elections/{id}/eligibility` | View authorized eligibility info |
| POST | `/elections/{id}/eligibility` | Add eligible members |
| POST | `/elections/{id}/eligibility/import` | Import an approved voter list |
| DELETE | `/elections/{id}/eligibility/{record_id}` | Revoke eligibility when permitted |
| GET | `/elections/{id}/eligibility/imports/{job_id}` | View import status |

Do not expose eligibility lists to ordinary voters.

## Voting

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/elections/{id}/ballot` | Retrieve the current eligible ballot |
| POST | `/elections/{id}/voting-credential` | Obtain a single-use voting credential |
| POST | `/ballot-box/v1/ballots` | Submit a ballot to the isolated ballot-box service |
| GET | `/elections/{id}/participation/me` | Check current user's participation status |

The identity API must not expose ballot selections through the participation endpoint. The ballot-box API must not accept `user_id`, `email`, or a voter ID as proof of eligibility.

## Results and audit

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/elections/{id}/tally` | Request an authorized tally |
| GET | `/elections/{id}/results` | Results allowed by publication policy |
| POST | `/elections/{id}/results/{result_id}/approve` | Approve a tally |
| POST | `/elections/{id}/publish` | Publish an approved tally |
| POST | `/elections/{id}/recounts` | Request a recount |
| GET | `/elections/{id}/audit` | Retrieve authorized audit records |
| GET | `/elections/{id}/results/export` | Download an authorized report |

Do not expose ballot-box database tables through generic CRUD endpoints.

## Ballot submission contract

Conceptual request:

```json
{
  "election_id": "election-uuid",
  "credential": "single-use-credential",
  "selections": [
    { "position_id": "position-uuid-1", "candidate_ids": ["candidate-uuid-1"] },
    { "position_id": "position-uuid-2", "candidate_ids": ["candidate-uuid-4"] }
  ]
}
```

In implementation the election ID may be in the route, and the credential should be transmitted via the approved request mechanism rather than stored or logged by the frontend. The server validates the credential, election state, configuration version, and every candidate-to-position relationship. No voter identity in the request.

Success:

```json
{ "data": { "status": "accepted", "receipt_reference": "random-non-revealing-reference" }, "error": null }
```

Error:

```json
{ "data": null, "error": { "code": "BALLOT_ALREADY_ACCEPTED", "message": "This voting entitlement has already been used." } }
```

## HTTP status codes

`200` success · `201` created · `204` no body · `400` malformed · `401` auth required · `403` denied · `404` missing/undisclosed · `409` duplicate or incompatible state · `422` validation error · `429` rate limited · `500` unexpected error.

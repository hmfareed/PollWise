# 03 — Data Model Overview

## Database ownership

Use separate PostgreSQL databases (or equivalently strong isolation boundaries) for identity/eligibility and ballots.

- The identity database must not have a foreign key into the ballot database.
- The ballot database must not have a foreign key to a voter account.

Conceptual logical databases:

| Database | Contents |
| --- | --- |
| `identity_db` | Users, organizations, memberships, eligibility, credential issuance records |
| `election_db` | Election definition, positions, candidates, approvals, results, audit events |
| `ballot_db` | Anonymous ballots and credential-redemption records |

The election database stores the election definition and approved ballot configuration. If local development uses a single PostgreSQL server, keep **separate databases and separate least-privilege credentials**. Never grant a single runtime account unrestricted access to all databases.

## Detailed schemas

- [04-identity-database.md](04-identity-database.md)
- [05-election-database.md](05-election-database.md)
- [06-ballot-database.md](06-ballot-database.md)

## Retention and deletion

Define a retention policy before production.

- Keep account records only as long as required by the service and applicable obligations.
- Retain election definitions and published result versions per institutional policy.
- Retain audit records per the approved security and governance policy.
- Do not retain raw credentials after they are no longer needed.
- Delete or anonymize unnecessary imported files after processing.
- Do not delete election evidence simply because an administrator deletes their account.
- Document legal holds and the process for handling disputes.

## Cross-database rules

| Rule | Reason |
| --- | --- |
| No cross-database foreign keys | Prevents structural voter→ballot joins |
| `election_id` stored as plain UUID in each DB | Scoping without FK coupling |
| Distinct DB roles per service | Limits blast radius |
| Application-level consistency checks for `election_id` existence | Replaces FK enforcement across boundaries |

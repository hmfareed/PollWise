# 02 — Technical Architecture

## Technology decisions

| Layer | Selected technology |
| --- | --- |
| Language | Python 3.12 or another supported, pinned release |
| Backend framework | FastAPI |
| API validation | Pydantic |
| ORM | SQLAlchemy 2.x |
| Migrations | Alembic |
| Database | PostgreSQL |
| Database driver | asyncpg (when using async SQLAlchemy) |
| Frontend | React with TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Component system | shadcn/ui |
| Client routing | React Router |
| Server state | TanStack Query |
| Forms | React Hook Form |
| Frontend validation | Zod |
| Backend tests | Pytest |
| Frontend tests | Vitest + React Testing Library |
| Browser automation | Playwright |
| Containerization | Docker and Docker Compose |
| CI/CD | GitHub Actions or equivalent |
| Monitoring | Structured logs, error tracking, metrics, uptime checks |

Pin compatible dependency versions and commit lockfiles.

## Architectural structure

Modular monolith for the primary application, with clear boundaries between identity, organizations, elections, eligibility, administration, tallying, and reporting.

The secret-ballot requirement adds a boundary: **the identity and eligibility subsystem must be isolated from the ballot-box subsystem.**

```
                    VOTERS AND ADMINS
                            |
                       HTTPS / TLS
                            |
                 React + TypeScript UI
                            |
                    FastAPI API layer
                            |
              Authentication and RBAC
                            |
                 Application services
                  /                 \
       Identity / Eligibility      Election Management
                 |                   |
       Identity PostgreSQL       Election PostgreSQL
                 |
       One-time voting credentials
                 |
       Isolated credential redemption
                 |
             Ballot-box service
                 |
          Ballot PostgreSQL
                 |
          Anonymous ballot records
                 |
           Closed-election tally
                 |
          Approval and publication
```

These are logical trust boundaries. Identity and ballot-box components may initially run as separate applications or isolated services in the same cloud environment, but must not share unrestricted database access.

## Subsystems

### Identity and eligibility

- Account registration and authentication.
- Email verification.
- Organization membership.
- Election-specific voter eligibility.
- Voting-entitlement issuance.
- Recording that an eligible voter has exercised their entitlement.
- Administrative eligibility reporting.

Must not store ballot selections.

### Ballot-box

- Accept valid, election-specific voting credentials.
- Validate the election's active state and frozen ballot definition.
- Prevent credential reuse.
- Validate selected candidates and positions.
- Store anonymous ballot contents.
- Return a non-revealing receipt reference.
- Provide authorized, closed-election ballot data to the tally service.

Must not receive a voter ID, email address, organization membership ID, or other direct identity field in the ballot payload.

### Tally and publication

- Read accepted ballots after close.
- Apply the frozen counting rules.
- Calculate totals and turnout metrics.
- Produce a versioned tally.
- Support consistency checks and independent recomputation.
- Enforce approval and publication permissions.

Must not require a voter-to-ballot mapping.

## Secret-ballot architecture requirements

The platform must not claim a ballot is anonymous merely because the `ballots` table lacks a `voter_id` column. A sufficiently privileged operator might reconstruct the relationship through timestamps, credential records, application logs, database access, or network telemetry.

Safeguards:

1. The eligibility service issues a random, election-specific, single-use credential after confirming eligibility.
2. The eligibility database records entitlement state but not the plaintext credential or a directly usable ballot reference.
3. The voter presents the credential to the isolated ballot-box service.
4. The ballot-box atomically prevents credential reuse and stores the ballot without identity.
5. Credential-redemption record and ballot content are stored separately.
6. The ballot-box does not receive or log identity-bearing cookies or bearer tokens.
7. The ballot payload contains no identity fields.
8. Logs never include ballot selections, raw credentials, or a combined identity-and-ballot event.
9. Avoid exact ballot-submission timestamps in ordinary ballot content; keep minimum operational metadata.
10. Separate database roles, secrets, administrative permissions, and access logs between identity and ballot-box.
11. Avoid shared analytics that correlate identity, redemption, network identifiers, and ballot contents.
12. Protect against credential replay, cross-election reuse, and forged credentials.

### Credential lifecycle requirements

Implement as a dedicated, security-reviewed module. The credential must be:

- Generated from a cryptographically secure random source or an established cryptographic protocol.
- Scoped to exactly one election.
- Unusable after redemption.
- Unusable after the election closes.
- Unusable by an ineligible person.
- Unusable if malformed, revoked, or expired.
- Stored so the eligibility database does not expose the plaintext.
- Redeemed atomically to prevent concurrent reuse.

> **Important limitation:** random bearer credentials and database separation reduce direct linkage but do not independently guarantee cryptographic unlinkability. If the product must withstand a malicious infrastructure administrator or collusion between identity and ballot-box operators, use an established, independently reviewed anonymous-credential or verifiable-voting protocol. Do not build blind signatures or other cryptographic protocols from scratch.
>
> For ordinary institutional deployment, document the threat model honestly and obtain an independent review before claiming strong anonymity.

See also [19-threat-model.md](19-threat-model.md) and [20-credential-lifecycle.md](20-credential-lifecycle.md).

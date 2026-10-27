# 25 — Architecture Decision Records (Added)

Seed ADRs for `docs/decisions/`. Copy each into its own file once ratified.

## ADR-001 — Modular monolith plus isolated ballot-box
- **Status:** Accepted (specification v1.0)
- **Context:** Secret ballots require separation of identity and ballots; microservices for everything is unnecessary.
- **Decision:** Modular monolith for identity/election/tally; ballot-box as a separate deployable with its own database and role.
- **Consequences:** Extra operational complexity; stronger secrecy boundary.

## ADR-002 — Single-use credentials for ballot submission
- **Status:** Accepted; mechanism pending review (see doc 20)
- **Decision:** Eligibility issues election-scoped single-use credentials; ballot-box redeems atomically.
- **Consequences:** No cryptographic unlinkability against colluding operators; must be documented honestly.

## ADR-003 — Server-managed cookie sessions
- **Status:** Accepted
- **Decision:** HttpOnly, Secure, SameSite cookies with CSRF protection; no long-lived bearer tokens in local storage.

## ADR-004 — Tally only after close; results require approval
- **Status:** Accepted
- **Decision:** No interim totals. Publication requires tally approval and publication approval.

## ADR-005 — One candidate per position in v1
- **Status:** Accepted
- **Decision:** `single_choice_per_position`; ranked/weighted voting excluded.

## ADR-006 — No custom cryptography
- **Status:** Accepted
- **Decision:** Any stronger anonymity relies on a vetted protocol after specialist review.

## Template

```
## ADR-NNN — <title>
- Status: Proposed | Accepted | Superseded
- Context:
- Decision:
- Consequences:
```

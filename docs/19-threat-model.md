# 19 — Threat Model (Added)

Starting point for `docs/threat-model.md`. Revisit before production and after any design change.

## Assets

Ballot contents · identity↔ballot unlinkability · eligibility integrity · credential secrecy · election configuration · tally results · audit evidence · account credentials.

## Actors

| Actor | Capability assumed |
| --- | --- |
| Ordinary voter | Valid account, one entitlement |
| Malicious voter | Tries duplicate voting, credential theft/sharing, API abuse |
| Election manager / org admin | Can manage elections and eligibility, no DB access |
| Platform admin | Application-level privileges |
| Database operator | Direct access to one or more databases/backups |
| Infrastructure operator | Access to logs, network telemetry, deployments |
| External attacker | Internet access, phishing, credential stuffing |
| Colluding operators | Identity-side and ballot-side access combined |

## Threats and mitigations

| Threat | Mitigation | Residual risk |
| --- | --- | --- |
| Duplicate voting | Atomic single-use redemption + unique constraints + idempotency | Low |
| Credential sharing/selling | Short TTL, one per entitlement, no re-issue without audited procedure | Voter-controlled; cannot be fully prevented remotely |
| Credential forgery | High-entropy random or vetted protocol; hash lookup | Depends on final credential design |
| Cross-election reuse | Election-scoped credentials and checks | Low |
| Admin links voter→ballot | Separate DBs, roles, logs; no identity fields in ballots | Medium if one admin controls both |
| Timestamp correlation | Coarsen/omit ballot timestamps; avoid per-event joins | Medium; redemption timestamps remain |
| Log correlation | No ballot/credential in logs; no combined events; separate sinks | Medium (infra telemetry) |
| Backup correlation | Encrypt; separate access; restore-order policy | Medium |
| Compromised identity service | Cannot read ballots; could issue extra credentials → reconcile counts | Medium |
| Compromised ballot-box | Could alter/suppress ballots → integrity metadata, independent recompute, monitoring | Medium |
| Receipt abuse (vote proving) | Receipt random, not tied to choices | Low |
| Coercion on remote voting | Out of scope for web app; document | Accepted |
| Compromised voter device | Out of scope; document | Accepted |
| Late votes after closing | Server-side deadline in ballot-box; independent of jobs | Low |
| Result tampering | Immutable versions, approvals, audit, recompute | Low–Medium |
| Insider approving own results | Separation of duties | Low |
| DoS on election day | Rate limits (tuned), capacity tests, runbook | Medium |

## Out of scope (state clearly to institutions)

Coercion resistance, device compromise, nation-state adversaries, collusion between operators of both subsystems (unless an anonymous-credential protocol is adopted after specialist review).

## Review triggers

Before production · after schema or credential-flow changes · after incidents · before each significant election.

# 20 — Credential Lifecycle (Added)

Design notes for the security-reviewed credential module. These are working proposals consistent with the specification; confirm them in the architecture review. **Do not invent cryptographic schemes.**

## Flow

```
Voter (authenticated session)
   │ 1. POST /elections/{id}/voting-credential
   ▼
Identity API
   │ 2. verify: email verified, eligible, election open, entitlement unused
   │ 3. generate random credential (≥128-bit, CSPRNG), scope = election
   │ 4. store credential hash + mark entitlement "issued" (one transaction)
   │ 5. return plaintext credential ONCE
   ▼
Browser (holds credential in memory only)
   │ 6. POST /ballot-box/v1/ballots  (separate origin, no cookies)
   ▼
Ballot-box
   │ 7. verify election open + frozen config hash
   │ 8. validate selections
   │ 9. in ONE transaction: atomically redeem credential, insert ballot
   │10. return receipt reference
   ▼
Confirmation to identity side (so entitlement → "redeemed")
```

## Open design decisions (resolve in Phase 4 review)

| Decision | Considerations |
| --- | --- |
| How the ballot-box learns valid credentials | (a) identity service registers credential hashes with the ballot-box at issuance; (b) pre-generated pool of credentials loaded into the ballot-box at open and handed out by identity in random order; (c) a vetted verifiable/anonymous credential scheme. Option (a) links issuance and registration by timing; (b) reduces this; (c) strongest but needs specialist review. |
| Hash correlation across databases | If both databases store the same `credential_hash`, collusion trivially joins them. Consider the ballot-box storing a keyed hash (HMAC with a ballot-box-only key) and the identity side storing no joinable value where the design allows. |
| How redemption is confirmed to identity | Callback leaks timing. Options: batched/delayed confirmation, or reconciling counts rather than per-voter links. |
| Credential delivery to the browser | In-memory only; never in URL, localStorage, or logs; short TTL. |
| Lost response after issuance | Define a controlled re-issue procedure (audited) that revokes the old credential. |
| Outcome unknown after submission | Retry with the same idempotency key; never request a new credential automatically. |

## Credential properties checklist

- [ ] CSPRNG-generated, election-scoped.
- [ ] Single-use, atomically redeemed.
- [ ] Expires at election close (and optionally sooner).
- [ ] Revocable through an audited procedure.
- [ ] Never stored in plaintext server-side, never logged.
- [ ] Not transmitted with identity-bearing cookies/tokens.
- [ ] Replay and cross-election reuse tests pass.

## Ballot-box request hygiene

- Separate origin; CORS allows only the frontend origin; `credentials: "omit"`.
- Strip cookies, `Authorization`, and forwarding headers at the edge.
- Short or no retention of source IPs; separate log sink with restricted access.
- Request ID not shared with identity-side logs.

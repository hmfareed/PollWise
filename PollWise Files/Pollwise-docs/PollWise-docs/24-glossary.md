# 24 — Glossary (Added)

| Term | Meaning |
| --- | --- |
| Entitlement | An eligible voter's one-time right to vote in a specific election |
| Voting credential | Single-use, election-scoped secret that lets the ballot-box accept one ballot |
| Redemption | Atomic act of consuming a credential while storing its ballot |
| Ballot-box | Isolated service and database that stores anonymous ballots |
| Frozen configuration | Positions/candidates/rules locked when scheduled/opened, identified by a hash |
| Configuration hash | Digest used to confirm ballots and tallies use the same configuration |
| Tally | Deterministic count of accepted ballots producing a versioned result |
| Result version | Immutable tally record; recounts create a new version |
| Receipt reference | Random identifier confirming acceptance, revealing nothing about choices |
| Idempotency key | Client token making retries safe |
| Outcome unknown | UI state when a submission result is uncertain |
| Separation of duties | Different people for conflicting steps (create, approve, publish) |
| Unlinkability | Inability to connect a voter to their ballot |
| RPO / RTO | Recovery point / time objectives |

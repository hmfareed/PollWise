# 12 — Testing and Verification

## Backend unit tests

Email normalization · password validation · permission checks · election state transitions · candidate/position validation · ballot selection limits · result calculations · turnout calculations · credential expiration · error handling.

## Database integration tests (PostgreSQL)

Foreign-key enforcement · unique constraints · transaction rollback · concurrent credential redemption · duplicate ballot prevention · election deadline boundaries · configuration locking · published result immutability · recount version creation.

SQLite-only testing is insufficient for proving PostgreSQL concurrency behavior.

## Secret-ballot tests

1. Ballot schema has no voter ID or direct eligibility foreign key.
2. Ballot-box API rejects identity-bearing payload fields.
3. Identity database cannot query ballot contents.
4. Ballot database cannot query user accounts.
5. Raw credentials never appear in logs.
6. Candidate selections never appear in application logs.
7. Receipt references cannot reveal candidate choices.
8. The same credential cannot be redeemed twice.
9. Cross-election credential reuse fails.
10. Credential redemption and ballot acceptance remain consistent after failures.
11. Administrative reporting exposes no identity-to-ballot relationships.
12. Tallying can be independently recomputed from accepted ballots.

A separate security review must examine whether timestamps, request IDs, infrastructure logs, backups, or shared observability tools can reconstruct the identity-to-ballot mapping.

## Concurrency testing

Simulate many simultaneous attempts to redeem the same credential. Acceptance:

- Exactly one ballot accepted.
- At most one credential redemption succeeds.
- No orphaned ballot or redemption record.
- Retries with the same idempotency key create no extra ballots.
- Database failures roll back all required writes.
- Election closure prevents late acceptance per the defined cutoff policy.

## Frontend tests (Vitest + RTL)

Authentication forms · validation feedback · election creation wizard · candidate management · voter eligibility workflows · ballot selection and review · submission retries · session expiration · permission-denied states · results visibility · keyboard navigation · responsive layouts.

## End-to-end tests (Playwright)

1. Register and verify a test account.
2. Sign in as an authorized administrator.
3. Create an organization.
4. Create an election with multiple positions.
5. Add candidates to each position.
6. Register eligible voters.
7. Schedule and open the election.
8. Sign in as an eligible voter.
9. Obtain a voting credential.
10. Submit a ballot covering multiple positions.
11. Verify participation without revealing choices.
12. Attempt a second submission.
13. Close the election.
14. Calculate results.
15. Approve and publish the tally.
16. Verify published totals match known test ballots.
17. Verify results were unavailable before publication.

Use synthetic identities and candidates; never real voter data.

## Added: example concurrency test skeleton

```python
async def test_concurrent_redemption(ballot_box_client, credential, valid_selections):
    results = await asyncio.gather(*[
        ballot_box_client.post("/ballot-box/v1/ballots",
                               json={"credential": credential, "selections": valid_selections})
        for _ in range(20)
    ])
    assert sum(r.status_code == 201 for r in results) == 1
    assert sum(r.status_code == 409 for r in results) == 19
    assert await count_ballots() == 1
    assert await count_redemptions(status="accepted") == 1
```

## Added: test traceability

| Release-gate item | Covered by |
| --- | --- |
| Only eligible voters obtain credentials | Eligibility integration tests, E2E steps 8–9 |
| Single use | Concurrency + secret-ballot tests 8–9 |
| No direct voter identifiers on ballots | Secret-ballot tests 1–4 |
| Server-side closing | Deadline-boundary integration tests |
| Reproducible tally | Secret-ballot test 12, tally unit tests |
| Approval before publication | E2E steps 15, 17; publication permission tests |

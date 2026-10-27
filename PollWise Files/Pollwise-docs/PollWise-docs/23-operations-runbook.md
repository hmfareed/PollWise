# 23 — Operations Runbook (Added)

Starting point for `docs/operations-runbook.md`.

## Before an election

- T-14 days: freeze schema changes; run staging election.
- T-7 days: confirm eligibility list, candidate approvals, launch approval, configuration hash.
- T-3 days: verify backups and a recent restore drill; verify alert routing and on-call roster.
- T-1 day: smoke test with synthetic voter; confirm rate limits suit shared-IP campuses/offices.

## Opening

- Confirm automatic transition to `open` at `opens_at`.
- Smoke-test credential issuance and a synthetic ballot (in staging, or a designated test election).
- Watch error rate, latency, DB connections.

## During voting

- Monitor turnout (counts only), failed redemptions, rate-limit events, duplicate-attempt rate.
- Configuration changes only under the documented emergency procedure (audited).
- Never query ballot or credential tables for "debugging".

## Closing

- Confirm no acceptance after `closes_at` (check ballot-box logs for rejections).
- Stop credential issuance.
- Reconcile counts: redeemed entitlements (identity) vs accepted ballots (ballot-box) — counts only, no per-voter join.

## After

- Run tally → consistency checks → independent recomputation.
- Approval (different person where policy requires) → publication.
- Retention actions per policy; archive evidence.
- Post-mortem within one week.

## Incident playbooks (outline)

| Incident | First actions |
| --- | --- |
| Ballot-box outage during voting | Fail closed; communicate; decide extension under documented policy; audit |
| Suspected credential leak | Revoke affected credentials via audited procedure; review redemption patterns |
| Suspected identity↔ballot correlation | Preserve evidence; restrict access; notify per policy; independent review |
| Database restore needed | Follow restore order; run reconciliation so no used credential becomes valid again |
| Tally discrepancy | Do not publish; recompute; escalate to approvers |

## Restore order (draft)

1. Restore `ballot_db` and `identity_db` to consistent points.
2. Reconcile redeemed credentials and entitlement states (revoke any credential whose ballot status is uncertain via the audited procedure).
3. Verify election states and approvals.
4. Run integrity checks before reopening traffic.

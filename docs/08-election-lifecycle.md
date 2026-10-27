# 08 — Election Lifecycle

Allowed lifecycle: `draft → scheduled → open → closed → tallied → published`

A cancellation workflow must be separately defined.

| State | Behavior |
| --- | --- |
| **Draft** | Information editable; candidates/positions manageable; eligibility can be prepared; no ballots can be submitted |
| **Scheduled** | Configuration validated; launch approval complete; opening/closing times defined; ballot configuration frozen |
| **Open** | Eligible voters can obtain credentials and submit ballots; configuration locked; server enforces deadline; interim results inaccessible |
| **Closed** | Credential issuance and ballot acceptance stop; accepted ballots remain immutable; tally can run |
| **Tallied** | Counting service produced a versioned result; integrity checks complete; result awaits approval |
| **Published** | Approved results visible to permitted users; published version immutable; recount creates a new version requiring approval |

## State transition enforcement

Every transition must:

1. Authenticate the actor or service.
2. Verify the relevant permission.
3. Verify the current election state.
4. Check all transition prerequisites.
5. Perform the change transactionally.
6. Record an audit event.
7. Return the updated state.

A scheduled background job may update displayed status, but ballot acceptance must independently verify authoritative election state and time.

## Added: transition prerequisites

| Transition | Prerequisites |
| --- | --- |
| draft → scheduled | ≥1 position, each with ≥1 active candidate; valid schedule; eligibility list present; launch approval; configuration hash computed |
| scheduled → open | `opens_at` reached (or authorized manual open); hash unchanged since approval |
| open → closed | `closes_at` reached or authorized early close (audited) |
| closed → tallied | Tally succeeds; consistency checks pass |
| tallied → published | Tally approval + publication approval recorded |
| any pre-published → canceled | Cancellation policy, reason, audit event |

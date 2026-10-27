# 05 — Election Database Schema (`election_db`)

## elections

| Field | Notes |
| --- | --- |
| `id` | UUID primary key |
| `organization_id` | organization identifier |
| `title` | non-null |
| `description` | nullable |
| `status` | draft, scheduled, open, closed, tallied, published, canceled |
| `opens_at`, `closes_at` | timezone-aware timestamps |
| `timezone` | IANA timezone |
| `voting_method` | `single_choice_per_position` |
| `configuration_version` | integer |
| `configuration_hash` | hash of the frozen ballot configuration |
| `created_by` | administrative actor ID |
| `created_at`, `updated_at` | timestamps |

Validate that closing time follows opening time.

## positions

| Field | Notes |
| --- | --- |
| `id` | UUID primary key |
| `election_id` | FK → elections |
| `title` | non-null |
| `description` | nullable |
| `max_selections` | positive integer, default 1 |
| `min_selections` | non-negative integer, default 1 |
| `display_order` | integer |

First release supports one candidate per position. Validate that selection limits match the supported voting method.

## candidates

| Field | Notes |
| --- | --- |
| `id` | UUID primary key |
| `position_id` | FK → positions |
| `name` | non-null |
| `biography` | nullable |
| `photo_url` | nullable |
| `display_order` | integer |
| `status` | active or withdrawn |
| `created_at` | timestamp |

A candidate belongs to one position and must not be selectable for another unless explicitly introduced later.

## election_approvals

| Field | Notes |
| --- | --- |
| `id` | UUID primary key |
| `election_id` | FK → elections |
| `approval_type` | launch, tally, publication |
| `approver_actor_id` | actor identifier |
| `decision` | approved or rejected |
| `reason` | nullable |
| `created_at` | timestamp |

Policies should support separation of duties. The person who created the election should not automatically be the sole approver of its results.

## election_results

| Field | Notes |
| --- | --- |
| `id` | UUID primary key |
| `election_id` | election identifier |
| `result_version` | positive integer |
| `configuration_hash` | the tally's frozen configuration hash |
| `tally_algorithm_version` | version identifier |
| `ballot_count` | accepted ballots counted |
| `result_data` | structured JSON, per-position totals |
| `computed_at` | timestamp |
| `computed_by` | service or authorized actor |
| `approval_status` | pending, approved, rejected |
| `published_at` | nullable timestamp |

Constraints: unique `(election_id, result_version)`; published results are immutable; a recount creates a new version; totals tied to the exact configuration version used.

## audit_events

| Field | Notes |
| --- | --- |
| `id` | UUID primary key |
| `organization_id` | nullable |
| `election_id` | nullable |
| `actor_id` | nullable |
| `event_type` | controlled event name |
| `outcome` | success or failure |
| `metadata` | JSON of approved, non-sensitive metadata |
| `created_at` | timestamp |

Record privileged actions, configuration changes, approval decisions, eligibility imports, and publication events. **Never** record ballot selections, plaintext credentials, passwords, session tokens, or unnecessary personal information.

Protect against unauthorized modification; for higher assurance export to separately controlled append-only or tamper-evident storage.

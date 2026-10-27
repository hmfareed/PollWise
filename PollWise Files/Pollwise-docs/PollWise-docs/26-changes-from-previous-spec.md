# 26 — Changes From the Earlier General Specification (Added)

This version (v1.0 implementation baseline) supersedes the earlier general-purpose voting documentation set where they differ.

| Area | Earlier general spec | This specification |
| --- | --- | --- |
| Scope | Options left open (polls, orgs, SaaS) | Fixed: institutional elections |
| Ballot secrecy | Separate tables, single database | Separate databases + isolated ballot-box service + single-use credentials |
| Duplicate prevention | Claim voting entitlement in one transaction | Atomic credential redemption inside the ballot-box |
| Databases | One PostgreSQL schema | `identity_db`, `election_db`, `ballot_db` with separate roles |
| Roles | platform owner, election admin, auditor, voter | platform_admin, organization_admin, election_manager, auditor, member |
| Voting method | Single choice and multiple positions first | `single_choice_per_position` only; ranked/weighted excluded |
| Results | Configurable | Tally after close → approval → publication |
| Approvals | Recommended | `election_approvals` table: launch, tally, publication |
| Ballot endpoint | `/elections/{id}/ballots` | `/ballot-box/v1/ballots` plus `/elections/{id}/voting-credential` |
| Error code | `ALREADY_VOTED` | `BALLOT_ALREADY_ACCEPTED` (plus credential-specific codes) |
| Agent guidance | General rules | Master prompt, operating rules, per-phase report |

If both documentation sets are kept, treat the earlier ballot-secrecy deep dive as superseded by docs 02, 06, 19 and 20 here.

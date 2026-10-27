# 18 — Final Release Gate

The application is not ready for real institutional elections until all of the following are verified:

- [ ] Authentication and permissions work correctly.
- [ ] Only eligible voters can obtain voting entitlements.
- [ ] Each entitlement can be used at most once.
- [ ] Ballots are stored without direct voter identifiers.
- [ ] The identity-to-ballot correlation threat has been independently assessed.
- [ ] Concurrent ballot submissions have been tested against PostgreSQL.
- [ ] Election closing is enforced server-side.
- [ ] Tallying is reproducible.
- [ ] Results cannot be published without required approval.
- [ ] Published results and audit evidence are protected from unauthorized modification.
- [ ] Backups can be restored.
- [ ] Monitoring and incident response have been rehearsed.
- [ ] The staging election has completed successfully.

## Implementation priority

1. Correctness
2. Security boundaries
3. Complete voting workflows
4. Visual refinement
5. Scaling optimization (after measured testing)

## Intent

A maintainable institutional voting product with an explicit security model — not an unsupported claim that an ordinary web application is suitable for every kind of election.

## Key technical decision

The secret-ballot boundary is the most important decision. A normal CRUD app with a `votes` table and a `user_id` column would be easier, but would not meet the requirement that ordinary administrators cannot connect a voter to their selections. The agent must preserve that boundary throughout.

## Recommended next step

Start with Phase 1 (repository setup and architecture); have the coding agent implement and test each phase before moving to the next.

# 16 — Coding-Agent Operating Instructions

The coding agent must follow these rules throughout development.

## Rule 1: Inspect before modifying
Inspect the repository, package manifests, environment configuration, database setup, and available tests before creating or changing files. If working code exists, preserve compatible implementations and avoid unnecessary rewrites.

## Rule 2: Work in small, testable increments
Implement one coherent phase at a time. Each phase includes: code, migrations where needed, validation, automated tests, updated documentation, verification commands, and a summary of files changed. Do not implement every feature in one enormous generation step.

## Rule 3: Treat security as a requirement
Do not postpone authentication, authorization, transaction safety, secret handling, or ballot secrecy. Never use:

- Hardcoded production secrets.
- Insecure password storage.
- Frontend-only permissions.
- Check-then-insert duplicate prevention without database enforcement.
- A ballot schema containing a voter identifier.
- Unrestricted administrator access to all databases.
- Mock data as a substitute for the required backend implementation.

## Rule 4: Use real persistence
All production features use PostgreSQL-backed persistence. No local storage, in-memory arrays, or hardcoded JSON as the authoritative store for users, elections, eligibility, ballots, or results. Frontend caching is acceptable for permitted read-only data; the server remains authoritative.

## Rule 5: Keep API contracts synchronized
When an API changes, update backend schemas, endpoint implementation, frontend API client, TypeScript types, automated tests, and API documentation. Prefer generating or validating frontend types from the OpenAPI specification.

## Rule 6: Verify before claiming completion
After each phase: run relevant tests; run formatting and linting; run type checks; apply migrations to a test database; verify affected workflows; report failures honestly. Do not claim tests passed if they were not executed.

## Rule 7: Do not invent cryptography
If secret-ballot security requires a protocol not already approved in the design, stop and document the requirement. Use a vetted protocol or library only after verifying it fits the threat model and deployment. Request specialist review rather than implementing a custom scheme.

## Rule 8: Maintain useful documentation
Keep `README.md` updated with setup, environment variables, migrations, test commands, and startup instructions. Maintain separate documentation for architecture, API contracts, threat model, operations, and major architectural decisions.

## Added: per-phase report template

```
Phase: <n> — <name>
Summary:
Files created/modified:
Migrations:
Tests executed + results (actual output):
Known limitations:
Security decisions needing review:
Run locally: <exact commands>
Next phase plan:
```

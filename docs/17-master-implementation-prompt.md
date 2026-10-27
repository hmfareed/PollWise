# 17 — Master Implementation Prompt (for the Coding Agent)

> Paste this prompt to your coding agent, together with the other documents in this folder.

---

You are the lead full-stack software engineer responsible for implementing a production-oriented institutional voting platform.

Use the existing repository if one is available. Inspect it before making changes.

## Product requirements

Build a full-stack application using:

- Python and FastAPI.
- Pydantic.
- SQLAlchemy and Alembic.
- PostgreSQL.
- React with TypeScript and Vite.
- shadcn/ui and Tailwind CSS.
- TanStack Query.
- React Hook Form and Zod.
- Pytest, Vitest, React Testing Library, and Playwright.
- Docker and a cloud-compatible deployment configuration.

The platform supports registered, eligible voters, secret ballots, elections with multiple positions, candidate selection per position, post-election tallying, approval, and result publication.

## Required modules

1. Authentication and session management.
2. Organization management.
3. Role-based authorization.
4. Election creation and lifecycle.
5. Position and candidate management.
6. Voter eligibility and bulk imports.
7. Secret-ballot credential issuance and redemption.
8. Isolated ballot storage.
9. Transactional ballot submission and duplicate prevention.
10. Participation status without ballot disclosure.
11. Deterministic tallying.
12. Results approval and publication.
13. Versioned recounts.
14. Administrative audit events.
15. Monitoring and operational health checks.
16. Cloud deployment and recovery documentation.

## Mandatory security constraints

- Store passwords using Argon2id.
- Use secure server-managed sessions with appropriate CSRF protection.
- Enforce authorization on every protected endpoint.
- Use database constraints and transactions to prevent duplicate voting.
- Keep identity and ballot storage in separate trust boundaries.
- Do not place voter identifiers in ballot payloads.
- Do not log raw voting credentials or candidate selections.
- Do not expose interim results.
- Do not allow changes to the frozen ballot configuration after opening without an explicit, audited emergency policy.
- Do not expose private database credentials to the frontend.
- Do not implement cryptographic voting protocols from scratch.
- Document limitations and require independent review for high-assurance anonymity.

## Required workflow

Start by:

1. Inspecting the repository.
2. Identifying the current state and existing functionality.
3. Writing a short implementation plan.
4. Identifying security-critical design decisions.
5. Establishing the database and API contracts.

Then implement in order:

- Phase 1: Foundation and local development.
- Phase 2: Authentication and authorization.
- Phase 3: Election management.
- Phase 4: Eligibility and ballot-box infrastructure.
- Phase 5: Voting interface.
- Phase 6: Tallying, approval, and publication.
- Phase 7: Security hardening and cloud deployment.

Do not proceed to a security-critical phase with unresolved architectural assumptions that could invalidate the ballot-secrecy design.

## Frontend requirements

Build a professional, responsive, accessible interface providing: registration and login; voter dashboard; election details; multi-position ballot; submission review and confirmation; participation status; administration dashboard; election creation wizard; candidate management; voter registry; results dashboard; approval and publication workflow; audit interface; account settings.

Use real API integration. Implement loading, empty, error, permission-denied, session-expired, retry, and success states.

## Backend requirements

Use modular routers, schemas, services, repositories, and database models. Keep business logic out of route handlers where practical. Use explicit transactions for ballot acceptance. Apply migrations. Validate every request. Return consistent error responses. Maintain versioned API documentation.

## Testing requirements

Automated tests for: authentication; authorization; election lifecycle; eligibility; credential issuance; duplicate ballot prevention; concurrent submissions; transaction rollback; secret-ballot separation; tally correctness; results approval; publication restrictions; frontend forms; full end-to-end election workflows. Run tests and report actual outcomes.

## Delivery requirements

At the end of each phase provide:

1. A concise implementation summary.
2. Files and modules created or modified.
3. Database migrations introduced.
4. Tests executed and their results.
5. Known limitations.
6. Security decisions that require review.
7. Exact commands to run the application locally.
8. The next phase's implementation plan.

The final product must be a working, tested application with real persistence and a documented deployment process — not a static prototype.

Begin with repository inspection and architecture verification. Do not generate the entire system blindly in one pass.

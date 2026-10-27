# 07 — Authentication and Authorization

## Authentication strategy

Secure server-managed sessions for the browser application.

- Argon2id password hashing.
- Email verification.
- Secure, HttpOnly session cookies; `Secure` enabled in production; appropriate `SameSite` policy.
- Session expiration and revocation.
- Session rotation after authentication and privilege changes.
- CSRF protection for cookie-authenticated state-changing requests.
- Login and recovery rate limiting.
- Single-use, short-lived password reset tokens.
- Generic password recovery responses.
- Optional MFA for administrators and auditors.

Do not store long-lived bearer tokens in browser local storage by default.

## Role-based access control

| Role | Scope |
| --- | --- |
| `platform_admin` | Platform-level operations |
| `organization_admin` | Manages their organization |
| `election_manager` | Manages authorized elections |
| `auditor` | Read-only access to approved evidence |
| `member` | Votes only when eligible |

Rules:

- Authorization is checked on every protected API endpoint.
- A role in one organization grants nothing in another.
- Sensitive actions (changing administrative permissions, approving results, publishing results) require reauthentication or additional verification per the risk policy.
- The ballot-box service has its own narrow permissions and never trusts user IDs submitted by the frontend.

## Ballot-box authentication boundary

The ballot-box authenticates **credentials**, not users. It must not receive session cookies. Serve it from a separate origin, call it with `credentials: "omit"`, and strip any identity-bearing headers at the edge. See [20-credential-lifecycle.md](20-credential-lifecycle.md).

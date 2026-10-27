# 22 — Configuration Reference (Added)

Extends `.env.example` for the three-database, two-service layout.

## Backend (identity + election API)

| Variable | Required | Description |
| --- | :-: | --- |
| `APP_ENV` | ✓ | development / testing / staging / production |
| `IDENTITY_DATABASE_URL` | ✓ | Identity DB (identity role) |
| `ELECTION_DATABASE_URL` | ✓ | Election DB (election role) |
| `SESSION_SECRET` | ✓ | Strong random secret |
| `SESSION_IDLE_MINUTES` | | Idle timeout |
| `SESSION_ABSOLUTE_HOURS` | | Absolute timeout |
| `FRONTEND_ORIGIN` | ✓ | Allowed CORS origin |
| `BALLOT_BOX_BASE_URL` | ✓ | Ballot-box origin |
| `BALLOT_BOX_SERVICE_TOKEN` | ✓ | Service-to-service auth (not user identity) |
| `EMAIL_PROVIDER_API_KEY` | | Email provider |
| `RATE_LIMIT_LOGIN_PER_MIN` | | Login attempts per minute |
| `MAX_UPLOAD_MB` | | Upload cap |
| `LOG_LEVEL` | | Default `INFO` |

## Ballot-box service

| Variable | Required | Description |
| --- | :-: | --- |
| `BALLOT_DATABASE_URL` | ✓ | Ballot DB (ballot-box role only) |
| `ELECTION_CONFIG_SOURCE` | ✓ | How it obtains frozen config (read-only) |
| `ALLOWED_ORIGIN` | ✓ | Frontend origin for CORS |
| `CREDENTIAL_HMAC_KEY` | if used | Ballot-box-only key for keyed hashing |
| `LOG_LEVEL` | | Must not log payloads |

## Tally service

| Variable | Required | Description |
| --- | :-: | --- |
| `BALLOT_DATABASE_RO_URL` | ✓ | Read-only role, closed elections only |
| `ELECTION_DATABASE_URL` | ✓ | To write result versions |

## Rules

Validate at startup and fail fast · distinct secrets and DB roles per service and environment · never log secrets · no secrets in Vite variables.

# 13 — Cloud Deployment and Operations

## Environment separation

Development · Testing · Staging · Production — each with separate databases, secrets, credentials, and storage. Staging resembles production closely enough to test migrations, authentication, deployment, monitoring, and restoration.

## Deployment components

- HTTPS-enabled frontend hosting.
- FastAPI application hosting.
- Separately deployed ballot-box service.
- PostgreSQL for identity and election data.
- Separately permissioned ballot database.
- Managed secret storage.
- Email delivery provider.
- Centralized security monitoring.
- Automated backup storage.
- Health checks and deployment rollback.
- Optional background workers (notifications, scheduled tasks).

Do not expose PostgreSQL directly to the public internet.

## Production security

TLS for all external and internal service communication where applicable · strict CORS allowlists · secure cookies · CSRF protection · rate limiting · request-size limits · least-privilege database roles · restricted administrative access · dependency and secret scanning · secure container images · no production debug mode · no credentials in logs · audited database administration · tested backup restoration.

## Monitoring

API availability · response latency · error rates · database connection saturation · failed authentication · rate-limit events · failed credential redemptions · duplicate-submission attempts · election opening and closing · tally failures · result publication events · backup completion · resource consumption · unexpected access to sensitive endpoints.

Never send ballot contents or identity-to-ballot correlation data to analytics systems.

## Backup and recovery

Define explicit RPO and RTO. Back up identity and organization data, election configuration and approvals, anonymous ballot records, published result versions, and required audit records. Backups are access-controlled and encrypted; restoration is tested.

The plan must cover failure during credential redemption or ballot acceptance. A restore must not silently create a state where an accepted ballot can be submitted again or an already-used credential becomes valid.

For significant elections, freeze configuration changes during the voting window except for documented emergency procedures.

## Added: backup consistency considerations

- Take `identity_db` and `ballot_db` backups so that restoring one without the other cannot reopen a redeemed credential. Document the restore order and reconciliation step (compare redeemed entitlements with accepted redemptions).
- Keep backup access for the two databases under different operators/credentials where practical.
- Treat backups, WAL, and replicas as sensitive for correlation purposes.

See [23-operations-runbook.md](23-operations-runbook.md).

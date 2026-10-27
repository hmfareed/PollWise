# 14 — Privacy, Governance and Assurance

## Institutional governance

Before launching a real election, document:

- Eligibility criteria.
- Candidate approval rules.
- Election opening and closing procedures.
- Emergency suspension procedures.
- Who can approve a tally.
- Who can publish results.
- Recount and dispute procedures.
- Audit-record retention.
- Personal-data retention.
- Incident notification.
- Election cancellation.
- Recovery during an outage.

The platform must not silently alter results or delete evidence in response to an administrative request.

## Additional safeguards for secret ballots

The first release must undergo a privacy and security design review covering:

- Whether operators can correlate identity and ballots.
- Whether exact timestamps enable correlation.
- Whether a shared logging provider can reconstruct voter behavior.
- Whether the same administrator controls both databases.
- Whether backup access defeats database separation.
- Whether a compromised identity service can issue unauthorized credentials.
- Whether a compromised ballot-box service can change or suppress ballots.
- Whether a receipt can be used to prove candidate selections to another person.
- Whether the tally can be independently recomputed.

Do not advertise the system as cryptographically anonymous or independently verifiable unless the implementation and evidence support those claims.

## Legal review

Before a real institutional election, assess applicable privacy, cybersecurity, employment, education, and organizational governance requirements. If deployed in Ghana, determine the applicability of Ghanaian data-protection and cybersecurity legislation and any sector-specific rules.

Binding public elections require a separate specialist design and legal review. This specification is not a certification for governmental or legally binding elections.

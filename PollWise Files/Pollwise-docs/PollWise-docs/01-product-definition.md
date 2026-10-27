# 01 — Product Definition

**Institutional Voting Platform — Definitive Implementation Specification**
Version 1.0 · Status: implementation baseline

| Item | Decision |
| --- | --- |
| Architecture | Modular monolith with a separately isolated ballot-box subsystem |
| Backend | Python, FastAPI, SQLAlchemy, Alembic |
| Frontend | React, TypeScript, Vite, shadcn/ui, Tailwind CSS |
| Database | PostgreSQL |
| Deployment | Cloud-hosted |
| Voting model | Registered, eligible voters; secret ballots; multiple positions per election |
| Results policy | Tally after closing, then approval and publication |

## Product vision

A secure, reliable institutional voting platform for schools, universities, student associations, clubs, professional associations, and companies.

Organizations create elections, define positions, register candidates, establish voter eligibility, open voting for a defined period, collect secret ballots, calculate results, review election evidence, and publish approved outcomes.

It must be a functioning full-stack system with persistent storage, enforced permissions, transactional voting, a usable administrative dashboard, comprehensive tests, and production deployment instructions. It must **not** be a collection of disconnected screens or a frontend-only prototype.

## Confirmed product decisions (fixed for release 1)

1. **Institutional elections:** organizations conduct elections for their members.
2. **Registered voters:** users must have an account and be explicitly eligible for the election.
3. **Secret ballots:** ordinary administrators must not be able to retrieve a mapping between a voter and their selections.
4. **Multiple positions:** one election may contain several positions, each with its own candidates and selection rules.
5. **Post-election results:** no candidate totals while voting is open. Results become available only after close, successful tally, and required approval.
6. **Cloud deployment:** secure, monitored deployment with backups and recovery procedures.
7. **Single accepted ballot:** one accepted ballot per eligible voter per election.
8. **Final submission:** a submitted ballot cannot ordinarily be modified or withdrawn.
9. **No public voter directory:** voter information visible only to authorized users for legitimate administrative purposes.
10. **No self-service election creation by ordinary voters:** restricted to authorized institutional administrators.

## Explicitly excluded from version one

Do not implement unless separately approved:

- Legally binding national or governmental elections.
- Ranked-choice or instant-runoff voting.
- Weighted voting.
- Ballot replacement or withdrawal.
- Public voting without registered accounts.
- Public interim candidate results.
- Blockchain-based vote storage.
- Custom cryptographic voting protocols invented by the coding agent.
- Microservices for every application module.
- Paid subscription billing.
- Native mobile applications.
- Unnecessary social networking functionality.

Keep the architecture extensible, but do not let speculative features delay the core voting workflow.

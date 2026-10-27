# 10 — Frontend Implementation

## Directory structure

```
frontend/
├── public/
├── src/
│   ├── app/            router.tsx, providers.tsx
│   ├── components/     ui/, layout/, forms/, feedback/
│   ├── features/
│   │   ├── auth/ dashboard/ organizations/ elections/ candidates/
│   │   ├── eligibility/ ballot/ participation/ results/ audit/ settings/
│   ├── hooks/
│   ├── lib/            api-client.ts, utils.ts, schemas/
│   ├── types/
│   ├── styles/
│   └── main.tsx
├── components.json
├── package.json
├── vite.config.ts
└── tsconfig.json
```

Business-specific UI stays in its feature folder; shared shadcn/ui primitives in `components/ui`.

## Design system

Professional, light enterprise theme; clear hierarchy; restrained color.

| Token | Value |
| --- | --- |
| Background | `#F8FAFC` |
| Card | `#FFFFFF` |
| Main text | `#0F172A` |
| Secondary text | `#64748B` |
| Primary | `#2563EB` |
| Success | `#16A34A` |
| Warning | `#D97706` |
| Danger | `#DC2626` |
| Border | `#E2E8F0` |

Consistent spacing, ~12–16px card radii, accessible focus rings, clear semantic status labels. Never use color alone to communicate election state.

## Voter screens

- **Registration and login:** registration, login, email verification, password recovery/reset, session-expired handling, account settings. Actionable validation errors without exposing account existence unnecessarily.
- **Voter dashboard:** eligible upcoming elections, open elections, completed participation, published results, deadlines, notifications. Never show another voter's participation.
- **Election details:** title, description, organization, open/close times, status, positions and candidate descriptions when appropriate, voting instructions, current user's eligibility.
- **Ballot page:** instructions, one section per position, candidate cards/accessible controls, biographies, selection requirements, validation errors, review and confirmation steps. One candidate per position; several positions per ballot.
- **Submission confirmation:** whether the server accepted the ballot; that it cannot ordinarily be changed; non-revealing receipt reference; how to check participation. Never show success before server acceptance.
- **Published results:** candidate totals, percentages with clear denominators, turnout and eligible counts when authorized, publication time, result version, approval status, authorized exports. No totals before publication.

## Administrator screens

- **Dashboard:** elections by status, upcoming deadlines, authorized turnout, recent administrative events, role-permitted actions.
- **Election creation wizard:** (1) basic details, (2) positions and candidates, (3) voter eligibility, (4) schedule, (5) security and review, (6) approval and scheduling. Validate each step, preserve drafts, final review.
- **Candidate management:** create, edit, image upload, ordering, removal before configuration lock.
- **Voter registry:** eligible-member selection, validated CSV import, row-level errors, controlled eligibility changes. Never expose ballot selections.
- **Results review:** tally review, consistency checks, approval, publication, recount requests. No publication while open or with approval incomplete.
- **Audit records:** filtered, paginated, read-only; access checks; export restrictions. No secret ballot contents.

## Mandatory frontend states

Loading · Empty · Success · Validation error · API error · Permission denied · Session expired · Network failure · Retry · Disabled action · Confirmation · Outcome unknown.

If ballot submission times out, do not assume failure. Check participation status or retry with the **same idempotency key**. Never create a new credential or submit a second independent ballot because the browser did not receive the first response.

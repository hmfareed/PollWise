# Pollwise — Documentation Index

**Authoritative Specification Suite v2.0 (October 2026)**  
Python / FastAPI · React / TypeScript · shadcn/ui · PostgreSQL 17 (3-DB Isolation) · Blind-Token Ballot-Box  

---

## 🌟 Primary Authoritative Specification Suite (`docs/spec/`)

The following five documents form the definitive, unified implementation specification suite for Pollwise:

1. **[01 Functional Specification](spec/01-functional-specification.md)**  
   *The complete 24-section product specification:* System roles (7-role hierarchy), public website, authentication, institution onboarding, election creation wizard, candidate applications, voter eligibility rolls, voter dashboard & secret voting booth, monitoring, tally & multi-signature approvals, recount handling, and definition of done.

2. **[02 Database Schema Specification](spec/02-database-schema.md)**  
   *Complete multi-database PostgreSQL relational architecture:* Full table DDL, UUID primary keys, foreign keys (within-DB only), indexes, and constraints across `identity_db`, `election_db`, and `ballot_db` with strict zero-linkage privacy decoupling.

3. **[03 API Contracts Specification](spec/03-api-contracts.md)**  
   *Complete REST API & Ballot-Box interface definitions:* Request/response schemas, ISO 8601 UTC timestamps, RFC 7807 problem details, blind voting credential issuance, anonymous ballot submission (`/ballot-box/v1/ballots`), and complete RBAC matrix across all 7 roles.

4. **[04 Frontend Routes & Components Specification](spec/04-frontend-routes-components.md)**  
   *React 19 + TypeScript + shadcn/ui application architecture:* Client route hierarchy (Public, Admin, Voter, Platform Super Admin), responsive layout shell, UI primitives, TanStack Query hooks, form validation (React Hook Form + Zod), and step-by-step interactive workflows.

5. **[05 Security Architecture Specification](spec/05-security-architecture.md)**  
   *High-assurance security and privacy protocol:* Two-stage blind credential protocol, detached cookie-free ballot submission, multi-DB role isolation (`identity_user`, `election_user`, `ballot_user`, `tally_ro_user`), Argon2id password hashing, sliding session timeouts, audit log invariants, and threat mitigations.

---

## 📚 Historical Reference Documents (v1.0 Baseline)

The numbered files below represent the initial development draft and historical background records. Where any discrepancy exists, the documents in **[`docs/spec/`](spec/)** take precedence.

### Product & Architecture
- [01 Product definition](01-product-definition.md)
- [02 Technical architecture](02-technical-architecture.md)
- [19 Threat model](19-threat-model.md)
- [20 Credential lifecycle](20-credential-lifecycle.md)
- [25 Decision records](25-decision-records.md)

### Data Model & Backend
- [03 Data model overview](03-data-model-overview.md)
- [04 Identity database](04-identity-database.md)
- [05 Election database](05-election-database.md)
- [06 Ballot database](06-ballot-database.md)
- [07 Authentication and authorization](07-authentication-authorization.md)
- [08 Election lifecycle](08-election-lifecycle.md)
- [09 API contracts](09-api-contracts.md)
- [21 Error codes](21-error-codes.md)

### Frontend, Setup & Quality
- [10 Frontend implementation](10-frontend-implementation.md)
- [11 Project setup](11-project-setup.md)
- [12 Testing and verification](12-testing-verification.md)
- [13 Cloud deployment and operations](13-deployment-operations.md)
- [14 Privacy, governance and assurance](14-privacy-governance-assurance.md)
- [18 Final release gate](18-release-gate.md)
- [22 Configuration reference](22-configuration-reference.md)
- [23 Operations runbook](23-operations-runbook.md)
- [24 Glossary](24-glossary.md)
- [26 Changes from previous spec](26-changes-from-previous-spec.md)
- [27 Complete Signup-to-Admin-Panel Specification](27-complete-signup-to-admin-panel-specification.md)

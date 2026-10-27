# Pollwise — Secure Institutional Voting Platform

**Pollwise** is a high-assurance, production-oriented institutional voting platform designed for universities, student unions, academic departments, professional associations, and organizations.

The system is built on strict ballot secrecy, auditable election lifecycles, and separation of duties.

---

## Architecture Overview

Pollwise follows a **modular monolith architecture** coupled with an isolated **ballot-box subsystem** (ADR-001):

- **Backend**: Python 3.12+ / FastAPI / SQLAlchemy 2.0 (asyncio + asyncpg) / Pydantic v2 / Alembic
- **Frontend**: React 19 / TypeScript (strict) / Vite / Tailwind CSS / shadcn/ui / TanStack Query
- **Database Isolation**: Three logically separated PostgreSQL databases with distinct least-privilege database roles:
  - `identity_db`: User accounts, organization memberships, voter eligibility records, and single-use entitlement tracking (`unused → issued → redeemed`).
  - `election_db`: Election configurations, positions, candidates, frozen configuration hashes, lifecycle approvals, versioned tally results, and tamper-evident audit logs.
  - `ballot_db`: Anonymous ballots and atomic credential-redemption records. **Strictly decoupled from voter IDs and personal identity.**

```
                        VOTERS & ADMINISTRATORS
                                  │
                                HTTPS
                                  │
                       React + TypeScript UI
                                  │
                         FastAPI API Gateway
                        /                   \
        Identity & Eligibility          Election Management
                  │                              │
         `identity_db` (PostgreSQL)      `election_db` (PostgreSQL)
                  │
        One-Time Voting Credential (CSPRNG)
                  │
        Isolated Submission (credentials: "omit")
                  ▼
              Ballot-Box
                  │
          `ballot_db` (PostgreSQL)
                  │
          Anonymous Ballots
```

---

## Directory Structure

```text
Pollwise/
├── docs/                      # Authoritative technical specifications (01-26)
├── backend/                   # FastAPI application & ballot-box services
│   ├── app/
│   │   ├── api/v1/            # API endpoints (/health, /ready, etc.)
│   │   ├── core/              # Config, settings validation, error codes
│   │   ├── db/                # Async engine & session pooling for isolated DBs
│   │   ├── schemas/           # Standardized request/response envelopes
│   │   └── main.py            # FastAPI entry point & CORS configuration
│   ├── migrations/            # Alembic database migrations
│   ├── tests/                 # Pytest test suite
│   ├── pyproject.toml         # Python package manifest & dependencies
│   └── Dockerfile             # Container definition for backend
├── frontend/                  # React & TypeScript client
│   ├── src/
│   │   ├── app/               # React Router & TanStack Query providers
│   │   ├── components/ui/     # Reusable UI primitives (Button, Card, Badge)
│   │   ├── layouts/           # AppShell with navigation & live health monitor
│   │   ├── lib/               # Resilient API client & utilities
│   │   ├── pages/             # Overview, Elections, Admin console
│   │   └── types/             # API contract TypeScript definitions
│   ├── package.json           # Frontend dependencies & scripts
│   ├── vite.config.ts         # Vite build & Vitest test runner configuration
│   └── Dockerfile             # Container definition for frontend
├── deployment/
│   └── docker/
│       └── init-multi-db.sql  # Multi-database & least-privilege role setup
├── docker-compose.yml         # Container orchestration for local dev
├── .env.example               # Environment variables template
├── .gitignore
└── README.md
```

---

## Quick Start (Local Development)

### Prerequisites
- [Docker Desktop](https://www.docker.com/) (recommended) **OR** local PostgreSQL 16+
- [uv](https://docs.astral.sh/uv/) for Python environment management
- [Node.js 20+](https://nodejs.org/) and npm

### 1. Using Docker Compose (Full Stack)

```bash
# Clone and enter directory
cd Pollwise

# Copy environment template
cp .env.example .env

# Spin up PostgreSQL (with identity_db, election_db, ballot_db), backend, and frontend
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- Interactive API Docs: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5433` (isolated roles initialized via `deployment/docker/init-multi-db.sql`)

---

### 2. Running Locally (Direct Dev Mode)

#### Backend Setup

```bash
cd backend

# Create virtual environment and install dependencies
uv venv
uv pip install -e ".[dev]"

# Start backend server
.\.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

#### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

---

## Testing & Quality Gates

### Backend Tests & Verification
Run the Pytest suite covering configuration validation, error code envelopes, engine health checks, and database session isolation:

```bash
cd backend
.\.venv\Scripts\pytest -v
.\.venv\Scripts\ruff check app tests
```

### Frontend Tests & Type Checking
Run Vitest unit tests, linter, and TypeScript compiler check:

```bash
cd frontend
npm run test     # Runs Vitest unit tests
npm run lint     # Runs Oxlint code style checks
npm run build    # Strict TypeScript compilation (tsc -b) & Vite bundle
```

---

## Health & Readiness Probes

Pollwise exposes standardized health endpoints under `/api/v1`:

- **`GET /api/v1/health`**: Lightweight liveness probe returning overall service status and environment.
  ```json
  {
    "data": {
      "status": "healthy",
      "environment": "development",
      "version": "0.1.0"
    },
    "error": null
  }
  ```
- **`GET /api/v1/ready`**: Deep readiness probe querying connectivity to all three isolated databases. Returns HTTP 200 when ready, HTTP 503 when degraded.
  ```json
  {
    "data": {
      "ready": true,
      "databases": {
        "identity_db": { "connected": true, "database": "identity_db", "latency_ms": 1.2 },
        "election_db": { "connected": true, "database": "election_db", "latency_ms": 0.9 },
        "ballot_db": { "connected": true, "database": "ballot_db", "latency_ms": 1.1 }
      }
    },
    "error": null
  }
  ```

---

## Security & Ballot Secrecy Non-Negotiables

1. **Separation of Concerns**: Voter identification and eligibility checks are strictly isolated from anonymous ballot storage.
2. **Credential Lifecycle**: Ballots are submitted using single-use cryptographically random credentials redeemed atomically within the ballot-box service.
3. **No Correlation**: The ballot box runs with `credentials: "omit"`, receives zero voter IDs or session cookies, and stores non-revealing random receipts.
4. **Lifecycle Locks**: Election definitions freeze at the `scheduled` stage. No ballot submission is permitted before opening or after closing.
5. **No Interim Leaks**: Election results are tallied deterministically only after the election has closed, and require multi-role approval before publication.

---

## Roadmap

- [x] **Phase 1: Project Foundation & Architecture Baseline** (Complete)
- [ ] **Phase 2: Identity, Authentication & Role-Based Access Control** (Next)
- [ ] **Phase 3: Election Management, Configuration Freezing & Approvals**
- [ ] **Phase 4: Voter Eligibility & Isolated Ballot-Box Infrastructure**
- [ ] **Phase 5: Multi-Position Voting Interface & Submission Flows**
- [ ] **Phase 6: Closed-Election Tallying, Approval & Result Publication**
- [ ] **Phase 7: Hardening, Security Assurance & Staging Drills**

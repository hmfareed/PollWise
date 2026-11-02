# Pollwise Institution Admin Dashboard Functional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Pollwise Institution Admin Dashboard as a fully functional, real-data-driven interface with zero hardcoded or seeded numbers, strict institution scoping, dynamic SVG charts, and authentic empty states.

**Architecture:** A dedicated institution-scoped backend summary endpoint (`GET /api/v1/organizations/{organization_id}/dashboard/summary`) calculates real-time metrics across `election_db` (elections, positions, candidates, approvals, audit logs) and `identity_db` (unique deduplicated eligible voters), supporting period filtering (`last_30_days`, `last_3_months`, `last_6_months`, `last_12_months`). The React frontend queries this summary via TanStack Query and renders dynamic SVG trend sparklines, a dynamic multi-line spline chart, a dynamic donut chart, live upcoming deadlines, and real audit events, with zero fake fallbacks.

**Tech Stack:** 
- Backend: Python 3.14, FastAPI, SQLAlchemy 2.0 (async), PostgreSQL
- Frontend: React 19, TypeScript, TanStack React Query, Tailwind CSS, Lucide React
- Testing: Pytest with async HTTP client, Vitest with React Testing Library

**Spec:** Pollwise Admin Dashboard — Functional Implementation Prompt

## Global Constraints

- **Zero Seeded / Mocked Data:** Absolutely no hardcoded numbers (`|| 12`, `|| 8,450`, `|| 86`, `|| 3`), static SVG lines, placeholder deadlines, or fabricated audit records anywhere in code or database.
- **Empty State Fidelity:** When no records exist in the database, KPI cards display `0`, charts show explicit empty states ("No election activity yet"), deadlines show "No upcoming deadlines", and activity shows "No recent activity yet".
- **Strict Multi-Tenant Scoping:** All queries must be strictly filtered by the authenticated user's verified active `organization_id`. Never aggregate or expose data across institutions.
- **Voter Deduplication Rule:** Unique approved voters eligible across elections belonging to the current institution (deduplicated by `user_id`, excluding revoked or pending).
- **Trend Realism:** Period-over-period trend percentages must only be calculated when authentic previous period data exists; otherwise return `null`/omit the badge.

## Review Focus

1. **Multi-tenant cross-contamination:** Ensure `organization_id` is validated via `require_organization_role` so a user cannot query another institution's metrics.
2. **Empty database handling:** Verify that with 0 elections, 0 voters, and 0 audit logs, the backend returns clean zeroes/empty lists without 500 errors, division by zero, or null pointer exceptions.
3. **Unique voter counting across databases:** Query unique distinct `user_id` from `identity_db` where `election_id IN (org_election_ids)` and `eligibility_status = 'eligible'`. If `org_election_ids` is empty, return 0 without querying.
4. **SVG chart dynamic calculation:** Ensure spline and donut charts correctly handle dynamic arrays of intervals and values without throwing NaN/infinite SVG path coordinates.
5. **No regression in existing dashboard tabs:** Retain all existing working functionality for Elections, Positions, Candidates, Voters, Reports, and Audit tabs.

---

### Task 1: Backend Dashboard Schemas & Aggregation Models

**Files:**
- Create: `backend/app/schemas/dashboard.py`
- Modify: `backend/app/schemas/__init__.py` (if present)
- Test: `backend/tests/test_dashboard_schemas.py`

**Interfaces:**
- Consumes: `pydantic.BaseModel`, `datetime.datetime`, `uuid.UUID`
- Produces:
  - `KPIMetric(value: int, change_pct: float | None = None)`
  - `DashboardMetrics(total_elections: KPIMetric, eligible_voters: KPIMetric, registered_candidates: KPIMetric, active_elections: KPIMetric)`
  - `ChartDataPoint(label: str, timestamp: datetime, created: int, closed: int, published: int)`
  - `ElectionOverviewChart(period: str, points: list[ChartDataPoint])`
  - `ElectionStatusDonut(total: int, draft: int, scheduled: int, open: int, closed: int, published: int, canceled: int)`
  - `UpcomingDeadlineItem(election_id: uuid.UUID, title: str, deadline_type: str, deadline_at: datetime, status: str)`
  - `RecentActivityItem(id: uuid.UUID, event_type: str, description: str, timestamp: datetime, outcome: str, actor_email: str | None = None)`
  - `DashboardSummaryResponse(organization_id: uuid.UUID, organization_name: str, period: str, metrics: DashboardMetrics, election_overview: ElectionOverviewChart, election_status: ElectionStatusDonut, upcoming_deadlines: list[UpcomingDeadlineItem], recent_activity: list[RecentActivityItem])`

- [ ] **Step 1: Write the failing schema unit test**

Create `backend/tests/test_dashboard_schemas.py` asserting schema validation for empty states and populated data:

```python
import uuid
from datetime import UTC, datetime
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    DashboardMetrics,
    KPIMetric,
    ElectionOverviewChart,
    ElectionStatusDonut,
)

def test_dashboard_summary_schema_empty():
    org_id = uuid.uuid4()
    summary = DashboardSummaryResponse(
        organization_id=org_id,
        organization_name="Test Org",
        period="last_12_months",
        metrics=DashboardMetrics(
            total_elections=KPIMetric(value=0, change_pct=None),
            eligible_voters=KPIMetric(value=0, change_pct=None),
            registered_candidates=KPIMetric(value=0, change_pct=None),
            active_elections=KPIMetric(value=0, change_pct=None),
        ),
        election_overview=ElectionOverviewChart(period="last_12_months", points=[]),
        election_status=ElectionStatusDonut(
            total=0, draft=0, scheduled=0, open=0, closed=0, published=0, canceled=0
        ),
        upcoming_deadlines=[],
        recent_activity=[],
    )
    assert summary.metrics.total_elections.value == 0
    assert summary.metrics.total_elections.change_pct is None
    assert summary.election_status.total == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend\.venv\Scripts\pytest backend\tests\test_dashboard_schemas.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.schemas.dashboard'`

- [ ] **Step 3: Implement `backend/app/schemas/dashboard.py`**

Define all pydantic models with clear documentation, default values, and serialization converters.

- [ ] **Step 4: Run test to verify it passes**

Run: `backend\.venv\Scripts\pytest backend\tests\test_dashboard_schemas.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/dashboard.py backend/tests/test_dashboard_schemas.py
git commit -m "feat(backend): add dashboard summary pydantic schemas and models"
```

---

### Task 2: Backend Dashboard Service (Metrics & Period Aggregations)

**Files:**
- Create: `backend/app/services/dashboard_service.py`
- Test: `backend/tests/test_dashboard_service.py`

**Interfaces:**
- Consumes:
  - `identity_db: AsyncSession`
  - `election_db: AsyncSession`
  - `organization_id: uuid.UUID`
  - `period: str = "last_12_months"`
- Produces:
  - `DashboardService.get_institution_summary(identity_db, election_db, org_id, period="last_12_months") -> DashboardSummaryResponse`

- [ ] **Step 1: Write the failing unit test for `DashboardService`**

Create `backend/tests/test_dashboard_service.py`:
- Test 1: Empty institution returns 0 for all metrics, empty chart points, empty deadlines, empty activity, and donut total = 0.
- Test 2: Populated institution returns real counts:
  - 2 elections (1 draft, 1 open with `opens_at` and `closes_at`)
  - Candidates linked to positions in those elections
  - Distinct eligible voters linked across both elections in `identity_db` (verifying deduplication)
  - Audit event populated in `recent_activity`
  - Upcoming deadline populated in `upcoming_deadlines`

- [ ] **Step 2: Run test to verify it fails**

Run: `backend\.venv\Scripts\pytest backend\tests\test_dashboard_service.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.dashboard_service'`

- [ ] **Step 3: Implement `DashboardService` in `backend/app/services/dashboard_service.py`**

Implementation details:
1. Fetch organization details from `identity_db` (ensure it exists).
2. Query `election_db` for all elections where `organization_id == org_id`:
   - `total_elections`: `len(elections)`
   - `status_counts`: count by `status` (draft, scheduled, open, closed, published, canceled)
   - `active_elections`: count where `status == "open"`
   - `election_ids`: list of election UUIDs
3. Query `election_db` for candidate count:
   - `SELECT count(c.id) FROM candidates c JOIN positions p ON c.position_id = p.id WHERE p.election_id IN (:election_ids) AND c.status = 'active'` (or 0 if `election_ids` is empty).
4. Query `identity_db` for unique eligible voters:
   - If `election_ids` is non-empty:
     `SELECT count(DISTINCT ee.user_id) FROM election_eligibility ee WHERE ee.election_id IN (:election_ids) AND ee.eligibility_status = 'eligible'`
   - Else: 0.
5. Compute Election Overview time-series intervals for the requested period:
   - Calculate period start based on `period`:
     - `last_30_days`: 30 daily buckets
     - `last_3_months`: 12 weekly buckets or 3 monthly buckets
     - `last_6_months`: 6 monthly buckets
     - `last_12_months`: 12 monthly buckets
   - For each bucket, count elections where:
     - `created_at` falls in bucket
     - `closes_at` (or closed status) falls in bucket
     - `published_at` (or published status) falls in bucket
6. Query Upcoming Deadlines:
   - Look for future `closes_at > now` for open/scheduled elections, and `opens_at > now` for scheduled elections.
   - Order by deadline timestamp ascending, limit 5.
7. Query Recent Activity:
   - `SELECT * FROM audit_events WHERE organization_id = :org_id OR election_id IN (:election_ids) ORDER BY created_at DESC LIMIT 10`.
   - Optionally enrich with actor email if available from `identity_db`.

- [ ] **Step 4: Run test to verify it passes**

Run: `backend\.venv\Scripts\pytest backend\tests\test_dashboard_service.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/dashboard_service.py backend/tests/test_dashboard_service.py
git commit -m "feat(backend): implement DashboardService with real data aggregation"
```

---

### Task 3: Backend Dashboard API Endpoint & RBAC Authorization

**Files:**
- Create: `backend/app/api/v1/dashboard.py`
- Modify: `backend/app/api/v1/router.py:1-40`
- Test: `backend/tests/test_admin_dashboard_api.py`

**Interfaces:**
- Consumes:
  - `GET /api/v1/organizations/{organization_id}/dashboard/summary?period=last_12_months`
  - Authentication: `get_current_user`
  - Authorization: `require_organization_role(["owner", "admin", "organization_admin", "election_manager", "auditor"])`
  - Sessions: `get_identity_session`, `get_election_session`
- Produces:
  - `ApiResponse[DashboardSummaryResponse]`

- [ ] **Step 1: Write the failing API integration test**

Create `backend/tests/test_admin_dashboard_api.py`:
- Test unauthenticated request returns 401.
- Test member from another organization returns 403.
- Test authorized admin gets 200 with zero metrics for brand new organization.
- Test authorized admin gets 200 with populated metrics when elections/voters exist.
- Test invalid period parameter handling.

- [ ] **Step 2: Run test to verify it fails**

Run: `backend\.venv\Scripts\pytest backend\tests\test_admin_dashboard_api.py`
Expected: FAIL with 404 Not Found (endpoint does not exist yet)

- [ ] **Step 3: Implement dashboard endpoint and mount to router**

- Implement `backend/app/api/v1/dashboard.py` with `GET /organizations/{organization_id}/dashboard/summary`.
- Include router in `backend/app/api/v1/router.py`.

- [ ] **Step 4: Run test to verify it passes**

Run: `backend\.venv\Scripts\pytest backend\tests\test_admin_dashboard_api.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/dashboard.py backend/app/api/v1/router.py backend/tests/test_admin_dashboard_api.py
git commit -m "feat(backend): expose institution-scoped dashboard summary API endpoint with RBAC"
```

---

### Task 4: Frontend Dashboard Types & API Client Integration

**Files:**
- Create: `frontend/src/types/dashboard.ts`
- Modify: `frontend/src/lib/api-client.ts`
- Test: `frontend/src/test/api-client-dashboard.test.ts`

**Interfaces:**
- Consumes: `DashboardSummaryResponse`, `DashboardPeriod = "last_30_days" | "last_3_months" | "last_6_months" | "last_12_months"`
- Produces:
  - `apiClient.getDashboardSummary(organizationId: string, period?: string): Promise<DashboardSummaryResponse>`

- [ ] **Step 1: Write failing frontend API client test**

Create `frontend/src/test/api-client-dashboard.test.ts`:
- Test `getDashboardSummary` calls `/organizations/${orgId}/dashboard/summary?period=${period}`.
- Test error propagation on network failure or 403 Forbidden.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend -- src/test/api-client-dashboard.test.ts`
Expected: FAIL with `apiClient.getDashboardSummary is not a function`

- [ ] **Step 3: Define TypeScript interfaces and implement `getDashboardSummary`**

- Create `frontend/src/types/dashboard.ts`.
- Export method in `frontend/src/lib/api-client.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix frontend -- src/test/api-client-dashboard.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/dashboard.ts frontend/src/lib/api-client.ts frontend/src/test/api-client-dashboard.test.ts
git commit -m "feat(frontend): add dashboard summary API client and TypeScript definitions"
```

---

### Task 5: Dynamic SVG Chart Components with Empty States

**Files:**
- Create: `frontend/src/components/dashboard/ElectionOverviewChart.tsx`
- Create: `frontend/src/components/dashboard/ElectionStatusDonut.tsx`
- Create: `frontend/src/components/dashboard/KPICard.tsx`
- Test: `frontend/src/test/dashboard-charts.test.tsx`

**Interfaces:**
- Consumes:
  - `ElectionOverviewChart`: `points: ChartDataPoint[]`, `period: string`, `onPeriodChange: (p: string) => void`, `isLoading?: boolean`
  - `ElectionStatusDonut`: `statusData: ElectionStatusDonutData`, `isLoading?: boolean`
  - `KPICard`: `title: string`, `value: number`, `changePct?: number | null`, `icon: LucideIcon`, `trendColor?: string`, `sparklinePoints?: number[]`
- Produces:
  - Pure, robust SVG charts that dynamically render coordinate splines and donut arcs.
  - Informative empty states when series are empty or all 0s:
    - Election Overview: "No election activity yet - Create an election to start seeing your institution's election trends."
    - Donut: "0 Total" center text with subtle empty ring and legend displaying 0 for all statuses.

- [ ] **Step 1: Write unit tests for chart components**

Create `frontend/src/test/dashboard-charts.test.tsx`:
- Test `ElectionOverviewChart` displays empty state message when points are all zero or empty.
- Test `ElectionOverviewChart` renders dynamic SVG paths when points exist.
- Test `ElectionStatusDonut` displays "0 Total" and 0 counts when empty.
- Test `ElectionStatusDonut` displays slice calculations when populated.
- Test `KPICard` does not render a fake trend pill when `changePct` is `null`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend -- src/test/dashboard-charts.test.tsx`
Expected: FAIL (components do not exist)

- [ ] **Step 3: Implement dynamic SVG components**

- Implement `frontend/src/components/dashboard/ElectionOverviewChart.tsx`:
  - Calculate normalized SVG viewBox coordinates `(x, y)` based on dynamic `max(data.points)` (with fallback min height 10).
  - Construct SVG smooth spline curves using cubic Bezier or polyline with real point coordinates.
  - Include period selector buttons ("Last 30 Days", "Last 3 Months", "Last 6 Months", "Last 12 Months").
- Implement `frontend/src/components/dashboard/ElectionStatusDonut.tsx`:
  - Standard SVG circle with `strokeDasharray` and `strokeDashoffset` dynamically computed from `seg.count / total`.
  - Center displays `total` and "Total".
- Implement `frontend/src/components/dashboard/KPICard.tsx`:
  - Renders real value with `toLocaleString()`.
  - Renders trend badge only if `changePct !== null && changePct !== undefined`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix frontend -- src/test/dashboard-charts.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/dashboard/ frontend/src/test/dashboard-charts.test.tsx
git commit -m "feat(frontend): implement dynamic SVG chart components and KPI card with clean empty states"
```

---

### Task 6: Connect `AdminDashboardPage.tsx` to Real Backend Data

**Files:**
- Modify: `frontend/src/pages/AdminDashboardPage.tsx`
- Test: `frontend/src/test/elections-pages.test.tsx`
- Test: `frontend/src/test/admin-dashboard-functional.test.tsx`

**Interfaces:**
- Consumes:
  - `apiClient.getDashboardSummary(selectedOrgId, selectedPeriod)`
  - Replaces all hardcoded numbers: `{totalElections || 12}`, `{voterCount ? ... : "8,450"}`, `{candidateCount || 86}`, `{activeCount || 3}`.
  - Replaces static upcoming deadlines with real `data.upcoming_deadlines` (and empty state "No upcoming deadlines").
  - Replaces static recent activity with real `data.recent_activity` (and empty state "No recent activity yet").
  - Links Quick Actions to functional routes (`/admin/elections/new`, `tab=candidates`, `tab=voters`, `tab=positions`).
  - Connects Security Panel to `/audit` / documentation.

- [ ] **Step 1: Write integration tests for `AdminDashboardPage` real-data rendering**

Create `frontend/src/test/admin-dashboard-functional.test.tsx`:
- Test 1: Empty state test — mock summary endpoint returning zeroes:
  - KPI cards render `0` (not 12, 8450, 86, 3).
  - "No election activity yet" is rendered.
  - "No upcoming deadlines" is rendered.
  - "No recent activity yet" is rendered.
  - Donut displays "0" and "Total".
- Test 2: Populated state test — mock summary endpoint returning real records:
  - KPI cards render populated counts.
  - Deadlines list renders actual election titles and countdowns.
  - Activity list renders actual events and timestamps.
  - Quick action clicks switch tabs or navigate to election creation.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend -- src/test/admin-dashboard-functional.test.tsx`
Expected: FAIL (currently renders hardcoded 12, 8450, static deadlines, etc.)

- [ ] **Step 3: Refactor `AdminDashboardPage.tsx`**

- Add `useQuery` for `dashboardSummary`:
  ```tsx
  const activeOrgId = (selectedOrgId !== "all" && selectedOrgId) || organizations?.[0]?.id || "";
  const [dashboardPeriod, setDashboardPeriod] = useState<string>("last_12_months");
  const { data: dashboardSummary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["admin-dashboard-summary", activeOrgId, dashboardPeriod],
    queryFn: () => apiClient.getDashboardSummary(activeOrgId, dashboardPeriod),
    enabled: !!activeOrgId && activeTab === "dashboard",
  });
  ```
- Replace hardcoded KPI cards with `KPICard` connected to `dashboardSummary.metrics`.
- Replace static multi-line spline SVG with `ElectionOverviewChart` connected to `dashboardSummary.election_overview`.
- Replace static donut SVG with `ElectionStatusDonut` connected to `dashboardSummary.election_status`.
- Render Upcoming Deadlines from `dashboardSummary.upcoming_deadlines`, with "No upcoming deadlines" empty state.
- Render Recent Activity from `dashboardSummary.recent_activity`, with "No recent activity yet" empty state.
- Ensure all quick action buttons navigate properly.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix frontend -- src/test/admin-dashboard-functional.test.tsx`
Expected: PASS

- [ ] **Step 5: Run existing elections page tests to prevent regression**

Run: `npm test --prefix frontend -- src/test/elections-pages.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/AdminDashboardPage.tsx frontend/src/test/admin-dashboard-functional.test.tsx frontend/src/test/elections-pages.test.tsx
git commit -m "feat(frontend): wire AdminDashboardPage to live backend summary API without fallbacks"
```

---

### Task 7: Comprehensive End-to-End Verification & Verification Gate

**Files:**
- Create: `backend/tests/test_dashboard_e2e.py`
- Test: Full backend and frontend test suites

- [ ] **Step 1: Write E2E test verifying zero data on fresh institution vs populated data after election lifecycle actions**

Create `backend/tests/test_dashboard_e2e.py`:
1. Register user and create new institution.
2. Verify dashboard summary returns completely zeroed state.
3. Create election in institution -> verify `total_elections == 1`, `draft == 1`.
4. Add position and candidate -> verify `registered_candidates == 1`.
5. Add voter eligibility -> verify `eligible_voters == 1`.
6. Launch election -> verify `active_elections == 1`, `open == 1`, and deadline appears.
7. Verify `audit_events` reflect recent actions.

- [ ] **Step 2: Run backend tests**

Run: `backend\.venv\Scripts\pytest backend\tests`
Expected: All tests PASS.

- [ ] **Step 3: Run frontend tests & production build**

Run: `npm test --prefix frontend`
Run: `npm run build --prefix frontend`
Expected: All tests pass and build succeeds cleanly.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_dashboard_e2e.py
git commit -m "test(dashboard): add full E2E lifecycle test verifying real dashboard metrics"
```

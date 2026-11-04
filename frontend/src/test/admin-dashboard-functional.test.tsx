import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../features/auth/AuthContext";
import { AdminDashboardPage } from "../pages/AdminDashboardPage";
import { apiClient } from "../lib/api-client";
import type { DashboardSummaryResponse } from "../types/dashboard";
import type { Organization } from "../types/organization";

const mockOrgs: Organization[] = [
  {
    id: "org-123",
    name: "University of Excellence",
    slug: "univ-excellence",
    status: "verified",
    created_at: "2026-01-01T00:00:00Z",
  },
];

const emptySummary: DashboardSummaryResponse = {
  organization_id: "org-123",
  organization_name: "University of Excellence",
  period: "last_12_months",
  metrics: {
    total_elections: { value: 0, change_pct: null },
    eligible_voters: { value: 0, change_pct: null },
    registered_candidates: { value: 0, change_pct: null },
    active_elections: { value: 0, change_pct: null },
  },
  election_overview: {
    period: "last_12_months",
    points: [],
  },
  election_status: {
    total: 0,
    draft: 0,
    scheduled: 0,
    open: 0,
    closed: 0,
    published: 0,
    canceled: 0,
  },
  upcoming_deadlines: [],
  recent_activity: [],
};

const populatedSummary: DashboardSummaryResponse = {
  organization_id: "org-123",
  organization_name: "University of Excellence",
  period: "last_12_months",
  metrics: {
    total_elections: { value: 14, change_pct: 20 },
    eligible_voters: { value: 9200, change_pct: 12 },
    registered_candidates: { value: 42, change_pct: 8 },
    active_elections: { value: 2, change_pct: 0 },
  },
  election_overview: {
    period: "last_12_months",
    points: [
      { label: "Jan 2026", timestamp: "2026-01-01T00:00:00Z", created: 2, closed: 1, published: 1 },
      { label: "Feb 2026", timestamp: "2026-02-01T00:00:00Z", created: 5, closed: 3, published: 2 },
    ],
  },
  election_status: {
    total: 14,
    draft: 2,
    scheduled: 3,
    open: 2,
    closed: 5,
    published: 2,
    canceled: 0,
  },
  upcoming_deadlines: [
    {
      election_id: "elec-1",
      title: "Student Union Leadership",
      deadline_type: "Voting Closes",
      deadline_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: "open",
    },
    {
      election_id: "elec-2",
      title: "Faculty Council 2026",
      deadline_type: "Voting Starts",
      deadline_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      status: "scheduled",
    },
  ],
  recent_activity: [
    {
      id: "act-1",
      event_type: "election_created",
      description: "Election 'Student Union Leadership' was created",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      outcome: "success",
      actor_email: "admin@excellence.edu",
    },
    {
      id: "act-2",
      event_type: "candidates_added",
      description: "5 new candidates added",
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      outcome: "success",
      actor_email: "admin@excellence.edu",
    },
  ],
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("AdminDashboardPage Functional & Real Data Wiring", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, "getOrganizations").mockResolvedValue(mockOrgs);
    vi.spyOn(apiClient, "getReadiness").mockResolvedValue({
      ready: true,
      databases: {},
    });
    vi.spyOn(apiClient, "getElections").mockResolvedValue([]);
  });

  it("renders empty state authentically without hardcoded fallbacks", async () => {
    vi.spyOn(apiClient, "getDashboardSummary").mockResolvedValue(emptySummary);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <AdminDashboardPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Wait for data to load
    await waitFor(() => {
      expect(apiClient.getDashboardSummary).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText("No upcoming deadlines")).toBeInTheDocument();
    });

    expect(screen.queryByText("8,450")).not.toBeInTheDocument();
    expect(screen.queryByText("8450")).not.toBeInTheDocument();
    expect(screen.queryByText("86")).not.toBeInTheDocument();

    // All KPIs should display 0
    const zeroElements = screen.getAllByText("0");
    expect(zeroElements.length).toBeGreaterThanOrEqual(4);

    // Chart empty state
    expect(await screen.findByText("No election activity yet")).toBeInTheDocument();
    expect(
      screen.getByText("Create an election to start seeing your institution's election trends.")
    ).toBeInTheDocument();

    // Donut empty state
    expect(screen.getByText("Total")).toBeInTheDocument();

    // Upcoming Deadlines empty state
    expect(screen.getByText("No upcoming deadlines")).toBeInTheDocument();
    expect(
      screen.getByText("Scheduled election dates and voting windows will appear here.")
    ).toBeInTheDocument();

    // Recent Activity empty state
    expect(screen.getByText("No recent activity yet")).toBeInTheDocument();
    expect(
      screen.getByText("Audit and operational logs will appear here as actions occur.")
    ).toBeInTheDocument();
  });

  it("renders populated state with live metrics, deadlines, and activity logs", async () => {
    vi.spyOn(apiClient, "getDashboardSummary").mockResolvedValue(populatedSummary);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <AdminDashboardPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    // KPI values
    await waitFor(() => {
      expect(screen.getByText("9,200")).toBeInTheDocument();
    });
    expect(screen.getAllByText("14").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);

    // Deadlines
    expect(screen.getByText("Student Union Leadership")).toBeInTheDocument();
    expect(screen.getByText("Closes in 2 days")).toBeInTheDocument();
    expect(screen.getByText("Faculty Council 2026")).toBeInTheDocument();
    expect(screen.getByText("Starts in 5 days")).toBeInTheDocument();

    // Activity
    expect(
      screen.getByText("Election 'Student Union Leadership' was created")
    ).toBeInTheDocument();
    expect(screen.getByText("5 new candidates added")).toBeInTheDocument();
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();
    expect(screen.getByText("3 hours ago")).toBeInTheDocument();

    // Donut Legend
    expect(screen.getByText("Election Status")).toBeInTheDocument();
  });

  it("supports quick action button navigation", async () => {
    vi.spyOn(apiClient, "getDashboardSummary").mockResolvedValue(emptySummary);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <AdminDashboardPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Add Candidates/i })).toBeInTheDocument();
    });

    // Clicking Add Candidates switches workspace tab
    const addCandidatesBtn = screen.getByRole("button", { name: /Add Candidates/i });
    fireEvent.click(addCandidatesBtn);

    // Should now be on candidates workspace (indicated by candidate management heading or controls)
    expect(
      await screen.findByRole("heading", { name: /Candidate Profiles & Management/i })
    ).toBeInTheDocument();
  });

  it("renders candidate photo on candidate cards and includes photo upload in add candidate modal", async () => {
    const mockDetailWithPhoto = {
      id: "elec-photo-1",
      organization_id: "org-123",
      title: "Student Council Election",
      description: "Annual representative board",
      status: "draft" as const,
      opens_at: "2026-11-10T09:00:00Z",
      closes_at: "2026-11-12T17:00:00Z",
      timezone: "UTC",
      voting_method: "plurality",
      configuration_version: 1,
      created_by: "user-1",
      created_at: "2026-11-01T10:00:00Z",
      updated_at: "2026-11-01T10:00:00Z",
      positions: [
        {
          id: "pos-1",
          election_id: "elec-photo-1",
          title: "President",
          description: "Executive Leader",
          min_selections: 1,
          max_selections: 1,
          display_order: 0,
          candidates: [
            {
              id: "cand-1",
              position_id: "pos-1",
              name: "Jordan Lee",
              biography: "Dedicated student advocate",
              photo_url: "/static/uploads/candidates/jordan.png",
              display_order: 0,
              status: "active",
              created_at: "2026-11-01T10:00:00Z",
            },
          ],
        },
      ],
    };

    vi.spyOn(apiClient, "getDashboardSummary").mockResolvedValue(populatedSummary);
    vi.spyOn(apiClient, "getElections").mockResolvedValue([mockDetailWithPhoto]);
    vi.spyOn(apiClient, "getElection").mockResolvedValue(mockDetailWithPhoto);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <AdminDashboardPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Navigate to candidates workspace tab
    const addCandidatesBtn = await screen.findByRole("button", { name: /Add Candidates/i });
    fireEvent.click(addCandidatesBtn);

    // Verify candidate with photo displays image with src
    const candidateImg = await screen.findByRole("img", { name: "Jordan Lee" });
    expect(candidateImg).toHaveAttribute("src", "http://localhost:8000/static/uploads/candidates/jordan.png");

    // Open Add Candidate modal
    const addCandidateBtn = screen.getByRole("button", { name: /^Add Candidate$/i });
    fireEvent.click(addCandidateBtn);

    // Verify Candidate Profile Picture upload component is present in modal
    expect(screen.getByText("Candidate Profile Picture")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Upload Candidate Photo/i })).toBeInTheDocument();
  });
});

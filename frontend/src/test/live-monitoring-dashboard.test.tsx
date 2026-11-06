import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../features/auth/AuthContext";
import { TurnoutVelocityChart } from "../components/elections/TurnoutVelocityChart";
import { ElectionDetailPage } from "../pages/ElectionDetailPage";
import { apiClient } from "../lib/api-client";
import type { ElectionDetail, LiveMonitoringData } from "../types/election";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe("TurnoutVelocityChart Component", () => {
  it("renders SVG elements and smooth path when velocity data is provided", () => {
    const velocity = [
      { timestamp: "2026-11-06T10:00:00Z", ballots_count: 10, cumulative_ballots: 10 },
      { timestamp: "2026-11-06T11:00:00Z", ballots_count: 25, cumulative_ballots: 35 },
      { timestamp: "2026-11-06T12:00:00Z", ballots_count: 15, cumulative_ballots: 50 },
    ];

    render(<TurnoutVelocityChart velocity={velocity} />);
    expect(screen.getByText("Turnout Velocity")).toBeInTheDocument();
    expect(screen.getByTestId("velocity-svg-chart")).toBeInTheDocument();
  });

  it("handles empty velocity data without throwing", () => {
    render(<TurnoutVelocityChart velocity={[]} />);
    expect(screen.getByText("Turnout Velocity")).toBeInTheDocument();
    expect(screen.getByText(/Awaiting ballot data/i)).toBeInTheDocument();
  });
});

describe("ElectionDetailPage Live Monitoring & Emergency Controls", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, "getMe").mockResolvedValue({
      user: {
        id: "admin-1",
        email: "admin@pollwise.edu",
        display_name: "Admin User",
        account_status: "active",
        created_at: "2026-10-01T00:00:00Z",
      },
      memberships: [
        {
          id: "m-1",
          organization_id: "org-1",
          organization_name: "Test Org",
          organization_slug: "test-org",
          role: "organization_admin",
          status: "active",
        },
      ],
    });
  });

  it("renders Pause Election button on open election and opens emergency modal", async () => {
    const mockElection: ElectionDetail = {
      id: "elec-open-1",
      organization_id: "org-1",
      title: "Student Senate General Election",
      description: "Annual senate voting",
      status: "open",
      opens_at: "2026-11-06T08:00:00Z",
      closes_at: "2026-11-06T20:00:00Z",
      timezone: "UTC",
      voting_method: "single_choice",
      configuration_version: 1,
      configuration_hash: "hash",
      created_by: "user-admin",
      created_at: "2026-11-06T08:00:00Z",
      updated_at: "2026-11-06T08:00:00Z",
      positions: [],
    };

    vi.spyOn(apiClient, "getElection").mockResolvedValue(mockElection);
    vi.spyOn(apiClient, "getParticipationSummary").mockResolvedValue({
      election_id: "elec-open-1",
      total_eligible: 100,
      ballots_cast: 20,
      turnout_percentage: 20.0,
    });
    vi.spyOn(apiClient, "getElectionAudit").mockResolvedValue([]);
    vi.spyOn(apiClient, "getElectionMonitoring").mockResolvedValue({
      election_id: "elec-open-1",
      status: "open",
      total_eligible: 100,
      ballots_cast: 20,
      turnout_percentage: 20.0,
      velocity: [],
      departmental_turnout: [],
      health: { ballot_box_status: "healthy", credential_service_status: "healthy", database_status: "healthy" },
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/elections/elec-open-1"]}>
            <Routes>
              <Route path="/elections/:id" element={<ElectionDetailPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Student Senate General Election" })).toBeInTheDocument();
    });

    // Check Pause Election button in lifecycle actions
    const pauseBtn = screen.getByRole("button", { name: /Pause Election/i });
    expect(pauseBtn).toBeInTheDocument();

    fireEvent.click(pauseBtn);

    // Modal should be opened
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Confirm Pause")).toBeInTheDocument();
  });

  it("renders EmergencyStatusBanner when election is in paused state", async () => {
    const mockElection: ElectionDetail = {
      id: "elec-paused-1",
      organization_id: "org-1",
      title: "Faculty Board Election",
      description: "Annual board voting",
      status: "paused",
      opens_at: "2026-11-06T08:00:00Z",
      closes_at: "2026-11-06T20:00:00Z",
      timezone: "UTC",
      voting_method: "single_choice",
      configuration_version: 1,
      configuration_hash: "hash",
      paused_at: "2026-11-06T12:00:00Z",
      pause_reason: "Server infrastructure maintenance in progress",
      created_by: "user-admin",
      created_at: "2026-11-06T08:00:00Z",
      updated_at: "2026-11-06T12:00:00Z",
      positions: [],
    };

    vi.spyOn(apiClient, "getElection").mockResolvedValue(mockElection);
    vi.spyOn(apiClient, "getParticipationSummary").mockResolvedValue({
      election_id: "elec-paused-1",
      total_eligible: 100,
      ballots_cast: 25,
      turnout_percentage: 25.0,
    });
    vi.spyOn(apiClient, "getElectionAudit").mockResolvedValue([]);
    vi.spyOn(apiClient, "getElectionMonitoring").mockResolvedValue({
      election_id: "elec-paused-1",
      status: "paused",
      total_eligible: 100,
      ballots_cast: 25,
      turnout_percentage: 25.0,
      paused_at: "2026-11-06T12:00:00Z",
      pause_reason: "Server infrastructure maintenance in progress",
      velocity: [],
      departmental_turnout: [],
      health: { ballot_box_status: "healthy", credential_service_status: "healthy", database_status: "healthy" },
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/elections/elec-paused-1"]}>
            <Routes>
              <Route path="/elections/:id" element={<ElectionDetailPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Faculty Board Election" })).toBeInTheDocument();
    });

    // Check banner elements
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Election is Temporarily Paused")).toBeInTheDocument();
    expect(screen.getByText(/Server infrastructure maintenance in progress/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Resume Election/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("renders live monitoring tab with velocity chart, health, and privacy thresholded departments", async () => {
    const mockElection: ElectionDetail = {
      id: "elec-monitoring-1",
      organization_id: "org-1",
      title: "Campus Representative Election",
      description: "Annual campus election",
      status: "open",
      opens_at: "2026-11-06T08:00:00Z",
      closes_at: "2026-11-06T20:00:00Z",
      timezone: "UTC",
      voting_method: "single_choice",
      configuration_version: 1,
      configuration_hash: "hash",
      created_by: "user-admin",
      created_at: "2026-11-06T08:00:00Z",
      updated_at: "2026-11-06T08:00:00Z",
      positions: [],
    };

    vi.spyOn(apiClient, "getElection").mockResolvedValue(mockElection);
    vi.spyOn(apiClient, "getParticipationSummary").mockResolvedValue({
      election_id: "elec-monitoring-1",
      total_eligible: 120,
      ballots_cast: 45,
      turnout_percentage: 37.5,
    });
    vi.spyOn(apiClient, "getElectionAudit").mockResolvedValue([]);
    vi.spyOn(apiClient, "getElectionMonitoring").mockResolvedValue({
      election_id: "elec-monitoring-1",
      status: "open",
      total_eligible: 120,
      ballots_cast: 45,
      turnout_percentage: 37.5,
      velocity: [
        { timestamp: "2026-11-06T09:00:00Z", ballots_count: 20, cumulative_ballots: 20 },
        { timestamp: "2026-11-06T10:00:00Z", ballots_count: 25, cumulative_ballots: 45 },
      ],
      departmental_turnout: [
        {
          department: "Engineering",
          eligible_count: 100,
          voted_count: 40,
          turnout_percentage: 40.0,
          is_suppressed: false,
        },
        {
          department: "Other / Small Groups (< 10 voters)",
          eligible_count: 20,
          voted_count: 5,
          turnout_percentage: 25.0,
          is_suppressed: true,
        },
      ],
      health: {
        ballot_box_status: "healthy",
        credential_service_status: "healthy",
        database_status: "healthy",
      },
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/elections/elec-monitoring-1"]}>
            <Routes>
              <Route path="/elections/:id" element={<ElectionDetailPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Campus Representative Election" })).toBeInTheDocument();
    });

    // Switch to participation / monitoring tab
    const monitoringTab = screen.getByRole("tab", { name: /Participation/i });
    fireEvent.click(monitoringTab);

    // Verify velocity chart is present
    expect(await screen.findByText("Turnout Velocity")).toBeInTheDocument();
    expect(screen.getByTestId("velocity-svg-chart")).toBeInTheDocument();

    // Verify infrastructure telemetry
    expect(screen.getByText("Ballot Ingestion Service")).toBeInTheDocument();
    expect(screen.getByText("Single-Use Credential Service")).toBeInTheDocument();
    expect(screen.getByText("Database Storage")).toBeInTheDocument();

    // Verify departmental breakdown and privacy threshold indicator
    expect(screen.getByText("Departmental Turnout Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("Other / Small Groups (< 10 voters)")).toBeInTheDocument();
    expect(screen.getByText(/Privacy Suppressed/i)).toBeInTheDocument();
  });
});

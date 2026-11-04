import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../features/auth/AuthContext";
import { ElectionsPage } from "../pages/ElectionsPage";
import { CreateElectionWizardPage } from "../pages/CreateElectionWizardPage";
import { AdminDashboardPage } from "../pages/AdminDashboardPage";
import { ElectionDetailPage } from "../pages/ElectionDetailPage";
import { apiClient } from "../lib/api-client";
import type { ElectionDetail } from "../types/election";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe("Election Pages & Lifecycle UI", () => {
  it("renders ElectionsPage with heading and filter tabs", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <ElectionsPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: /Institutional Elections/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /All Elections/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open \/ Active/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Scheduled/i })).toBeInTheDocument();
  });

  it("renders CreateElectionWizardPage at Step 1", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <CreateElectionWizardPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: /Create Institutional Election/i })).toBeInTheDocument();
    expect(screen.getByText(/Basic Information/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/2026 Student Union General Election/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next: Structure/i })).toBeInTheDocument();
  });

  it("renders AdminDashboardPage with metrics and create election link", () => {
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

    expect(screen.getByRole("heading", { name: /Institutional Admin Console/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Election/i })).toBeInTheDocument();
    expect(screen.getByText("Active Voting")).toBeInTheDocument();
    expect(screen.getByText(/Subsystem Isolation & DB Health/i)).toBeInTheDocument();
  });

  it("renders ElectionDetailPage with election information", async () => {
    const mockElection: ElectionDetail = {
      id: "elec-123",
      organization_id: "org-1",
      title: "Faculty Board Election 2026",
      description: "Annual representative board election",
      status: "draft",
      opens_at: "2026-11-01T09:00:00Z",
      closes_at: "2026-11-05T17:00:00Z",
      timezone: "UTC",
      voting_method: "plurality",
      configuration_version: 1,
      configuration_hash: null,
      created_by: "user-admin",
      created_at: "2026-10-25T10:00:00Z",
      updated_at: "2026-10-25T10:00:00Z",
      positions: [
        {
          id: "pos-1",
          election_id: "elec-123",
          title: "Dean of Faculty",
          description: "Senior faculty representative",
          min_selections: 1,
          max_selections: 1,
          display_order: 0,
          candidates: [
            {
              id: "cand-1",
              position_id: "pos-1",
              name: "Dr. Eleanor Vance",
              biography: "Professor of Informatics",
              photo_url: null,
              display_order: 0,
              status: "active",
              created_at: "2026-10-25T10:00:00Z",
            },
          ],
        },
      ],
    };

    vi.spyOn(apiClient, "getElection").mockResolvedValue(mockElection);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/elections/elec-123"]}>
            <Routes>
              <Route path="/elections/:id" element={<ElectionDetailPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(await screen.findByRole("heading", { name: "Faculty Board Election 2026" })).toBeInTheDocument();
    expect(screen.getByText("Dean of Faculty")).toBeInTheDocument();
    expect(screen.getByText("Dr. Eleanor Vance")).toBeInTheDocument();
    expect(screen.getByText("Editable Draft")).toBeInTheDocument();
  });

  it("renders candidate photo and shows photo upload in ElectionDetailPage candidates tab", async () => {
    const mockElectionWithPhoto: ElectionDetail = {
      id: "elec-456",
      organization_id: "org-1",
      title: "Student Union 2026",
      description: "Annual representative elections",
      status: "draft",
      opens_at: "2026-11-20T09:00:00Z",
      closes_at: "2026-11-25T17:00:00Z",
      timezone: "UTC",
      voting_method: "plurality",
      configuration_version: 1,
      created_by: "user-1",
      created_at: "2026-10-25T10:00:00Z",
      updated_at: "2026-10-25T10:00:00Z",
      positions: [
        {
          id: "pos-1",
          election_id: "elec-456",
          title: "President",
          description: "Executive",
          min_selections: 1,
          max_selections: 1,
          display_order: 0,
          candidates: [
            {
              id: "cand-1",
              position_id: "pos-1",
              name: "Morgan Bailey",
              biography: "Advocacy for all students",
              photo_url: "/static/uploads/candidates/morgan.jpg",
              display_order: 0,
              status: "active",
              created_at: "2026-10-25T10:00:00Z",
            },
          ],
        },
      ],
    };

    vi.spyOn(apiClient, "getElection").mockResolvedValue(mockElectionWithPhoto);
    vi.spyOn(apiClient, "getMe").mockResolvedValue({
      user: {
        id: "user-1",
        email: "admin@pollwise.edu",
        display_name: "Admin User",
        email_verified: true,
        account_status: "active",
        is_platform_admin: true,
        created_at: "2026-01-01T00:00:00Z",
      },
      memberships: [],
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/elections/elec-456"]}>
            <Routes>
              <Route path="/elections/:id" element={<ElectionDetailPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(await screen.findByRole("heading", { name: "Student Union 2026" })).toBeInTheDocument();

    // Switch to candidates tab
    const candidatesTab = screen.getByRole("tab", { name: /Candidates/i });
    fireEvent.click(candidatesTab);

    // Verify candidate photo image is rendered
    const candImg = await screen.findByRole("img", { name: "Morgan Bailey" });
    expect(candImg).toHaveAttribute("src", "http://localhost:8000/static/uploads/candidates/morgan.jpg");

    // Click "Add Candidate" button to open inline candidate form
    const addCandidateBtn = screen.getByRole("button", { name: /Add Candidate/i });
    fireEvent.click(addCandidateBtn);

    // Verify candidate profile picture upload component is present in form
    expect(screen.getByText("Candidate Profile Picture")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Upload Candidate Photo/i })).toBeInTheDocument();
  });

  it("renders tallied election with participation stats, prompts for approval, and calls apiClient.approveTally", async () => {
    const mockTalliedElection: ElectionDetail = {
      id: "elec-tallied-1",
      organization_id: "org-1",
      title: "SRC Presidential Election",
      description: "Student Representative Council",
      status: "tallied",
      opens_at: "2026-10-20T08:00:00Z",
      closes_at: "2026-10-22T18:00:00Z",
      timezone: "UTC",
      voting_method: "plurality",
      configuration_version: 1,
      configuration_hash: "hash123",
      created_by: "user-1",
      created_at: "2026-10-15T10:00:00Z",
      updated_at: "2026-10-23T10:00:00Z",
      positions: [
        {
          id: "pos-1",
          election_id: "elec-tallied-1",
          title: "President",
          min_selections: 1,
          max_selections: 1,
          display_order: 1,
          created_at: "2026-10-15T10:00:00Z",
          updated_at: "2026-10-15T10:00:00Z",
          candidates: [
            {
              id: "cand-1",
              position_id: "pos-1",
              name: "Winner Candidate",
              display_order: 1,
              status: "active",
              created_at: "2026-10-15T10:00:00Z",
            },
          ],
        },
      ],
    };

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
    vi.spyOn(apiClient, "getElection").mockResolvedValue(mockTalliedElection);
    vi.spyOn(apiClient, "getParticipationSummary").mockResolvedValue({
      election_id: "elec-tallied-1",
      total_eligible: 100,
      ballots_cast: 45,
      turnout_percentage: 45.0,
      access_codes_total: 100,
      access_codes_used: 45,
    });
    vi.spyOn(apiClient, "getResults").mockResolvedValue({
      id: "res-1",
      election_id: "elec-tallied-1",
      configuration_hash: "hash123",
      ballot_count: 45,
      approval_status: "pending",
      computed_at: "2026-10-23T10:00:00Z",
      positions: [
        {
          position_id: "pos-1",
          title: "President",
          total_votes: 45,
          abstain_count: 0,
          candidates: [{ candidate_id: "cand-1", name: "Winner Candidate", votes: 45, percentage: 100 }],
          winner_ids: ["cand-1"],
        },
      ],
    });

    const approveSpy = vi.spyOn(apiClient, "approveTally").mockResolvedValue({
      approval_id: "app-1",
      decision: "approved",
      status: "approved",
    });

    // Mock confirm dialog to return true
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/elections/elec-tallied-1"]}>
            <Routes>
              <Route path="/elections/:id" element={<ElectionDetailPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Verify title and status
    expect(await screen.findByRole("heading", { name: "SRC Presidential Election" })).toBeInTheDocument();
    expect(screen.getByText("Tallied")).toBeInTheDocument();

    // Verify voter turnout stats reflected (45 ballots cast, 100 eligible voters)
    expect((await screen.findAllByText("45")).length).toBeGreaterThan(0);
    expect(screen.getByText(/45 of 100 voters/i)).toBeInTheDocument();

    // Verify Approve Results button exists and clicking it prompts user and approves
    const approveBtn = screen.getByRole("button", { name: /Approve Results/i });
    expect(approveBtn).toBeInTheDocument();
    fireEvent.click(approveBtn);

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/Approve and certify these results/i));
    await waitFor(() => {
      expect(approveSpy).toHaveBeenCalledWith(
        "elec-tallied-1",
        "res-1",
        expect.objectContaining({ decision: "approved" })
      );
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthContext } from "../features/auth/authContextDef";
import { PersonalDashboardPage } from "../pages/PersonalDashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { AppShell } from "../layouts/AppShell";
import { apiClient } from "../lib/api-client";
import type { User, UserElectionSummary } from "../types/auth";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const mockPersonalUser: User = {
  id: "user-123",
  email: "sarah@example.com",
  display_name: "Sarah Johnson",
  first_name: "Sarah",
  last_name: "Johnson",
  phone_number: "+1 555-0199",
  country: "United States",
  email_verified: true,
  mfa_enabled: true,
  account_status: "active",
  is_platform_admin: false,
  created_at: "2026-10-01T10:00:00Z",
  account_type: "personal",
};

const renderDashboard = (
  userOverride?: Partial<User>,
  initialEntries = ["/dashboard"]
) => {
  const queryClient = createTestQueryClient();
  const user = { ...mockPersonalUser, ...userOverride };

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user,
          memberships: [],
          isAuthenticated: true,
          isLoading: false,
          login: vi.fn(),
          register: vi.fn(),
          logout: vi.fn(),
          refresh: vi.fn(),
        }}
      >
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/dashboard" element={<PersonalDashboardPage />} />
            <Route path="/elections/:id/vote" element={<div>Voting Booth Page</div>} />
            <Route path="/elections/:id/results" element={<div>Election Results Page</div>} />
            <Route path="/settings" element={<div>Settings Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
};

describe("PersonalDashboardPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders empty state when user has no elections", async () => {
    vi.spyOn(apiClient, "getMyElections").mockResolvedValue([]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("No elections available yet")).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        "You can join an institution using an invitation link or code. When you become eligible for an election, it will appear here."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter Invitation Code" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Learn How Pollwise Works" })).toBeInTheDocument();
  });

  it("renders Welcome Header with display name and profile completion badge", async () => {
    vi.spyOn(apiClient, "getMyElections").mockResolvedValue([]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Sarah Johnson/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
    expect(screen.getByText(/Profile Complete/i)).toBeInTheDocument();
  });

  it("renders Account Security card with Email verification, MFA status, and settings shortcut", async () => {
    vi.spyOn(apiClient, "getMyElections").mockResolvedValue([]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Account Security/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Email Verified/i)).toBeInTheDocument();
    expect(screen.getByText(/MFA Enabled/i)).toBeInTheDocument();
    const settingsLinks = screen.getAllByRole("link", { name: /Security Settings|Manage Security/i });
    expect(settingsLinks[0]).toHaveAttribute("href", "/settings");
  });

  it("renders election status cards for Voting Open, Vote Submitted, Results Published, and Closed", async () => {
    const mockElections: UserElectionSummary[] = [
      {
        id: "elec-1",
        title: "2026 Presidential General Election",
        status: "open",
        has_voted: false,
        institution_name: "Apex University",
        start_time: "2026-11-01T08:00:00Z",
        end_time: "2026-11-05T20:00:00Z",
      },
      {
        id: "elec-2",
        title: "Faculty Senate Representative",
        status: "open",
        has_voted: true,
        institution_name: "Apex University",
        start_time: "2026-11-01T08:00:00Z",
        end_time: "2026-11-05T20:00:00Z",
      },
      {
        id: "elec-3",
        title: "Student Council Bylaw Referendum",
        status: "published",
        has_voted: true,
        institution_name: "Apex University",
        start_time: "2026-10-10T08:00:00Z",
        end_time: "2026-10-15T20:00:00Z",
      },
      {
        id: "elec-4",
        title: "Alumni Board Trustee Election",
        status: "scheduled",
        has_voted: false,
        institution_name: "State College",
        start_time: "2026-12-01T08:00:00Z",
        end_time: "2026-12-10T20:00:00Z",
      },
      {
        id: "elec-5",
        title: "Department Chair Vote",
        status: "closed",
        has_voted: false,
        institution_name: "State College",
        start_time: "2026-10-01T08:00:00Z",
        end_time: "2026-10-05T20:00:00Z",
      },
    ];

    vi.spyOn(apiClient, "getMyElections").mockResolvedValue(mockElections);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("2026 Presidential General Election")).toBeInTheDocument();
    });

    // 1. Voting Open card with Cast Ballot linking to /elections/elec-1/vote
    expect(screen.getByText("Voting Open")).toBeInTheDocument();
    const castBallotLink = screen.getByRole("link", { name: /Cast Ballot/i });
    expect(castBallotLink).toHaveAttribute("href", "/elections/elec-1/vote");

    // 2. Vote Submitted card with checkmark / confirmation
    expect(screen.getByText("Vote Submitted")).toBeInTheDocument();
    expect(screen.getAllByText(/Receipt Confirmed|Ballot Cast/i).length).toBeGreaterThan(0);

    // 3. Results Published card with View Results linking to /elections/elec-3/results
    expect(screen.getByText("Results Published")).toBeInTheDocument();
    const viewResultsLink = screen.getByRole("link", { name: /View Results/i });
    expect(viewResultsLink).toHaveAttribute("href", "/elections/elec-3/results");

    // 4. Not Open Yet card
    expect(screen.getByText("Not Open Yet")).toBeInTheDocument();

    // 5. Election Closed card
    expect(screen.getByText("Election Closed")).toBeInTheDocument();
  });

  it("filters elections by category tabs (Requires Action, Active, Upcoming, Completed)", async () => {
    const mockElections: UserElectionSummary[] = [
      {
        id: "elec-1",
        title: "Requires Action Election",
        status: "open",
        has_voted: false,
        institution_name: "Apex University",
      },
      {
        id: "elec-2",
        title: "Already Voted Active Election",
        status: "open",
        has_voted: true,
        institution_name: "Apex University",
      },
      {
        id: "elec-3",
        title: "Future Election",
        status: "scheduled",
        has_voted: false,
        institution_name: "Apex University",
      },
      {
        id: "elec-4",
        title: "Concluded Election",
        status: "closed",
        has_voted: false,
        institution_name: "Apex University",
      },
    ];

    vi.spyOn(apiClient, "getMyElections").mockResolvedValue(mockElections);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Requires Action Election")).toBeInTheDocument();
    });

    // Switch to Requires Action filter
    const requiresActionTab = screen.getByRole("button", { name: /Requires Action/i });
    fireEvent.click(requiresActionTab);
    expect(screen.getByText("Requires Action Election")).toBeInTheDocument();
    expect(screen.queryByText("Already Voted Active Election")).not.toBeInTheDocument();

    // Switch to Upcoming filter
    const upcomingTab = screen.getByRole("button", { name: /Upcoming/i });
    fireEvent.click(upcomingTab);
    expect(screen.getByText("Future Election")).toBeInTheDocument();
    expect(screen.queryByText("Requires Action Election")).not.toBeInTheDocument();

    // Switch to Completed filter
    const completedTab = screen.getByRole("button", { name: /Completed/i });
    fireEvent.click(completedTab);
    expect(screen.getByText("Concluded Election")).toBeInTheDocument();
    expect(screen.queryByText("Future Election")).not.toBeInTheDocument();
  });

  it("interacts with Join Institution modal by validating and accepting invitation code", async () => {
    vi.spyOn(apiClient, "getMyElections").mockResolvedValue([]);
    vi.spyOn(apiClient, "validateInvitation").mockResolvedValue({
      invitation_code: "INV-9999",
      institution_id: "inst-456",
      institution_name: "Metropolitan University",
      invitation_type: "voter",
    });
    vi.spyOn(apiClient, "acceptInvitation").mockResolvedValue({
      message: "Invitation accepted",
      institution_name: "Metropolitan University",
      role: "voter",
      status: "active",
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("No elections available yet")).toBeInTheDocument();
    });

    // Click Enter Invitation Code
    const openModalBtn = screen.getByRole("button", { name: "Enter Invitation Code" });
    fireEvent.click(openModalBtn);

    // Modal opens with input
    const codeInput = screen.getByPlaceholderText(/e\.g\. INV- or code/i);
    fireEvent.change(codeInput, { target: { value: "INV-9999" } });

    // Click Validate
    const validateBtn = screen.getByRole("button", { name: /Validate|Check Code/i });
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(screen.getByText(/Metropolitan University/i)).toBeInTheDocument();
    });

    // Accept invitation
    const joinBtn = screen.getByRole("button", { name: /Join Institution|Accept Invitation/i });
    fireEvent.click(joinBtn);

    await waitFor(() => {
      expect(screen.getByText(/Successfully joined Metropolitan University/i)).toBeInTheDocument();
    });
  });

  it("renders Recent Activity timeline", async () => {
    const mockElections: UserElectionSummary[] = [
      {
        id: "elec-voted",
        title: "Annual Faculty Board",
        status: "open",
        has_voted: true,
        institution_name: "Apex University",
      },
    ];

    vi.spyOn(apiClient, "getMyElections").mockResolvedValue(mockElections);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Ballot cast for Annual Faculty Board/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Recent Activity/i)).toBeInTheDocument();
    expect(screen.getByText(/Account verification confirmed/i)).toBeInTheDocument();
  });
});

describe("Navigation & Session Integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("LoginPage redirects returning user with incomplete onboarding to /onboarding/personal", async () => {
    const queryClient = createTestQueryClient();
    const loginMock = vi.fn().mockResolvedValue({
      user: { ...mockPersonalUser, account_type: "personal" },
      memberships: [],
    });
    vi.spyOn(apiClient, "getPersonalOnboarding").mockResolvedValue({
      id: "onb-1",
      user_id: "user-123",
      onboarding_status: "in_progress",
      current_step: 3,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            user: null,
            memberships: [],
            isAuthenticated: false,
            isLoading: false,
            login: loginMock,
            register: vi.fn(),
            logout: vi.fn(),
            refresh: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={["/login"]}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/onboarding/personal" element={<div>Personal Onboarding Page</div>} />
              <Route path="/dashboard" element={<div>Dashboard Page</div>} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/Enter your email address/i), {
      target: { value: "sarah@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter your password/i), {
      target: { value: "ValidPassword123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText("Personal Onboarding Page")).toBeInTheDocument();
    });
  });

  it("LoginPage redirects returning personal user with completed onboarding to /dashboard", async () => {
    const queryClient = createTestQueryClient();
    const loginMock = vi.fn().mockResolvedValue({
      user: { ...mockPersonalUser, account_type: "personal" },
      memberships: [],
    });
    vi.spyOn(apiClient, "getPersonalOnboarding").mockResolvedValue({
      id: "onb-1",
      user_id: "user-123",
      onboarding_status: "completed",
      current_step: 5,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            user: null,
            memberships: [],
            isAuthenticated: false,
            isLoading: false,
            login: loginMock,
            register: vi.fn(),
            logout: vi.fn(),
            refresh: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={["/login"]}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/onboarding/personal" element={<div>Personal Onboarding Page</div>} />
              <Route path="/dashboard" element={<div>Dashboard Page</div>} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/Enter your email address/i), {
      target: { value: "sarah@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter your password/i), {
      target: { value: "ValidPassword123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText("Dashboard Page")).toBeInTheDocument();
    });
  });

  it("AppShell displays voter navigation links (Dashboard, Elections, Settings) for personal account and hides admin links", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            user: mockPersonalUser,
            memberships: [],
            isAuthenticated: true,
            isLoading: false,
            login: vi.fn(),
            register: vi.fn(),
            logout: vi.fn(),
            refresh: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={["/dashboard"]}>
            <AppShell />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    // Voter links exist
    expect(screen.getByRole("link", { name: /^Dashboard$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Elections$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Settings$/i })).toBeInTheDocument();

    // Admin links hidden
    expect(screen.queryByRole("link", { name: /Institutional Admin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Positions$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Candidates$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Voters & Eligibility/i })).not.toBeInTheDocument();
  });
});

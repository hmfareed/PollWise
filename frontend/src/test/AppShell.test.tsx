import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../features/auth/AuthContext";
import { AuthContext } from "../features/auth/authContextDef";
import { AppShell } from "../layouts/AppShell";
import { AuthSplitLayout } from "../layouts/AuthSplitLayout";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe("AppShell Component", () => {
  it("renders PollWise brand and landing navigation on root route", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/"]}>
            <AppShell />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText("PollWise")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(screen.getByText("For Institutions")).toBeInTheDocument();
    expect(screen.getByText("Get Started")).toBeInTheDocument();
  });

  it("renders institutional console sidebar on internal routes", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/admin"]}>
            <AppShell />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText("PollWise")).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Elections")).toBeInTheDocument();
    expect(screen.getByText("Organizations")).toBeInTheDocument();
    expect(screen.getByText("Institutional Admin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
  });

  it("displays the correct institution name in the sidebar for institution admin", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            user: {
              id: "u-1",
              email: "admin@hanara.edu",
              display_name: "Admin User",
              email_verified: true,
              account_status: "active",
              is_platform_admin: false,
              account_type: "institution",
              created_at: "2026-01-01T00:00:00Z",
            },
            memberships: [
              {
                id: "mem-1",
                organization_id: "org-1",
                organization_name: "Hanara International Academy",
                organization_slug: "hanara-academy",
                role: "organization_admin",
                status: "active",
              },
            ],
            isAuthenticated: true,
            isLoading: false,
            login: vi.fn(),
            register: vi.fn(),
            logout: vi.fn(),
            refresh: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={["/admin"]}>
            <AppShell />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    expect(screen.getByText("Hanara International Academy")).toBeInTheDocument();
    expect(screen.queryByText("University of Excellence")).not.toBeInTheDocument();
  });

  it("does not render sidebar or top navigation on auth routes (login, register)", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/login"]}>
            <Routes>
              <Route path="/" element={<AppShell />}>
                <Route
                  path="login"
                  element={<div data-testid="login-content">Full Page Login Screen</div>}
                />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByTestId("login-content")).toBeInTheDocument();
    expect(screen.queryByText("Institutional Admin")).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/Search elections, candidates, or users/i)
    ).not.toBeInTheDocument();
  });

  it("renders AuthSplitLayout with left showcase and nested content", () => {
    render(
      <MemoryRouter>
        <AuthSplitLayout>
          <div data-testid="auth-card-content">Sign In Card Form</div>
        </AuthSplitLayout>
      </MemoryRouter>
    );

    expect(screen.getByText(/Every Vote Matters/i)).toBeInTheDocument();
    expect(screen.getByText(/Counts\./i)).toBeInTheDocument();
    expect(screen.getByTestId("auth-card-content")).toBeInTheDocument();
  });

  it("renders footer on root landing page", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/"]}>
            <AppShell />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(
      screen.getByText(/PollWise — Institutional Voting Platform\./i)
    ).toBeInTheDocument();
    expect(screen.getByText("Security Protocol")).toBeInTheDocument();
  });

  it("does not render footer on onboarding routes", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/onboarding/personal"]}>
            <Routes>
              <Route path="/" element={<AppShell />}>
                <Route
                  path="onboarding/personal"
                  element={<div data-testid="onboarding-step">Welcome Step</div>}
                />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByTestId("onboarding-step")).toBeInTheDocument();
    expect(
      screen.queryByText(/PollWise — Institutional Voting Platform\./i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Security Protocol")).not.toBeInTheDocument();
  });
});

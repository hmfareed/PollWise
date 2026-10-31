import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../features/auth/AuthContext";
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
});

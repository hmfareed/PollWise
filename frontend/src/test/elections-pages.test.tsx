import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
    expect(screen.getByText("Step 1: General Election Information")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/2026 Student Union General Election/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next: Positions & Candidates/i })).toBeInTheDocument();
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
    expect(screen.getByText("Isolated Subsystems & Database Boundaries")).toBeInTheDocument();
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
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TerminalKioskPage } from "../pages/TerminalKioskPage";
import { SupervisorVotingCentresPage } from "../pages/SupervisorVotingCentresPage";
import { apiClient } from "../lib/api-client";
import type { VotingCentre, VotingTerminal } from "../types/voter-participation";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const mockCentre: VotingCentre = {
  id: "centre-1",
  institution_id: "inst-1",
  name: "Main Campus Library Voting Centre",
  location_description: "Building A, Room 102",
  status: "active",
  created_at: "2026-11-02T08:00:00Z",
};

const mockTerminals: VotingTerminal[] = [
  {
    id: "term-101",
    centre_id: "centre-1",
    terminal_name: "Kiosk Alpha (PC 01)",
    terminal_token: "term-token-secret-alpha",
    status: "idle",
    last_heartbeat_at: "2026-11-02T12:00:00Z",
    created_at: "2026-11-02T08:00:00Z",
  },
  {
    id: "term-102",
    centre_id: "centre-1",
    terminal_name: "Kiosk Beta (PC 02)",
    terminal_token: "term-token-secret-beta",
    status: "voting",
    last_heartbeat_at: "2026-11-02T12:00:05Z",
    created_at: "2026-11-02T08:00:00Z",
  },
];

describe("TerminalKioskPage Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends heartbeat on mount and handles supervisor reset command", async () => {
    const heartbeatSpy = vi.spyOn(apiClient, "terminalHeartbeat").mockResolvedValue({
      status: "idle",
      command: "reset",
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/terminals/term-101/booth?token=term-token-secret-alpha&election_id=elec-123"]}>
          <Routes>
            <Route path="/terminals/:terminalId/booth" element={<TerminalKioskPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Voting Centre Terminal Kiosk/i)).toBeInTheDocument();
    expect(screen.getByText(/Terminal: term-101/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(heartbeatSpy).toHaveBeenCalledWith("term-101", "term-token-secret-alpha", "idle");
    });

    // Reset banner or notification shown
    expect(await screen.findByText(/Terminal Reset by Supervisor/i)).toBeInTheDocument();
  });

  it("supports supervisor manual emergency reset button on terminal banner", async () => {
    vi.spyOn(apiClient, "terminalHeartbeat").mockResolvedValue({
      status: "idle",
      command: null,
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/terminals/term-101/booth?token=term-token-secret-alpha&election_id=elec-123"]}>
          <Routes>
            <Route path="/terminals/:terminalId/booth" element={<TerminalKioskPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Voting Centre Terminal Kiosk/i)).toBeInTheDocument();
    const emergencyResetBtn = screen.getByRole("button", { name: /reset terminal/i });
    fireEvent.click(emergencyResetBtn);

    expect(await screen.findByText(/Terminal cleared for next voter/i)).toBeInTheDocument();
  });
});

describe("SupervisorVotingCentresPage Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders voting centres, terminals grid, and executes supervisor terminal reset", async () => {
    vi.spyOn(apiClient, "getOrganizations").mockResolvedValue([
      { id: "inst-1", name: "University of Excellence", slug: "univ", status: "verified", created_at: "2026-01-01T00:00:00Z" },
    ]);
    vi.spyOn(apiClient, "listVotingCentres").mockResolvedValue([mockCentre]);
    vi.spyOn(apiClient, "listVotingTerminals").mockResolvedValue(mockTerminals);
    const resetSpy = vi.spyOn(apiClient, "supervisorResetTerminal").mockResolvedValue({
      reset_triggered: true,
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SupervisorVotingCentresPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // 1. Renders centre and terminals
    expect(await screen.findByText("Main Campus Library Voting Centre")).toBeInTheDocument();
    expect(await screen.findByText("Kiosk Alpha (PC 01)")).toBeInTheDocument();
    expect(screen.getByText("Kiosk Beta (PC 02)")).toBeInTheDocument();

    // 2. Click Reset on Terminal Beta
    const resetBtns = screen.getAllByRole("button", { name: /remote reset/i });
    fireEvent.click(resetBtns[1]);

    await waitFor(() => {
      expect(resetSpy).toHaveBeenCalledWith("term-102");
    });
  });

  it("creates a new voting centre and registers a new terminal", async () => {
    vi.spyOn(apiClient, "getOrganizations").mockResolvedValue([
      { id: "inst-1", name: "University of Excellence", slug: "univ", status: "verified", created_at: "2026-01-01T00:00:00Z" },
    ]);
    vi.spyOn(apiClient, "listVotingCentres").mockResolvedValue([mockCentre]);
    vi.spyOn(apiClient, "listVotingTerminals").mockResolvedValue(mockTerminals);

    const createCentreSpy = vi.spyOn(apiClient, "createVotingCentre").mockResolvedValue({
      id: "centre-2",
      institution_id: "inst-1",
      name: "Student Union Hall Voting Centre",
      location_description: "West Wing 2nd Floor",
      status: "active",
      created_at: "2026-11-02T12:00:00Z",
    });

    const registerTerminalSpy = vi.spyOn(apiClient, "registerVotingTerminal").mockResolvedValue({
      id: "term-103",
      centre_id: "centre-1",
      terminal_name: "Kiosk Gamma (PC 03)",
      terminal_token: "tok-103",
      status: "idle",
      created_at: "2026-11-02T12:00:00Z",
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SupervisorVotingCentresPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Create Centre modal
    expect(await screen.findByText("Main Campus Library Voting Centre")).toBeInTheDocument();
    const newCentreBtn = screen.getByRole("button", { name: /new voting centre/i });
    fireEvent.click(newCentreBtn);

    const nameInput = screen.getByPlaceholderText(/e.g. Student Union Hall/i);
    fireEvent.change(nameInput, { target: { value: "Student Union Hall Voting Centre" } });
    const submitCentreBtn = screen.getByRole("button", { name: /create centre/i });
    fireEvent.click(submitCentreBtn);

    await waitFor(() => {
      expect(createCentreSpy).toHaveBeenCalledWith(expect.objectContaining({
        name: "Student Union Hall Voting Centre",
      }));
    });

    // Register Terminal modal
    const addTerminalBtn = screen.getByRole("button", { name: /add terminal/i });
    fireEvent.click(addTerminalBtn);

    const termNameInput = screen.getByPlaceholderText(/e.g. PC 03 or Kiosk Gamma/i);
    fireEvent.change(termNameInput, { target: { value: "Kiosk Gamma (PC 03)" } });
    const submitTermBtn = screen.getByRole("button", { name: /register terminal/i });
    fireEvent.click(submitTermBtn);

    await waitFor(() => {
      expect(registerTerminalSpy).toHaveBeenCalledWith("centre-2", "Kiosk Gamma (PC 03)", undefined);
    });
  });
});

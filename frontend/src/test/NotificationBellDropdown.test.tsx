import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationBellDropdown } from "../components/notifications/NotificationBellDropdown";
import { apiClient } from "../lib/api-client";
import type { NotificationListResponse } from "../types/notification";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const mockNotifications: NotificationListResponse = {
  notifications: [
    {
      id: "notif-1",
      user_id: "user-1",
      title: "Election 'Student Union 2026' Live",
      message: "Voting has commenced. Cast your ballot before 5:00 PM.",
      notification_type: "election_status",
      action_url: "/elections/su-2026",
      is_read: false,
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
      id: "notif-2",
      user_id: "user-1",
      title: "Ballot Cast Confirmation",
      message: "Your ballot was accepted. Receipt: RC-9912.",
      notification_type: "voting",
      action_url: null,
      is_read: false,
      created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
    {
      id: "notif-3",
      user_id: "user-1",
      title: "Welcome to PollWise",
      message: "Your voter portal is setup.",
      notification_type: "system",
      action_url: "/dashboard",
      is_read: true,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  total_count: 3,
  unread_count: 2,
};

describe("NotificationBellDropdown Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
  });

  it("renders bell button and badge with unread count when unread_count > 0", async () => {
    vi.spyOn(apiClient, "fetchNotifications").mockResolvedValueOnce(mockNotifications);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NotificationBellDropdown />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const bellBtn = await screen.findByRole("button", { name: /notifications/i });
    expect(bellBtn).toBeInTheDocument();

    const badge = await screen.findByText("2");
    expect(badge).toBeInTheDocument();
  });

  it("hides badge when unread_count is 0", async () => {
    vi.spyOn(apiClient, "fetchNotifications").mockResolvedValueOnce({
      notifications: [],
      total_count: 0,
      unread_count: 0,
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NotificationBellDropdown />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await screen.findByRole("button", { name: /notifications/i });
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("toggles dropdown popover on click and shows notification items", async () => {
    vi.spyOn(apiClient, "fetchNotifications").mockResolvedValue(mockNotifications);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NotificationBellDropdown />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const bellBtn = await screen.findByRole("button", { name: /notifications/i });
    fireEvent.click(bellBtn);

    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Election 'Student Union 2026' Live")).toBeInTheDocument();
    expect(screen.getByText("Ballot Cast Confirmation")).toBeInTheDocument();
    expect(screen.getByText("Welcome to PollWise")).toBeInTheDocument();
  });

  it("switches to Unread tab and displays only unread items", async () => {
    vi.spyOn(apiClient, "fetchNotifications").mockResolvedValue(mockNotifications);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NotificationBellDropdown />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const bellBtn = await screen.findByRole("button", { name: /notifications/i });
    fireEvent.click(bellBtn);

    const unreadTab = screen.getByRole("tab", { name: /unread/i });
    fireEvent.click(unreadTab);

    expect(screen.getByText("Election 'Student Union 2026' Live")).toBeInTheDocument();
    expect(screen.getByText("Ballot Cast Confirmation")).toBeInTheDocument();
    expect(screen.queryByText("Welcome to PollWise")).not.toBeInTheDocument();
  });

  it("calls markAllNotificationsRead when 'Mark all as read' is clicked", async () => {
    vi.spyOn(apiClient, "fetchNotifications").mockResolvedValue(mockNotifications);
    const markAllSpy = vi.spyOn(apiClient, "markAllNotificationsRead").mockResolvedValueOnce({
      success: true,
      marked_count: 2,
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NotificationBellDropdown />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const bellBtn = await screen.findByRole("button", { name: /notifications/i });
    fireEvent.click(bellBtn);

    const markAllBtn = screen.getByRole("button", { name: /mark all as read/i });
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(markAllSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("navigates and marks item read when clicking an item with action_url", async () => {
    vi.spyOn(apiClient, "fetchNotifications").mockResolvedValue(mockNotifications);
    const markSpy = vi.spyOn(apiClient, "markNotificationRead").mockResolvedValueOnce({
      ...mockNotifications.notifications[0],
      is_read: true,
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NotificationBellDropdown />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const bellBtn = await screen.findByRole("button", { name: /notifications/i });
    fireEvent.click(bellBtn);

    const itemCard = screen.getByText("Election 'Student Union 2026' Live");
    fireEvent.click(itemCard);

    await waitFor(() => {
      expect(markSpy).toHaveBeenCalledWith("notif-1");
      expect(mockNavigate).toHaveBeenCalledWith("/elections/su-2026");
    });
  });

  it("closes popover when Escape key is pressed", async () => {
    vi.spyOn(apiClient, "fetchNotifications").mockResolvedValue(mockNotifications);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NotificationBellDropdown />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const bellBtn = await screen.findByRole("button", { name: /notifications/i });
    fireEvent.click(bellBtn);
    expect(screen.getByText("Notifications")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
  });
});

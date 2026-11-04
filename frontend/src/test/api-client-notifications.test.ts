import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient } from "../lib/api-client";

describe("apiClient Notifications Methods", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchNotifications calls GET /api/v1/notifications with query parameters", async () => {
    const mockResponse = {
      data: {
        notifications: [
          {
            id: "notif-1",
            user_id: "user-1",
            title: "Election Live",
            message: "Voting has started.",
            notification_type: "election_status",
            action_url: "/elections/elec-1",
            is_read: false,
            read_at: null,
            created_at: "2026-11-04T08:00:00Z",
          },
        ],
        total_count: 1,
        unread_count: 1,
      },
      error: null,
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const result = await apiClient.fetchNotifications({ unread_only: true, limit: 10 });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/notifications?unread_only=true&limit=10"),
      expect.objectContaining({
        credentials: "include",
      })
    );
    expect(result.notifications.length).toBe(1);
    expect(result.unread_count).toBe(1);
    expect(result.notifications[0].title).toBe("Election Live");
  });

  it("markNotificationRead calls PATCH /api/v1/notifications/:id/read", async () => {
    const mockResponse = {
      data: {
        id: "notif-1",
        user_id: "user-1",
        title: "Election Live",
        message: "Voting has started.",
        notification_type: "election_status",
        action_url: "/elections/elec-1",
        is_read: true,
        read_at: "2026-11-04T08:05:00Z",
        created_at: "2026-11-04T08:00:00Z",
      },
      error: null,
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const result = await apiClient.markNotificationRead("notif-1");

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/notifications/notif-1/read"),
      expect.objectContaining({
        method: "PATCH",
      })
    );
    expect(result.is_read).toBe(true);
  });

  it("markAllNotificationsRead calls POST /api/v1/notifications/mark-all-read", async () => {
    const mockResponse = {
      data: {
        success: true,
        marked_count: 3,
      },
      error: null,
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const result = await apiClient.markAllNotificationsRead();

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/notifications/mark-all-read"),
      expect.objectContaining({
        method: "POST",
      })
    );
    expect(result.success).toBe(true);
    expect(result.marked_count).toBe(3);
  });
});

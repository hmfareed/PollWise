import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Check,
  CheckCheck,
  Vote,
  CheckCircle2,
  FileText,
  Shield,
  Info,
  ExternalLink,
} from "lucide-react";
import { apiClient } from "../../lib/api-client";
import type {
  NotificationItem,
  NotificationListResponse,
  NotificationType,
} from "../../types/notification";

function formatRelativeTime(dateString: string): string {
  try {
    const now = Date.now();
    const past = new Date(dateString).getTime();
    const diffSec = Math.floor((now - past) / 1000);

    if (isNaN(diffSec) || diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "election_status":
      return <Vote className="h-4 w-4 text-blue-600" />;
    case "voting":
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case "report_certified":
      return <FileText className="h-4 w-4 text-purple-600" />;
    case "eligibility":
      return <Shield className="h-4 w-4 text-amber-600" />;
    case "system":
    default:
      return <Info className="h-4 w-4 text-slate-600" />;
  }
}

function getNotificationBg(type: NotificationType) {
  switch (type) {
    case "election_status":
      return "bg-blue-50 border-blue-100";
    case "voting":
      return "bg-emerald-50 border-emerald-100";
    case "report_certified":
      return "bg-purple-50 border-purple-100";
    case "eligibility":
      return "bg-amber-50 border-amber-100";
    case "system":
    default:
      return "bg-slate-100 border-slate-200";
  }
}

interface NotificationBellDropdownProps {
  className?: string;
}

export const NotificationBellDropdown: React.FC<NotificationBellDropdownProps> = ({
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<"all" | "unread">("all");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<NotificationListResponse>({
    queryKey: ["notifications"],
    queryFn: () => apiClient.fetchNotifications({ limit: 50 }),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const unreadCount = data?.unread_count ?? 0;
  const notifications = data?.notifications ?? [];
  const displayedNotifications =
    filterTab === "unread" ? notifications.filter((n) => !n.is_read) : notifications;

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard Escape listener
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Mutation: Mark single notification as read
  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.markNotificationRead(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData<NotificationListResponse>(["notifications"]);

      if (previous) {
        queryClient.setQueryData<NotificationListResponse>(["notifications"], {
          ...previous,
          unread_count: Math.max(0, previous.unread_count - 1),
          notifications: previous.notifications.map((n) =>
            n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Mutation: Mark all as read
  const markAllMutation = useMutation({
    mutationFn: () => apiClient.markAllNotificationsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData<NotificationListResponse>(["notifications"]);

      if (previous) {
        queryClient.setQueryData<NotificationListResponse>(["notifications"], {
          ...previous,
          unread_count: 0,
          notifications: previous.notifications.map((n) => ({
            ...n,
            is_read: true,
            read_at: new Date().toISOString(),
          })),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.is_read) {
      markReadMutation.mutate(item.id);
    }
    if (item.action_url) {
      setIsOpen(false);
      navigate(item.action_url);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-3.5 min-w-3.5 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
                className="text-[11px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div role="tablist" aria-label="Notification filters" className="flex border-b border-slate-100 px-4 gap-4 text-xs font-medium text-slate-500 bg-white">
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === "all"}
              onClick={() => setFilterTab("all")}
              className={`py-2 border-b-2 transition ${
                filterTab === "all"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent hover:text-slate-800"
              }`}
            >
              All {notifications.length > 0 ? `(${notifications.length})` : ""}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === "unread"}
              onClick={() => setFilterTab("unread")}
              className={`py-2 border-b-2 transition ${
                filterTab === "unread"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent hover:text-slate-800"
              }`}
            >
              Unread {unreadCount > 0 ? `(${unreadCount})` : ""}
            </button>
          </div>

          {/* Notification List Container */}
          <div className="max-h-84 overflow-y-auto divide-y divide-slate-100 overscroll-contain">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading alerts...</div>
            ) : displayedNotifications.length === 0 ? (
              <div className="py-10 px-4 text-center flex flex-col items-center justify-center">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                  <Bell className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700">
                  {filterTab === "unread" ? "All caught up!" : "No notifications yet"}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {filterTab === "unread"
                    ? "You don't have any unread notifications."
                    : "Important election updates and alerts will appear here."}
                </p>
              </div>
            ) : (
              displayedNotifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3.5 flex items-start gap-3 transition cursor-pointer text-left ${
                    !item.is_read
                      ? "bg-blue-50/40 hover:bg-blue-50/70"
                      : "bg-white hover:bg-slate-50"
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`h-8 w-8 rounded-xl border flex items-center justify-center flex-shrink-0 ${getNotificationBg(
                      item.notification_type
                    )}`}
                  >
                    {getNotificationIcon(item.notification_type)}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p
                        className={`text-xs leading-tight line-clamp-1 ${
                          !item.is_read
                            ? "font-bold text-slate-900"
                            : "font-medium text-slate-700"
                        }`}
                      >
                        {item.title}
                      </p>
                      {!item.is_read && (
                        <span className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {formatRelativeTime(item.created_at)}
                      </span>
                      {item.action_url && (
                        <span className="text-[10px] font-semibold text-blue-600 flex items-center gap-0.5 group-hover:underline">
                          View details <ExternalLink className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mark as read individual button */}
                  {!item.is_read && (
                    <button
                      type="button"
                      aria-label="Mark as read"
                      onClick={(e) => {
                        e.stopPropagation();
                        markReadMutation.mutate(item.id);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-100/60 transition flex-shrink-0"
                      title="Mark as read"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/60 text-center">
            <span className="text-[10px] text-slate-400">
              PollWise Alert Center · Secure Notifications
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

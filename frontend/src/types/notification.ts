export type NotificationType =
  | "election_status"
  | "voting"
  | "report_certified"
  | "eligibility"
  | "system";

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: NotificationType;
  action_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  meta_data?: string | null;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  total_count: number;
  unread_count: number;
}

export interface MarkAllReadResponse {
  success: boolean;
  marked_count: number;
}

export interface NotificationFilterParams {
  unread_only?: boolean;
  limit?: number;
  offset?: number;
}

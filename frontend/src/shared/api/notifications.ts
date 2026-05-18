import { api, type ApiResponse } from "../lib/apiClient";

export type NotificationItem = {
  id: number;
  notification_id: number;
  company_id?: number | null;
  type: string;
  category: string;
  severity: string;
  title: string;
  body?: string | null;
  entity_type?: string | null;
  entity_id?: number | null;
  action_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  is_archived?: boolean;
  archived_at?: string | null;
  created_at: string;
};

export type NotificationListResponse = {
  items: NotificationItem[];
  total: number;
};

export type NotificationPreferences = {
  realtime_toast_enabled: boolean;
  attendance_enabled: boolean;
  leave_enabled: boolean;
  schedule_enabled: boolean;
  settings_enabled: boolean;
  iam_enabled: boolean;
  system_enabled: boolean;
};

export type CompanyNotificationPolicies = {
  late_attendance_enabled: boolean;
  absent_attendance_enabled: boolean;
  new_leave_request_enabled: boolean;
  daily_report_enabled: boolean;
  overtime_request_enabled: boolean;
  attendance_policy_change_enabled: boolean;
  gps_policy_change_enabled: boolean;
};

export function emitNotificationsChanged() {
  window.dispatchEvent(new CustomEvent("fa:notifications-changed"));
}

export function emitNotificationPreferencesChanged() {
  window.dispatchEvent(new CustomEvent("fa:notification-preferences-changed"));
}

export function emitNotificationReceived(item: NotificationItem) {
  window.dispatchEvent(new CustomEvent("fa:notification-received", { detail: item }));
}

export async function listNotifications(params?: {
  status?: "all" | "unread" | "archived";
  category?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}) {
  const res = await api.get<ApiResponse<NotificationListResponse>>("/notifications", { params });
  return res.data.result ?? { items: [], total: 0 };
}

export async function getNotification(recipientId: number) {
  const res = await api.get<ApiResponse<NotificationItem>>(`/notifications/${recipientId}`);
  return res.data.result!;
}

export async function getUnreadNotificationCount() {
  const res = await api.get<ApiResponse<{ unread_count: number }>>("/notifications/unread-count");
  return Number(res.data.result?.unread_count ?? 0);
}

export async function markNotificationRead(recipientId: number) {
  await api.post(`/notifications/${recipientId}/read`);
  emitNotificationsChanged();
}

export async function markAllNotificationsRead() {
  await api.post("/notifications/read-all");
  emitNotificationsChanged();
}

export async function archiveNotification(recipientId: number) {
  await api.post(`/notifications/${recipientId}/archive`);
  emitNotificationsChanged();
}

export async function deleteNotification(recipientId: number) {
  await api.delete(`/notifications/${recipientId}`);
  emitNotificationsChanged();
}

export async function getMyNotificationPreferences() {
  const res = await api.get<ApiResponse<NotificationPreferences>>("/notifications/preferences/me");
  return res.data.result!;
}

export async function updateMyNotificationPreferences(payload: NotificationPreferences) {
  const res = await api.put<ApiResponse<NotificationPreferences>>("/notifications/preferences/me", payload);
  emitNotificationPreferencesChanged();
  return res.data.result!;
}

export async function getCompanyNotificationPolicies() {
  const res = await api.get<ApiResponse<CompanyNotificationPolicies>>("/notifications/company-policies");
  return res.data.result!;
}

export async function updateCompanyNotificationPolicies(payload: CompanyNotificationPolicies) {
  const res = await api.put<ApiResponse<CompanyNotificationPolicies>>("/notifications/company-policies", payload);
  emitNotificationsChanged();
  return res.data.result!;
}

export function buildNotificationsWsUrl(token: string, companyId?: number | null) {
  const base = import.meta.env.VITE_API_BASE_URL || "/api/v1";
  const url = new URL(base, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/notifications/ws`;
  url.searchParams.set("token", token);
  if (companyId) url.searchParams.set("company_id", String(companyId));
  return url.toString();
}

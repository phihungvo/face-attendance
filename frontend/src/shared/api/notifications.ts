import { notifApi } from "../lib/notifClient";

export type NotificationSeverity = "INFO" | "WARNING" | "CRITICAL";

export type NotificationItem = {
  id: string; // bigint serialized
  type: string;
  severity: NotificationSeverity;
  title: string;
  body?: string | null;
  data?: any;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
};

export async function listNotifications(token: string, params?: { limit?: number; cursor?: string | null; unread?: boolean; type?: string; severity?: NotificationSeverity }) {
  const res = await notifApi.get<{ items: NotificationItem[]; nextCursor: string | null }>("/notifications", {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
}

export async function getUnreadCount(token: string) {
  const res = await notifApi.get<{ unread: number }>("/notifications/unread", { headers: { Authorization: `Bearer ${token}` } });
  return res.data.unread ?? 0;
}

export async function markNotificationRead(token: string, id: string) {
  const res = await notifApi.patch<{ updated: boolean }>(`/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
  return !!res.data.updated;
}

export async function markAllRead(token: string) {
  const res = await notifApi.patch<{ updated: number }>("/notifications/read-all", {}, { headers: { Authorization: `Bearer ${token}` } });
  return res.data.updated ?? 0;
}


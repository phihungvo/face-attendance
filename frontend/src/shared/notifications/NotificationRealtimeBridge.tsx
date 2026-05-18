import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildNotificationsWsUrl, emitNotificationReceived, emitNotificationsChanged, getMyNotificationPreferences, type NotificationItem, type NotificationPreferences } from "../api/notifications";
import { getApiErrorMessage } from "../lib/apiClient";
import { useAuth } from "../auth/auth";
import styles from "./NotificationRealtimeBridge.module.scss";

type ToastItem = NotificationItem & { toastId: string };

const defaultPreferences: NotificationPreferences = {
  realtime_toast_enabled: true,
  attendance_enabled: true,
  leave_enabled: true,
  schedule_enabled: true,
  settings_enabled: true,
  iam_enabled: true,
  system_enabled: true
};

export default function NotificationRealtimeBridge() {
  const auth = useAuth();
  const nav = useNavigate();
  const [prefs, setPrefs] = useState<NotificationPreferences>(defaultPreferences);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);

  useEffect(() => {
    if (!auth.token || !auth.permissionKeys.includes("notifications.read")) return;
    let alive = true;
    getMyNotificationPreferences()
      .then((next) => {
        if (alive) setPrefs(next);
      })
      .catch((e) => console.warn("notification preferences load failed", getApiErrorMessage(e)));

    const onPrefsChanged = () => {
      getMyNotificationPreferences()
        .then((next) => {
          if (alive) setPrefs(next);
        })
        .catch((e) => console.warn("notification preferences reload failed", getApiErrorMessage(e)));
    };
    window.addEventListener("fa:notification-preferences-changed", onPrefsChanged);
    return () => {
      alive = false;
      window.removeEventListener("fa:notification-preferences-changed", onPrefsChanged);
    };
  }, [auth.token, auth.permissionKeys]);

  useEffect(() => {
    if (!auth.token || !auth.permissionKeys.includes("notifications.read")) return;
    let disposed = false;

    function clearReconnect() {
      if (reconnectRef.current != null) {
        window.clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    }

    function connect() {
      clearReconnect();
      const url = buildNotificationsWsUrl(auth.token!, auth.selectedCompanyId ?? auth.companyId ?? undefined);
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data ?? "{}"));
          if (payload?.type !== "notification.created" || !payload?.item) return;
          const item = payload.item as NotificationItem;
          emitNotificationReceived(item);
          emitNotificationsChanged();
          if (!prefs.realtime_toast_enabled) return;
          const toast: ToastItem = { ...item, toastId: `${item.id}-${Date.now()}` };
          setToasts((prev) => [toast, ...prev].slice(0, 4));
        } catch (e) {
          console.warn("notification realtime parse failed", e);
        }
      };

      socket.onclose = () => {
        if (disposed) return;
        reconnectRef.current = window.setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      disposed = true;
      clearReconnect();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [auth.companyId, auth.permissionKeys, auth.selectedCompanyId, auth.token, prefs.realtime_toast_enabled]);

  useEffect(() => {
    if (!toasts.length) return;
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.slice(0, -1));
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  if (!toasts.length) return null;

  return (
    <div className={styles.stack} aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.toastId}
          type="button"
          className={styles.toast}
          onClick={() => {
            setToasts((prev) => prev.filter((item) => item.toastId !== toast.toastId));
            if (toast.action_url) nav(toast.action_url);
          }}
        >
          <div className={styles.head}>
            <span className={styles.category}>{toast.category}</span>
            <span className={styles.close}>Đóng</span>
          </div>
          <div className={styles.title}>{toast.title}</div>
          <div className={styles.body}>{toast.body || "Có thông báo mới."}</div>
        </button>
      ))}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { notification } from "antd";
import {
  BellOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
  SafetyCertificateOutlined,
  SettingOutlined
} from "@ant-design/icons";
import {
  buildNotificationsWsUrl,
  emitNotificationReceived,
  emitNotificationsChanged,
  getMyNotificationPreferences,
  markNotificationRead,
  type NotificationItem,
  type NotificationPreferences
} from "../api/notifications";
import { getApiErrorMessage } from "../lib/apiClient";
import { useAuth } from "../auth/auth";
import styles from "./NotificationRealtimeBridge.module.scss";

const defaultPreferences: NotificationPreferences = {
  realtime_toast_enabled: true,
  attendance_enabled: true,
  leave_enabled: true,
  schedule_enabled: true,
  settings_enabled: true,
  iam_enabled: true,
  system_enabled: true
};

function getNotificationIcon(item: NotificationItem) {
  if (item.severity === "critical") return <ExclamationCircleOutlined style={{ color: "#dc2626" }} />;
  if (item.category === "leave") return <SafetyCertificateOutlined style={{ color: "#2563eb" }} />;
  if (item.category === "schedule") return <CalendarOutlined style={{ color: "#7c3aed" }} />;
  if (item.category === "attendance") return <FieldTimeOutlined style={{ color: "#0891b2" }} />;
  if (item.category === "settings") return <SettingOutlined style={{ color: "#d97706" }} />;
  if (item.category === "iam") return <SafetyCertificateOutlined style={{ color: "#4f46e5" }} />;
  if (item.severity === "warning") return <ClockCircleOutlined style={{ color: "#d97706" }} />;
  return <BellOutlined style={{ color: "#1677ff" }} />;
}

function categoryLabel(category: string) {
  if (category === "attendance") return "Chấm công";
  if (category === "leave") return "Nghỉ phép";
  if (category === "schedule") return "Lịch làm";
  if (category === "settings") return "Cài đặt";
  if (category === "iam") return "Tài khoản";
  if (category === "system") return "Hệ thống";
  return category;
}

function canShowCategory(category: string, prefs: NotificationPreferences) {
  if (category === "attendance") return prefs.attendance_enabled;
  if (category === "leave") return prefs.leave_enabled;
  if (category === "schedule") return prefs.schedule_enabled;
  if (category === "settings") return prefs.settings_enabled;
  if (category === "iam") return prefs.iam_enabled;
  if (category === "system") return prefs.system_enabled;
  return true;
}

export default function NotificationRealtimeBridge() {
  const auth = useAuth();
  const nav = useNavigate();
  const [api, contextHolder] = notification.useNotification();
  const [prefs, setPrefs] = useState<NotificationPreferences>(defaultPreferences);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const prefsRef = useRef<NotificationPreferences>(defaultPreferences);
  const openedRef = useRef<Set<string>>(new Set());
  const isEmployeeOnly =
    (auth.roleKeys.includes("employee") && !auth.roleKeys.includes("manager")) ||
    (auth.permissionKeys.includes("employee.portal") && !auth.permissionKeys.includes("dashboard.read"));

  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

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
  }, [auth.companyId, auth.permissionKeys, auth.selectedCompanyId, auth.token]);

  useEffect(() => {
    if (!auth.token || !auth.permissionKeys.includes("notifications.read")) return;

    const onNotificationReceived = (event: Event) => {
      const item = (event as CustomEvent<NotificationItem>).detail;
      if (!item) return;

      const currentPrefs = prefsRef.current;
      if (!currentPrefs.realtime_toast_enabled || !canShowCategory(item.category, currentPrefs)) return;

      const popupKey = `notification-${item.id}-${item.created_at}`;
      if (openedRef.current.has(popupKey)) return;
      openedRef.current.add(popupKey);

      window.setTimeout(() => {
        openedRef.current.delete(popupKey);
      }, 15_000);

      api.open({
        key: popupKey,
        duration: 6,
        placement: window.innerWidth <= 640 ? "top" : "topRight",
        icon: getNotificationIcon(item),
        message: item.title,
        className: styles.popup,
        description: (
          <div className={styles.content}>
            <div className={styles.metaRow}>
              <span className={styles.category}>{categoryLabel(item.category)}</span>
              <span className={styles.severity}>{item.severity}</span>
            </div>
            <div className={styles.body}>{item.body || "Có thông báo mới."}</div>
            <div className={styles.hint}>Nhấn để mở chi tiết</div>
          </div>
        ),
        onClick: () => {
          api.destroy(popupKey);
          if (!item.is_read) {
            void markNotificationRead(item.id).catch((e) => console.warn("notification realtime mark read failed", getApiErrorMessage(e)));
          }
          nav(item.action_url || (isEmployeeOnly ? "/employee/notifications" : "/notifications"));
        }
      });
    };

    window.addEventListener("fa:notification-received", onNotificationReceived as EventListener);
    return () => {
      window.removeEventListener("fa:notification-received", onNotificationReceived as EventListener);
    };
  }, [api, auth.permissionKeys, auth.token, isEmployeeOnly, nav]);

  return contextHolder;
}

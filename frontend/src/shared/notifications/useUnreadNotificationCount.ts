import { useEffect, useState } from "react";
import { getUnreadNotificationCount } from "../api/notifications";
import { getApiErrorMessage } from "../lib/apiClient";

export function useUnreadNotificationCount(deps: Array<string | number | null | undefined> = [], enabled = true) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setUnreadCount(0);
      return;
    }
    let alive = true;

    async function refreshUnread() {
      try {
        const count = await getUnreadNotificationCount();
        if (alive) setUnreadCount(count);
      } catch (e) {
        if (alive) {
          console.warn("notifications unread count failed", getApiErrorMessage(e));
          setUnreadCount(0);
        }
      }
    }

    void refreshUnread();
    const timer = window.setInterval(() => void refreshUnread(), 30_000);
    const onChanged = () => void refreshUnread();
    window.addEventListener("fa:notifications-changed", onChanged);

    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("fa:notifications-changed", onChanged);
    };
  }, [enabled, ...deps]);

  return unreadCount;
}

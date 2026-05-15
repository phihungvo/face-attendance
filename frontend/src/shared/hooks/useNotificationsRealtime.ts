import { useEffect, useMemo } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "../auth/auth";
import { useAppDispatch } from "../store/hooks";
import { fetchUnread, pushRealtime } from "../store/notificationsSlice";
import type { NotificationItem } from "../api/notifications";

export function useNotificationsRealtime() {
  const auth = useAuth();
  const dispatch = useAppDispatch();

  const base = (import.meta as any).env?.VITE_NOTIF_URL || "http://localhost:8010";
  const socketUrl = useMemo(() => base, [base]);

  useEffect(() => {
    if (!auth.token) return;
    const s: Socket = io(socketUrl, {
      path: "/ws",
      transports: ["websocket"],
      query: { token: auth.token }
    });

    s.on("connect", () => {
      dispatch(fetchUnread({ token: auth.token! }));
    });

    s.on("notification", (payload: { notification: NotificationItem; unread?: number | null }) => {
      if (!payload?.notification) return;
      dispatch(pushRealtime({ item: payload.notification, unread: payload.unread ?? null }));
    });

    return () => {
      s.disconnect();
    };
  }, [auth.token, dispatch, socketUrl]);
}


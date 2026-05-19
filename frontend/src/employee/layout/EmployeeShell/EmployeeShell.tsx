import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../../shared/theme/theme";
import { BellOutlined, CalendarOutlined, CameraOutlined, HomeOutlined, IdcardOutlined, ProfileOutlined, UserOutlined } from "@ant-design/icons";
import styles from "./EmployeeShell.module.scss";
import { useUnreadNotificationCount } from "../../../shared/notifications/useUnreadNotificationCount";
import { listNotifications, markAllNotificationsRead, markNotificationRead, type NotificationItem } from "../../../shared/api/notifications";
import { formatDateTimeVi } from "../../../shared/lib/date";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";

function getNotificationGlyph(item: NotificationItem) {
  if (item.category === "leave") return "📝";
  if (item.category === "schedule") return "📅";
  if (item.category === "attendance") return "📍";
  if (item.category === "settings") return "⚙️";
  if (item.category === "iam") return "🔐";
  return "🔔";
}

export default function EmployeeShell() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { setMode } = useTheme();
  const hideNav = pathname.startsWith("/employee/checkin");
  const unreadCount = useUnreadNotificationCount([pathname]);

  useEffect(() => {
    // Default employee UI to dark on first visit, without overriding an explicit user preference.
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("theme-mode") == null) setMode("dark");
  }, [setMode]);

  const activeKey: "home" | "history" | "leave" | "schedule" | "notifications" | "profile" | null = (() => {
    if (pathname.startsWith("/employee/profile")) return "profile";
    if (pathname.startsWith("/employee/notifications")) return "notifications";
    if (pathname.startsWith("/employee/schedules")) return "schedule";
    if (pathname.startsWith("/employee/timesheet")) return "history";
    if (pathname.startsWith("/employee/leave")) return "leave";
    if (pathname.startsWith("/employee")) return "home";
    return null;
  })();

  const NavLinks = ({ variant }: { variant: "bottom" | "side" }) => {
    const tabCls = (key: typeof activeKey) => (activeKey === key ? `${styles.navTab} ${styles.navTabActive}` : styles.navTab);
    const iconCls = variant === "side" ? `${styles.navTabIcon} ${styles.navTabIconSide}` : styles.navTabIcon;
    const labelCls = variant === "side" ? `${styles.navTabLabel} ${styles.navTabLabelSide}` : styles.navTabLabel;

    return (
      <>
        <Link to="/employee" className={tabCls("home")}>
          <div className={iconCls}>
            <HomeOutlined />
          </div>
          <div className={labelCls}>Trang chủ</div>
        </Link>

        <Link to="/employee/timesheet" className={tabCls("history")}>
          <div className={iconCls}>
            <ProfileOutlined />
          </div>
          <div className={labelCls}>Lịch sử</div>
        </Link>

        {variant === "side" ? (
          <Link to="/employee/checkin" className={tabCls(null)} aria-label="Chấm công">
            <div className={iconCls}>
              <CameraOutlined />
            </div>
            <div className={labelCls}>Chấm công</div>
          </Link>
        ) : null}

        <Link to="/employee/leave" className={tabCls("leave")}>
          <div className={iconCls}>
            <IdcardOutlined />
          </div>
          <div className={labelCls}>Nghỉ phép</div>
        </Link>

        <Link to="/employee/schedules" className={tabCls("schedule")}>
          <div className={iconCls}>
            <CalendarOutlined />
          </div>
          <div className={labelCls}>Lịch làm</div>
        </Link>

        <Link to="/employee/notifications" className={tabCls("notifications")}>
          <div className={`${iconCls} ${styles.navBellWrap}`}>
            <BellOutlined />
            {unreadCount > 0 ? <span className={styles.navBellBadge}>{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
          </div>
          <div className={labelCls}>Thông báo</div>
        </Link>

        <Link to="/employee/profile" className={tabCls("profile")}>
          <div className={iconCls}>
            <UserOutlined />
          </div>
          <div className={labelCls}>Hồ sơ</div>
        </Link>
      </>
    );
  };

  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 899px)").matches;
  }, []);

  const fabKey = "employee-checkin-fab-pos-v1";
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<{ active: boolean; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [latestItems, setLatestItems] = useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);

  useEffect(() => {
    if (!isMobile) return;
    if (typeof window === "undefined") return;
    const read = () => {
      try {
        const raw = window.localStorage.getItem(fabKey);
        if (!raw) return null;
        const p = JSON.parse(raw);
        if (!p || typeof p.x !== "number" || typeof p.y !== "number") return null;
        return { x: p.x, y: p.y };
      } catch {
        return null;
      }
    };
    const saved = read();
    if (saved) {
      setFabPos(saved);
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Default like a typical "scroll-to-top" button (bottom-right, above bottom nav).
    setFabPos({ x: Math.max(12, vw - 72), y: Math.max(12, vh - 170) });
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    if (!fabPos) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(fabKey, JSON.stringify(fabPos));
    } catch {
      // ignore
    }
  }, [isMobile, fabPos]);

  const clampFab = (x: number, y: number) => {
    if (typeof window === "undefined") return { x, y };
    const size = 56;
    const pad = 10;
    const maxX = Math.max(pad, window.innerWidth - size - pad);
    const maxY = Math.max(pad, window.innerHeight - size - pad);
    return { x: Math.min(Math.max(pad, x), maxX), y: Math.min(Math.max(pad, y), maxY) };
  };

  const onFabPointerDown = (e: React.PointerEvent) => {
    if (!fabRef.current) return;
    // Only primary pointer.
    if (e.button !== 0) return;
    const rect = fabRef.current.getBoundingClientRect();
    fabRef.current.setPointerCapture(e.pointerId);
    draggingRef.current = { active: true, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, moved: false };
    e.preventDefault();
  };

  const onFabPointerMove = (e: React.PointerEvent) => {
    const d = draggingRef.current;
    if (!d?.active) return;
    const next = clampFab(e.clientX - d.offsetX, e.clientY - d.offsetY);
    if (!d.moved) {
      const dx = Math.abs((fabPos?.x ?? next.x) - next.x);
      const dy = Math.abs((fabPos?.y ?? next.y) - next.y);
      if (dx + dy > 4) d.moved = true;
    }
    setFabPos(next);
  };

  const onFabPointerUp = (e: React.PointerEvent) => {
    const d = draggingRef.current;
    if (!d?.active) return;
    draggingRef.current = null;
    try {
      fabRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    // Treat as click if it wasn't dragged.
    if (!d.moved) nav("/employee/checkin");
  };

  async function reloadLatest() {
    try {
      setNotifLoading(true);
      setNotifError(null);
      const data = await listNotifications({ status: "all", limit: 6, offset: 0 });
      setLatestItems(data.items);
    } catch (e) {
      setNotifError(getApiErrorMessage(e));
    } finally {
      setNotifLoading(false);
    }
  }

  useEffect(() => {
    if (!notifOpen) return;
    void reloadLatest();
  }, [notifOpen]);

  useEffect(() => {
    if (!notifOpen) return;
    const timer = window.setInterval(() => void reloadLatest(), 15_000);
    return () => window.clearInterval(timer);
  }, [notifOpen]);

  useEffect(() => {
    const onChanged = () => {
      if (notifOpen) void reloadLatest();
    };
    const onDocClick = (event: MouseEvent) => {
      if (!notifRef.current?.contains(event.target as Node)) setNotifOpen(false);
    };
    window.addEventListener("fa:notifications-changed", onChanged);
    document.addEventListener("mousedown", onDocClick);
    return () => {
      window.removeEventListener("fa:notifications-changed", onChanged);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [notifOpen]);

  async function handleRead(item: NotificationItem) {
    try {
      if (!item.is_read) {
        await markNotificationRead(item.id);
        setLatestItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, is_read: true, read_at: new Date().toISOString() } : row)));
      }
      nav(item.action_url || "/employee/notifications");
      setNotifOpen(false);
    } catch (e) {
      setNotifError(getApiErrorMessage(e));
    }
  }

  async function handleReadAll() {
    try {
      await markAllNotificationsRead();
      setLatestItems((prev) => prev.map((row) => ({ ...row, is_read: true, read_at: row.read_at ?? new Date().toISOString() })));
    } catch (e) {
      setNotifError(getApiErrorMessage(e));
    }
  }

  return (
    <div className={styles.appShell}>
      <div className={styles.shellInner}>
        <aside className={hideNav ? styles.hideNav : styles.sideNav} aria-label="Điều hướng nhân viên (desktop)">
          <div className={styles.sideBrand}>
            <div className={styles.sideBrandIcon}>FT</div>
            <div>
              <div className={styles.sideBrandTitle}>FaceTime HR</div>
              <div className={styles.sideBrandSub}>Cổng nhân viên</div>
            </div>
          </div>
          <div className={styles.sideNavLinks}>
            <NavLinks variant="side" />
          </div>
        </aside>

        <div className={styles.content}>
          <div className={styles.outletFrame}>
            <Outlet />
          </div>
          {!hideNav ? (
            <div className={styles.desktopToolBar} aria-label="Thanh công cụ (desktop)">
              <div className={styles.desktopNotifWrap} ref={notifRef}>
                <button className={styles.desktopToolBtn} type="button" aria-label="Thông báo" onClick={() => setNotifOpen((prev) => !prev)}>
                  <span className={styles.desktopNotifIcon}>
                    <BellOutlined />
                    {unreadCount > 0 ? <span className={styles.desktopNotifBadge}>{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
                  </span>
                  Thông báo
                </button>
                {notifOpen ? (
                  <div className={styles.desktopNotifDropdown}>
                    <div className={styles.desktopNotifHead}>
                      <div>
                        <div className={styles.desktopNotifTitle}>Thông báo mới</div>
                        <div className={styles.desktopNotifSub}>{unreadCount > 0 ? `${unreadCount} chưa đọc` : "Đã cập nhật"}</div>
                      </div>
                      <button className={styles.desktopNotifGhost} type="button" onClick={() => void handleReadAll()} disabled={!latestItems.some((item) => !item.is_read)}>
                        Đọc hết
                      </button>
                    </div>

                    {notifError ? <div className={styles.desktopNotifStateError}>{notifError}</div> : null}
                    {notifLoading ? <div className={styles.desktopNotifState}>Đang tải thông báo...</div> : null}
                    {!notifLoading && !latestItems.length ? <div className={styles.desktopNotifState}>Chưa có thông báo nào.</div> : null}

                    {!notifLoading && latestItems.length ? (
                      <div className={styles.desktopNotifList}>
                        {latestItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={item.is_read ? styles.desktopNotifItem : `${styles.desktopNotifItem} ${styles.desktopNotifItemUnread}`}
                            onClick={() => void handleRead(item)}
                          >
                            <div className={styles.desktopNotifGlyph}>{getNotificationGlyph(item)}</div>
                            <div className={styles.desktopNotifMain}>
                              <div className={styles.desktopNotifItemTitle}>{item.title}</div>
                              <div className={styles.desktopNotifItemBody}>{item.body || "Thông báo hệ thống"}</div>
                              <div className={styles.desktopNotifItemTime}>{formatDateTimeVi(new Date(item.created_at))}</div>
                            </div>
                            {!item.is_read ? <span className={styles.desktopNotifDot} /> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <button
                      className={styles.desktopNotifFooter}
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        nav("/employee/notifications");
                      }}
                    >
                      Xem tất cả thông báo
                    </button>
                  </div>
                ) : null}
              </div>
              <Link to="/employee/checkin" className={`${styles.desktopToolBtn} ${styles.desktopToolBtnPrimary}`} aria-label="Chấm công">
                <CameraOutlined /> Chấm công
              </Link>
            </div>
          ) : null}
        </div>

        <nav className={hideNav ? styles.hideNav : styles.bottomNav} aria-label="Điều hướng nhân viên">
          <NavLinks variant="bottom" />
        </nav>

        {!hideNav && isMobile && fabPos ? (
          <div className={styles.fabCheckin} aria-hidden="true">
            <button
              ref={fabRef}
              type="button"
              className={styles.fabBtn}
              style={{ left: fabPos.x, top: fabPos.y }}
              aria-label="Chấm công"
              onPointerDown={onFabPointerDown}
              onPointerMove={onFabPointerMove}
              onPointerUp={onFabPointerUp}
              onPointerCancel={onFabPointerUp}
            >
              <CameraOutlined />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

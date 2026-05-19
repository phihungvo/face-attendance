import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../../shared/theme/theme";
import { BellOutlined, CalendarOutlined, CameraOutlined, HomeOutlined, IdcardOutlined, ProfileOutlined, UserOutlined } from "@ant-design/icons";
import styles from "./EmployeeShell.module.scss";
import { useUnreadNotificationCount } from "../../../shared/notifications/useUnreadNotificationCount";

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
  const draggingRef = useRef<{ active: boolean; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null);

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

import { NavLink } from "react-router-dom";
import type { CSSProperties } from "react";
import { AppstoreOutlined, CloseOutlined, LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import styles from "./Sidebar.module.scss";
import { getNavSections } from "./navConfig";
import { useAuth } from "../../../shared/auth/auth";

export default function Sidebar({
  variant = "static",
  open = false,
  collapsed = false,
  onClose,
  onToggleCollapse
}: {
  variant?: "static" | "drawer";
  open?: boolean;
  collapsed?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
}) {
  const auth = useAuth();
  const can = (p: string) => auth.permissionKeys.includes(p as any);
  const navSections = getNavSections(auth.roleKeys);
  const roleLabel = auth.roleKeys.includes("admin") ? "Admin" : auth.roleKeys.includes("manager") ? "Quản lý" : "Nhân viên";

  const itemAllowed = (to: string) => {
    const map: Record<string, string> = {
      "/": "dashboard.read",
      "/checkin": "attendance.read",
      "/timelog": "timesheet.read",
      "/employees": "employees.read",
      "/departments": "departments.read",
      "/leave": "leave.read",
      "/schedules": "schedules.read",
      "/reports": "reports.read",
      "/overtime": "overtime.read",
      "/payroll": "payroll.read",
      "/notifications": "notifications.read",
      "/settings": "settings.read",
      "/companies": "companies.read",
      "/iam/users": "iam.manage",
      "/iam/roles": "iam.manage",
      "/iam/permissions": "iam.manage"
    };
    const needed = map[to];
    if (!needed) return true;
    return can(needed);
  };

  const cls = [
    styles.sidebar,
    variant === "drawer" ? styles.drawer : "",
    open ? styles.drawerOpen : "",
    collapsed ? styles.collapsed : ""
  ]
    .filter(Boolean)
    .join(" ");

  const closeIfDrawer = () => {
    if (variant === "drawer") onClose?.();
  };

  return (
    <nav className={cls} aria-label="Điều hướng quản lý">
      <div className={styles.sidebarInner}>
        <div className={styles.brandCard}>
          <div className={styles.brandTop}>
            <div className={styles.logo}>
              <div className={styles.logoIcon}>
                <AppstoreOutlined />
              </div>
              <div className={styles.logoText}>
                <h2>FaceTime HR</h2>
                <p>{auth.companyName || "Workforce management"}</p>
              </div>
            </div>

            <div className={styles.brandActions}>
              {variant === "drawer" ? (
                <button className={`${styles.sidebarToggle} ${styles.mobileToggle}`} type="button" onClick={onClose} aria-label="Đóng menu">
                  <CloseOutlined />
                </button>
              ) : null}
            </div>
          </div>
          {/*<div className={styles.brandMeta}>*/}
          {/*  <span className={styles.rolePill}>{roleLabel}</span>*/}
          {/*  <span className={styles.statusPill}>Online</span>*/}
          {/*</div>*/}
        </div>

        <div className={styles.navScroll}>
          {navSections
            .map((sec) => ({ ...sec, items: sec.items.filter((it) => itemAllowed(it.to)) }))
            .filter((sec) => sec.items.length > 0)
            .map((sec) => (
              <div className={styles.navSection} key={sec.label}>
                <div className={styles.navSectionLabel}>{sec.label}</div>
                <div className={styles.navList}>
                  {sec.items.map((item) => (
                    <NavLink
                      key={item.key}
                      to={item.to}
                      end={item.to === "/"}
                      onClick={closeIfDrawer}
                      title={collapsed ? item.label : undefined}
                      aria-label={item.label}
                      className={({ isActive }) => (isActive ? `${styles.navItem} ${styles.active}` : styles.navItem)}
                    >
                      <span className={styles.navIcon} style={{ "--nav-icon-color": item.iconColor } as CSSProperties}>
                        {item.icon}
                      </span>
                      <span className={styles.navLabel}>{item.label}</span>
                      {item.badge ? (
                        <span className={item.badge.tone === "green" ? `${styles.navBadge} ${styles.green}` : styles.navBadge}>{item.badge.text}</span>
                      ) : null}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
        </div>

        <div className={styles.sidebarFooter}>
          <button className={styles.logoutButton} type="button" onClick={() => auth.logout()} title={collapsed ? "Đăng xuất" : undefined}>
            <span className={styles.logoutIcon}>
              <LogoutOutlined />
            </span>
            <span className={styles.logoutLabel}>Đăng xuất</span>
          </button>
        </div>

        <button
          className={`${styles.edgeToggle} ${styles.desktopToggle}`}
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </button>
      </div>
    </nav>
  );
}

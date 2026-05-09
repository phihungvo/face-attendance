import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.scss";
import { getNavSections } from "./navConfig";
import { useAuth } from "../../../shared/auth/auth";

export default function Sidebar({
  variant = "static",
  open = false,
  onClose
}: {
  variant?: "static" | "drawer";
  open?: boolean;
  onClose?: () => void;
}) {
  const auth = useAuth();
  const can = (p: string) => auth.permissionKeys.includes(p as any);
  const navSections = getNavSections(auth.roleKeys);

  const itemAllowed = (to: string) => {
    const map: Record<string, string> = {
      "/": "dashboard.read",
      "/checkin": "attendance.read",
      "/timelog": "timesheet.read",
      "/employees": "employees.read",
      "/departments": "departments.read",
      "/leave": "leave.read",
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

  const cls =
    variant === "drawer"
      ? open
        ? `${styles.sidebar} ${styles.drawer} ${styles.drawerOpen}`
        : `${styles.sidebar} ${styles.drawer}`
      : styles.sidebar;

  const closeIfDrawer = () => {
    if (variant === "drawer") onClose?.();
  };

  return (
    <nav className={cls} aria-label="Điều hướng quản lý">
      {variant === "drawer" ? (
        <div className={styles.drawerTop}>
          <div className={styles.drawerTitle}>Menu</div>
          <button className={styles.drawerClose} type="button" onClick={onClose} aria-label="Đóng menu">
            ✕
          </button>
        </div>
      ) : null}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>🎯</div>
        <div className={styles.logoText}>
          <h2>FaceTime HR</h2>
          <p>Chấm công thông minh</p>
        </div>
      </div>

      {navSections
        .map((sec) => ({ ...sec, items: sec.items.filter((it) => itemAllowed(it.to)) }))
        .filter((sec) => sec.items.length > 0)
        .map((sec) => (
        <div className={styles.navSection} key={sec.label}>
          <div className={styles.navSectionLabel}>{sec.label}</div>
          {sec.items.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.to === "/"}
              onClick={closeIfDrawer}
              className={({ isActive }) => (isActive ? `${styles.navItem} ${styles.active}` : styles.navItem)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
              {item.badge ? (
                <span className={item.badge.tone === "green" ? `${styles.navBadge} ${styles.green}` : styles.navBadge}>
                  {item.badge.text}
                </span>
              ) : null}
            </NavLink>
          ))}
        </div>
      ))}

      <div className={styles.sidebarFooter}>
        <button
          className={styles.userCard}
          type="button"
          onClick={() => {
            auth.logout();
            closeIfDrawer();
          }}
          title="Đăng xuất"
        >
          <div className={styles.avatar}>{(auth.username || "U").slice(0, 2).toUpperCase()}</div>
          <div className={styles.userInfo}>
            <p>{auth.username || "User"}</p>
            <span>{auth.roleKeys.includes("admin") ? "Admin" : auth.roleKeys.includes("manager") ? "Quản lý" : "Nhân viên"}</span>
          </div>
          <span className={styles.userChevron}>›</span>
        </button>
      </div>
    </nav>
  );
}

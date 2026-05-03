import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.scss";
import { navSections } from "./navConfig";
import { useAuth } from "../../../shared/auth/auth";

export default function Sidebar() {
  const auth = useAuth();
  const can = (p: string) => auth.permissionKeys.includes(p as any);

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
      "/iam/users": "iam.manage",
      "/iam/roles": "iam.manage",
      "/iam/permissions": "iam.manage"
    };
    const needed = map[to];
    if (!needed) return true;
    return can(needed);
  };

  return (
    <nav className={styles.sidebar}>
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
        <button className={styles.userCard} type="button" onClick={auth.logout} title="Đăng xuất">
          <div className={styles.avatar}>AT</div>
          <div className={styles.userInfo}>
            <p>Admin Trưởng</p>
            <span>Quản trị viên</span>
          </div>
          <span className={styles.userChevron}>›</span>
        </button>
      </div>
    </nav>
  );
}

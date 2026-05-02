import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.scss";
import { navSections } from "./navConfig";
import { useAuth } from "../../../shared/auth/auth";

export default function Sidebar() {
  const auth = useAuth();

  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>🎯</div>
        <div className={styles.logoText}>
          <h2>FaceTime HR</h2>
          <p>Chấm công thông minh</p>
        </div>
      </div>

      {navSections.map((sec) => (
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


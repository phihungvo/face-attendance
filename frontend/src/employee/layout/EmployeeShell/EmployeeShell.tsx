import { Link, Outlet, useLocation } from "react-router-dom";
import styles from "./EmployeeShell.module.scss";

export default function EmployeeShell() {
  const { pathname } = useLocation();
  const hideNav = pathname.startsWith("/employee/leave") || pathname.startsWith("/employee/checkin");

  const activeKey: "home" | "history" | "leave" | "profile" | null = (() => {
    if (pathname.startsWith("/employee/profile")) return "profile";
    if (pathname.startsWith("/employee/timesheet")) return "history";
    if (pathname.startsWith("/employee/leave")) return "leave";
    if (pathname.startsWith("/employee")) return "home";
    return null;
  })();

  return (
    <div className={styles.page}>
      <div className={styles.appShell}>
        <div className={styles.content}>
          <Outlet />
        </div>

        <nav className={hideNav ? styles.hideNav : styles.bottomNav} aria-label="Điều hướng nhân viên">
          <Link to="/employee" className={activeKey === "home" ? `${styles.navTab} ${styles.navTabActive}` : styles.navTab}>
            <div className={styles.navTabIcon}>🏠</div>
            <div className={styles.navTabLabel}>Trang chủ</div>
          </Link>

          <Link to="/employee/timesheet" className={activeKey === "history" ? `${styles.navTab} ${styles.navTabActive}` : styles.navTab}>
            <div className={styles.navTabIcon}>📋</div>
            <div className={styles.navTabLabel}>Lịch sử</div>
          </Link>

          <div className={styles.navCenterBtnWrap} aria-hidden="true">
            <Link to="/employee/checkin" className={styles.navCenterBtn} aria-label="Chấm công">
              📷
            </Link>
          </div>

          <Link to="/employee/leave" className={activeKey === "leave" ? `${styles.navTab} ${styles.navTabActive}` : styles.navTab}>
            <div className={styles.navTabIcon}>🌴</div>
            <div className={styles.navTabLabel}>Nghỉ phép</div>
          </Link>

          <Link to="/employee/profile" className={activeKey === "profile" ? `${styles.navTab} ${styles.navTabActive}` : styles.navTab}>
            <div className={styles.navTabIcon}>👤</div>
            <div className={styles.navTabLabel}>Hồ sơ</div>
          </Link>
        </nav>
      </div>
    </div>
  );
}

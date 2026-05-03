import { Link, Outlet, useLocation } from "react-router-dom";
import styles from "./EmployeeShell.module.scss";

export default function EmployeeShell() {
  const { pathname } = useLocation();
  const hideNav = pathname.startsWith("/employee/checkin");

  const activeKey: "home" | "history" | "leave" | "profile" | null = (() => {
    if (pathname.startsWith("/employee/profile")) return "profile";
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
          <div className={iconCls}>🏠</div>
          <div className={labelCls}>Trang chủ</div>
        </Link>

        <Link to="/employee/timesheet" className={tabCls("history")}>
          <div className={iconCls}>📋</div>
          <div className={labelCls}>Lịch sử</div>
        </Link>

        {variant === "side" ? (
          <Link to="/employee/checkin" className={tabCls(null)} aria-label="Chấm công">
            <div className={iconCls}>📷</div>
            <div className={labelCls}>Chấm công</div>
          </Link>
        ) : null}

        <Link to="/employee/leave" className={tabCls("leave")}>
          <div className={iconCls}>🌴</div>
          <div className={labelCls}>Nghỉ phép</div>
        </Link>

        <Link to="/employee/profile" className={tabCls("profile")}>
          <div className={iconCls}>👤</div>
          <div className={labelCls}>Hồ sơ</div>
        </Link>
      </>
    );
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
        </div>

        <nav className={hideNav ? styles.hideNav : styles.bottomNav} aria-label="Điều hướng nhân viên">
          <NavLinks variant="bottom" />

          <div className={styles.navCenterBtnWrap} aria-hidden="true">
            <Link to="/employee/checkin" className={styles.navCenterBtn} aria-label="Chấm công">
              📷
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}

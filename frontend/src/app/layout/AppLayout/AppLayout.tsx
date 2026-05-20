import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "../Sidebar/Sidebar";
import Topbar from "../Topbar/Topbar";
import styles from "./AppLayout.module.scss";
import { useAuth } from "../../../shared/auth/auth";

export default function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("app-sidebar-collapsed") === "1";
  });
  const [isMobile, setIsMobile] = useState(false);
  const { pathname } = useLocation();
  const auth = useAuth();
  const companyScopeKey = String(auth.selectedCompanyId ?? auth.companyId ?? "none");

  useEffect(() => {
    // Close drawer after navigation on small screens.
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 899px)");

    const sync = () => {
      const mobile = media.matches;
      setIsMobile(mobile);
      if (!mobile) setNavOpen(false);
    };

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("app-sidebar-collapsed", navCollapsed ? "1" : "0");
  }, [navCollapsed]);

  return (
    <div className={styles.shell}>
      {navOpen && isMobile ? <button className={styles.backdrop} type="button" aria-label="Đóng menu" onClick={() => setNavOpen(false)} /> : null}
      <Sidebar
        variant="drawer"
        open={navOpen}
        collapsed={!isMobile && navCollapsed}
        onClose={() => setNavOpen(false)}
        onToggleCollapse={() => setNavCollapsed((prev) => !prev)}
      />
      <div className={navCollapsed && !isMobile ? `${styles.main} ${styles.mainCollapsed}` : styles.main}>
        <Topbar isMobile={isMobile} onOpenMobileMenu={() => setNavOpen(true)} />
        <main className={styles.content}>
          {/* Remount current page when switching company scope (admin multi-company). */}
          <Outlet key={companyScopeKey} />
        </main>
      </div>
    </div>
  );
}

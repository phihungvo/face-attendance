import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "../Sidebar/Sidebar";
import Topbar from "../Topbar/Topbar";
import styles from "./AppLayout.module.scss";
import { useAuth } from "../../../shared/auth/auth";

export default function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();
  const auth = useAuth();
  const companyScopeKey = String(auth.selectedCompanyId ?? auth.companyId ?? "none");

  useEffect(() => {
    // Close drawer after navigation on small screens.
    setNavOpen(false);
  }, [pathname]);

  return (
    <div className={styles.shell}>
      {navOpen ? <button className={styles.backdrop} type="button" aria-label="Đóng menu" onClick={() => setNavOpen(false)} /> : null}
      <Sidebar variant="drawer" open={navOpen} onClose={() => setNavOpen(false)} />
      <div className={styles.main}>
        <Topbar onOpenMenu={() => setNavOpen(true)} />
        <main className={styles.content}>
          {/* Remount current page when switching company scope (admin multi-company). */}
          <Outlet key={companyScopeKey} />
        </main>
      </div>
    </div>
  );
}

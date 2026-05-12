import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "../Sidebar/Sidebar";
import Topbar from "../Topbar/Topbar";
import styles from "./AppLayout.module.scss";

export default function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();

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
          <Outlet />
        </main>
      </div>
    </div>
  );
}

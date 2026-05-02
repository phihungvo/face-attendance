import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { formatDateVi } from "../../../shared/lib/date";
import { useClock } from "../../../shared/hooks/useClock";
import styles from "./Topbar.module.scss";
import { pageMetaByPath } from "./pageMeta";

export default function Topbar() {
  const { pathname } = useLocation();
  const meta = pageMetaByPath[pathname] ?? { title: "FaceTime HR", sub: "Hệ thống chấm công" };
  const { now } = useClock(1000);
  const [query, setQuery] = useState("");

  const todayLabel = useMemo(() => formatDateVi(now), [now]);

  return (
    <header className={styles.topbar}>
      <div className={styles.titleWrap}>
        <div className={styles.pageTitle}>{meta.title}</div>
        <div className={styles.pageSub}>{meta.sub}</div>
      </div>

      <div className={styles.actions}>
        <div className={styles.dateChip}>📅 {todayLabel}</div>

        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm kiếm..." />
        </div>

        <button className={styles.iconBtn} type="button" title="Thông báo">
          🔔<span className={styles.notifDot} />
        </button>
        <button className={styles.iconBtn} type="button" title="Trợ giúp">
          ❓
        </button>

        {meta.actionLabel ? (
          <Link className={`${styles.btn} ${styles.btnPrimary}`} to={meta.actionTo ?? pathname}>
            {meta.actionLabel}
          </Link>
        ) : null}
      </div>
    </header>
  );
}


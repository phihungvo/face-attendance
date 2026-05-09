import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { formatDateVi } from "../../../shared/lib/date";
import { useClock } from "../../../shared/hooks/useClock";
import { useTheme } from "../../../shared/theme/theme";
import styles from "./Topbar.module.scss";
import { pageMetaByPath } from "./pageMeta";
import { useAuth } from "../../../shared/auth/auth";
import { listCompanies, type Company } from "../../../shared/api/companies";

export default function Topbar({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const { pathname } = useLocation();
  const meta = pageMetaByPath[pathname] ?? { title: "FaceTime HR", sub: "Hệ thống chấm công" };
  const { now } = useClock(1000);
  const [query, setQuery] = useState("");
  const { resolvedTheme, toggle } = useTheme();
  const auth = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);

  const todayLabel = useMemo(() => formatDateVi(now), [now]);
  const showCompanySwitcher = auth.roleKeys.includes("admin") && auth.permissionKeys.includes("companies.read");

  useEffect(() => {
    if (!showCompanySwitcher) return;
    listCompanies({ limit: 500, offset: 0 })
      .then(setCompanies)
      .catch(() => setCompanies([]));
  }, [showCompanySwitcher]);

  return (
    <header className={styles.topbar}>
      <button className={styles.menuBtn} type="button" onClick={onOpenMenu} aria-label="Mở menu">
        ☰
      </button>
      <div className={styles.titleWrap}>
        <div className={styles.pageTitle}>{meta.title}</div>
        <div className={styles.pageSub}>{meta.sub}</div>
      </div>

      <div className={styles.actions}>
        <div className={styles.dateChip}>📅 {todayLabel}</div>

        {showCompanySwitcher ? (
          <div className={styles.companyBox} title="Chọn công ty để thao tác">
            <span className={styles.companyIcon}>🏢</span>
            <select
              value={auth.selectedCompanyId ?? auth.companyId ?? ""}
              onChange={(e) => auth.setSelectedCompanyId(e.target.value ? Number(e.target.value) : null)}
            >
              {(companies.length ? companies : auth.companyId ? [{ id: auth.companyId, code: "me", name: auth.companyName || "Company", status: "active", created_at: "" }] : []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

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
        <button className={styles.iconBtn} type="button" title="Đổi giao diện" onClick={toggle} aria-label="Đổi giao diện">
          {resolvedTheme === "dark" ? "🌙" : "☀️"}
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

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { formatDateTimeVi, formatDateVi } from "../../../shared/lib/date";
import { useClock } from "../../../shared/hooks/useClock";
import { useTheme } from "../../../shared/theme/theme";
import styles from "./Topbar.module.scss";
import { pageMetaByPath } from "./pageMeta";
import { useAuth } from "../../../shared/auth/auth";
import { listCompanies, type Company } from "../../../shared/api/companies";
import { listNotifications, markAllNotificationsRead, markNotificationRead, type NotificationItem } from "../../../shared/api/notifications";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import { useUnreadNotificationCount } from "../../../shared/notifications/useUnreadNotificationCount";

function getNotificationGlyph(item: NotificationItem) {
  if (item.category === "leave") return "📝";
  if (item.category === "schedule") return "📅";
  if (item.category === "attendance") return "📍";
  if (item.category === "settings") return "⚙️";
  if (item.category === "iam") return "🔐";
  return "🔔";
}

export default function Topbar({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const meta = pageMetaByPath[pathname] ?? { title: "FaceTime HR", sub: "Hệ thống chấm công" };
  const { now } = useClock(1000);
  const [query, setQuery] = useState("");
  const { resolvedTheme, toggle } = useTheme();
  const auth = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [latestItems, setLatestItems] = useState<NotificationItem[]>([]);
  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [dropdownError, setDropdownError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const unreadCount = useUnreadNotificationCount([auth.selectedCompanyId, auth.companyId]);

  const todayLabel = useMemo(() => formatDateVi(now), [now]);
  const showCompanySwitcher = auth.roleKeys.includes("admin") && auth.permissionKeys.includes("companies.read");

  useEffect(() => {
    if (!showCompanySwitcher) return;
    listCompanies({ limit: 500, offset: 0 })
      .then(setCompanies)
      .catch(() => setCompanies([]));
  }, [showCompanySwitcher]);

  async function reloadLatest() {
    try {
      setDropdownLoading(true);
      setDropdownError(null);
      const data = await listNotifications({ status: "all", limit: 8, offset: 0 });
      setLatestItems(data.items);
    } catch (e) {
      setDropdownError(getApiErrorMessage(e));
    } finally {
      setDropdownLoading(false);
    }
  }

  useEffect(() => {
    if (!dropdownOpen) return;
    void reloadLatest();
  }, [dropdownOpen, auth.selectedCompanyId, auth.companyId]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const timer = window.setInterval(() => void reloadLatest(), 15_000);
    return () => window.clearInterval(timer);
  }, [dropdownOpen, auth.selectedCompanyId, auth.companyId]);

  useEffect(() => {
    const onChanged = () => {
      if (dropdownOpen) void reloadLatest();
    };
    const onDocClick = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setDropdownOpen(false);
    };
    window.addEventListener("fa:notifications-changed", onChanged);
    document.addEventListener("mousedown", onDocClick);
    return () => {
      window.removeEventListener("fa:notifications-changed", onChanged);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [dropdownOpen]);

  async function handleRead(item: NotificationItem) {
    if (!item.is_read) {
      try {
        await markNotificationRead(item.id);
        setLatestItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, is_read: true, read_at: new Date().toISOString() } : row)));
      } catch (e) {
        setDropdownError(getApiErrorMessage(e));
      }
    }
    if (item.action_url) nav(item.action_url);
    else nav("/notifications");
    setDropdownOpen(false);
  }

  async function handleReadAll() {
    try {
      await markAllNotificationsRead();
      setLatestItems((prev) => prev.map((row) => ({ ...row, is_read: true, read_at: row.read_at ?? new Date().toISOString() })));
    } catch (e) {
      setDropdownError(getApiErrorMessage(e));
    }
  }

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

        <div className={styles.notifWrap} ref={dropdownRef}>
          <button className={styles.iconBtn} type="button" title="Thông báo" onClick={() => setDropdownOpen((prev) => !prev)}>
            🔔
            {unreadCount > 0 ? <span className={styles.notifCount}>{unreadCount > 99 ? "99+" : String(unreadCount)}</span> : null}
          </button>
          {dropdownOpen ? (
            <div className={styles.dropdown}>
              <div className={styles.dropdownHead}>
                <div>
                  <div className={styles.dropdownTitle}>Thông báo mới</div>
                  <div className={styles.dropdownSub}>{unreadCount > 0 ? `${unreadCount} chưa đọc` : "Đã cập nhật"}</div>
                </div>
                <button className={styles.dropdownGhost} type="button" onClick={() => void handleReadAll()} disabled={!latestItems.some((item) => !item.is_read)}>
                  Đọc hết
                </button>
              </div>

              {dropdownError ? <div className={styles.dropdownStateError}>{dropdownError}</div> : null}
              {dropdownLoading ? <div className={styles.dropdownState}>Đang tải thông báo...</div> : null}
              {!dropdownLoading && !latestItems.length ? <div className={styles.dropdownState}>Chưa có thông báo nào.</div> : null}

              {!dropdownLoading && latestItems.length ? (
                <div className={styles.dropdownList}>
                  {latestItems.map((item) => (
                    <button key={item.id} type="button" className={item.is_read ? styles.dropdownItem : `${styles.dropdownItem} ${styles.dropdownItemUnread}`} onClick={() => void handleRead(item)}>
                      <div className={styles.dropdownIcon}>{getNotificationGlyph(item)}</div>
                      <div className={styles.dropdownMain}>
                        <div className={styles.dropdownItemTitle}>{item.title}</div>
                        <div className={styles.dropdownItemBody}>{item.body || "Thông báo hệ thống"}</div>
                        <div className={styles.dropdownItemTime}>{formatDateTimeVi(new Date(item.created_at))}</div>
                      </div>
                      {!item.is_read ? <span className={styles.dropdownDot} /> : null}
                    </button>
                  ))}
                </div>
              ) : null}

              <button
                className={styles.dropdownFooter}
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  nav("/notifications");
                }}
              >
                Xem tất cả thông báo
              </button>
            </div>
          ) : null}
        </div>
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

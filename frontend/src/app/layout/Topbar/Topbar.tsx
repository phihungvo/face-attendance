import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BellOutlined,
  BgColorsOutlined,
  CalendarOutlined,
  DownOutlined,
  LockOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
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
import { getMyProfile } from "../../../shared/api/users";

function getNotificationGlyph(item: NotificationItem) {
  if (item.category === "leave") return <SafetyCertificateOutlined />;
  if (item.category === "schedule") return <CalendarOutlined />;
  if (item.category === "attendance") return <BellOutlined />;
  if (item.category === "settings") return <SettingOutlined />;
  if (item.category === "iam") return <SafetyCertificateOutlined />;
  return <BellOutlined />;
}

export default function Topbar({
  isMobile,
  onOpenMobileMenu
}: {
  isMobile: boolean;
  onOpenMobileMenu?: () => void;
}) {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const meta = pageMetaByPath[pathname] ?? { title: "FaceTime HR", sub: "Hệ thống chấm công" };
  const { now } = useClock(1000);
  const { toggle } = useTheme();
  const [query, setQuery] = useState("");
  const auth = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [latestItems, setLatestItems] = useState<NotificationItem[]>([]);
  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [dropdownError, setDropdownError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<Awaited<ReturnType<typeof getMyProfile>> | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const unreadCount = useUnreadNotificationCount([auth.selectedCompanyId, auth.companyId]);

  const todayLabel = useMemo(() => formatDateVi(now), [now]);
  const showCompanySwitcher = auth.roleKeys.includes("admin") && auth.permissionKeys.includes("companies.read");
  const canOpenSettings = auth.permissionKeys.includes("settings.read");
  const avatarText = (auth.username || "U").slice(0, 2).toUpperCase();
  const profileName = myProfile?.name || auth.username || "User";
  let topNavEnterIndex = 0;
  const topNavDelay = () => ({ "--topnav-enter-delay": `${180 + topNavEnterIndex++ * 64}ms` } as CSSProperties);

  useEffect(() => {
    if (!showCompanySwitcher) return;
    listCompanies({ limit: 500, offset: 0 })
      .then(setCompanies)
      .catch(() => setCompanies([]));
  }, [showCompanySwitcher]);

  useEffect(() => {
    void reloadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function reloadProfile() {
    try {
      setProfileLoading(true);
      setProfileError(null);
      const data = await getMyProfile();
      setMyProfile(data);
    } catch (e) {
      setProfileError(getApiErrorMessage(e));
      setMyProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }

  useEffect(() => {
    if (!dropdownOpen) return;
    void reloadLatest();
  }, [dropdownOpen, auth.selectedCompanyId, auth.companyId]);

  useEffect(() => {
    if (!profileOpen) return;
    void reloadProfile();
  }, [profileOpen]);

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
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false);
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
      {isMobile ? (
        <button className={styles.menuBtn} type="button" onClick={onOpenMobileMenu} aria-label="Mở menu">
          <MenuUnfoldOutlined />
        </button>
      ) : null}

      <div className={styles.titleWrap}>
        <div className={styles.pageTitle}>{meta.title}</div>
        <div className={styles.pageSub}>{meta.sub}</div>
      </div>

      <div className={styles.actions}>
        <div className={styles.dateChip} style={topNavDelay()}>
          <CalendarOutlined />
          {todayLabel}
        </div>

        {showCompanySwitcher ? (
          <div className={styles.companyBox} title="Chọn công ty để thao tác" style={topNavDelay()}>
            <span className={styles.companyIcon}>
              <SafetyCertificateOutlined />
            </span>
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

        <div className={styles.searchBox} style={topNavDelay()}>
          <span className={styles.searchIcon}>
            <SearchOutlined />
          </span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm kiếm..." />
        </div>

        <div className={styles.notifWrap} ref={dropdownRef} style={topNavDelay()}>
          <button className={styles.iconBtn} type="button" title="Thông báo" onClick={() => setDropdownOpen((prev) => !prev)}>
            <BellOutlined />
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
        <button className={styles.iconBtn} type="button" title="Đổi giao diện" aria-label="Đổi giao diện" onClick={toggle} style={topNavDelay()}>
          <BgColorsOutlined />
        </button>
        <div className={styles.profileWrap} ref={profileRef} style={topNavDelay()}>
          <button className={styles.profileTrigger} type="button" onClick={() => setProfileOpen((prev) => !prev)} aria-label="Mở menu tài khoản">
            <span className={styles.profileAvatar}>{avatarText}</span>
            <span className={styles.profileTriggerBody}>
              <strong>{profileName}</strong>
            </span>
            <span className={styles.profileChevron}>
              <DownOutlined />
            </span>
          </button>
          {profileOpen ? (
            <div className={styles.profileDropdown}>
              <div className={styles.profileDropdownHead}>
                <div className={styles.profileDropdownAvatar}>{avatarText}</div>
                <div className={styles.profileDropdownIdentity}>
                  <strong>{profileName}</strong>
                  <small>@{auth.username || "user"}</small>
                </div>
              </div>

              {profileError ? <div className={styles.profileStateError}>{profileError}</div> : null}
              {profileLoading ? <div className={styles.profileState}>Đang tải thông tin tài khoản...</div> : null}

              <div className={styles.profileMeta}>
                <div className={styles.profileMetaItem}>
                  <span className={styles.profileMetaLabel}>Công ty</span>
                  <span className={styles.profileMetaValue}>{auth.companyName || "Chưa có công ty"}</span>
                </div>
                <div className={styles.profileMetaItem}>
                  <span className={styles.profileMetaLabel}>Mã nhân viên</span>
                  <span className={styles.profileMetaValue}>{myProfile?.code || "Chưa cập nhật"}</span>
                </div>
              </div>

              <div className={styles.profileActionList}>
                {canOpenSettings ? (
                  <button
                    className={styles.profileAction}
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      nav("/change-password");
                    }}
                  >
                    <LockOutlined />
                    <span>Đổi mật khẩu</span>
                  </button>
                ) : null}
                <button
                  className={`${styles.profileAction} ${styles.profileActionDanger}`}
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    auth.logout();
                  }}
                >
                  <LogoutOutlined />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {meta.actionLabel ? (
          <Link className={`${styles.btn} ${styles.btnPrimary}`} to={meta.actionTo ?? pathname} style={topNavDelay()}>
            {meta.actionLabel}
          </Link>
        ) : null}
      </div>
    </header>
  );
}

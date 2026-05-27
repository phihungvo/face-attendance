import {useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import Card from "../../components/Card/Card";
import {
    archiveNotification,
    deleteNotification,
    getMyNotificationPreferences,
    listNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    type NotificationItem,
    type NotificationPreferences,
    updateMyNotificationPreferences
} from "../../../shared/api/notifications";
import {getApiErrorMessage} from "../../../shared/lib/apiClient";
import {formatDateTimeVi} from "../../../shared/lib/date";
import {
    BellOutlined,
    CalendarOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    DeleteOutlined,
    ExclamationCircleOutlined,
    FileTextOutlined,
    LockOutlined,
    EnvironmentOutlined,
    SettingOutlined,
    CloseOutlined
} from "@ant-design/icons";
import styles from "./NotificationsPage.module.scss";

const pageSize = 7;

function getNotificationIcon(item: NotificationItem) {
    if (item.category === "leave") {
        return item.severity === "success"
            ? <CheckCircleOutlined/>
            : item.severity === "warning"
                ? <FileTextOutlined/>
                : <FileTextOutlined/>;
    }

    if (item.category === "schedule") {
        return item.severity === "success"
            ? <CalendarOutlined/>
            : item.severity === "warning"
                ? <ClockCircleOutlined/>
                : <CalendarOutlined/>;
    }

    if (item.category === "attendance") {
        return <EnvironmentOutlined/>;
    }

    if (item.category === "settings") {
        return <SettingOutlined/>;
    }

    if (item.category === "iam") {
        return <LockOutlined/>;
    }

    if (item.severity === "warning") {
        return <ExclamationCircleOutlined/>;
    }

    return <BellOutlined/>;
}

function getCategoryPillClass(category: string): string {
    const map: Record<string, string> = {
        leave: styles.pillLeave,
        schedule: styles.pillSchedule,
        attendance: styles.pillAttendance,
        iam: styles.pillIam,
        settings: styles.pillSettings,
        system: styles.pillSystem,
    };
    return map[category] ?? styles.pillSystem;
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    if (diffDays === 0) return d.toLocaleTimeString("vi-VN", {hour: "2-digit", minute: "2-digit"});
    if (diffDays === 1) return "Hôm qua";
    return d.toLocaleDateString("vi-VN", {day: "2-digit", month: "2-digit"});
}

function Toggle({
                    checked,
                    onChange,
                    label
                }: {
    checked: boolean;
    onChange(next: boolean): void;
    label: string;
}) {
    return (
        <button className={checked ? `${styles.prefToggle} ${styles.prefToggleOn}` : styles.prefToggle} type="button"
                role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}>
            <span className={styles.prefToggleThumb}/>
        </button>
    );
}

export default function NotificationsPage() {
    const nav = useNavigate();
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<"all" | "unread" | "archived">("all");
    const [category, setCategory] = useState<string>("all");
    const [severity, setSeverity] = useState<string>("all");
    const [offset, setOffset] = useState(0);
    const [total, setTotal] = useState(0);
    const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
    const [prefsSaving, setPrefsSaving] = useState(false);

    const categoryOptions = useMemo(
        () => [
            {value: "all", label: "Tất cả nhóm"},
            {value: "attendance", label: "Chấm công"},
            {value: "leave", label: "Nghỉ phép"},
            {value: "schedule", label: "Lịch làm"},
            {value: "settings", label: "Cài đặt"},
            {value: "iam", label: "Tài khoản"},
            {value: "system", label: "Hệ thống"}
        ],
        []
    );

    const severityOptions = useMemo(
        () => [
            {value: "all", label: "Mọi mức độ"},
            {value: "info", label: "Thông tin"},
            {value: "success", label: "Thành công"},
            {value: "warning", label: "Cảnh báo"},
            {value: "critical", label: "Khẩn cấp"}
        ],
        []
    );

    async function loadPreferences() {
        try {
            const data = await getMyNotificationPreferences();
            setPrefs(data);
        } catch (e) {
            setError(getApiErrorMessage(e));
        }
    }

    async function reload(nextStatus = status, nextCategory = category, nextSeverity = severity, nextOffset = 0, append = false) {
        try {
            setLoading(true);
            setError(null);
            const data = await listNotifications({
                status: nextStatus,
                category: nextCategory === "all" ? undefined : nextCategory,
                severity: nextSeverity === "all" ? undefined : nextSeverity,
                limit: pageSize,
                offset: nextOffset
            });
            setItems((prev) => (append ? [...prev, ...data.items] : data.items));
            setOffset(nextOffset);
            setTotal(data.total);
        } catch (e) {
            setError(getApiErrorMessage(e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void reload(status, category, severity, 0, false);
    }, [status, category, severity]);

    useEffect(() => {
        void loadPreferences();
        const onChanged = () => void reload(status, category, severity, 0, false);
        const onPrefsChanged = () => void loadPreferences();
        window.addEventListener("fa:notifications-changed", onChanged);
        window.addEventListener("fa:notification-preferences-changed", onPrefsChanged);
        return () => {
            window.removeEventListener("fa:notifications-changed", onChanged);
            window.removeEventListener("fa:notification-preferences-changed", onPrefsChanged);
        };
    }, [status, category, severity]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            void reload(status, category, severity, 0, false);
        }, 15_000);
        return () => window.clearInterval(timer);
    }, [status, category, severity]);

    async function handleRead(item: NotificationItem) {
        try {
            if (!item.is_read) {
                await markNotificationRead(item.id);
                setItems((prev) => prev.map((x) => (x.id === item.id ? {
                    ...x,
                    is_read: true,
                    read_at: new Date().toISOString()
                } : x)));
            }
            if (item.action_url) nav(item.action_url);
        } catch (e) {
            setError(getApiErrorMessage(e));
        }
    }

    async function handleReadAll() {
        try {
            await markAllNotificationsRead();
            setItems((prev) => prev.map((x) => ({
                ...x,
                is_read: true,
                read_at: x.read_at ?? new Date().toISOString()
            })));
        } catch (e) {
            setError(getApiErrorMessage(e));
        }
    }

    async function handleArchive(item: NotificationItem) {
        try {
            await archiveNotification(item.id);
            setItems((prev) => prev.filter((x) => x.id !== item.id));
            setTotal((prev) => Math.max(0, prev - 1));
        } catch (e) {
            setError(getApiErrorMessage(e));
        }
    }

    async function handleDelete(item: NotificationItem) {
        try {
            await deleteNotification(item.id);
            setItems((prev) => prev.filter((x) => x.id !== item.id));
            setTotal((prev) => Math.max(0, prev - 1));
        } catch (e) {
            setError(getApiErrorMessage(e));
        }
    }

    async function savePrefs(next: NotificationPreferences) {
        try {
            setPrefsSaving(true);
            setError(null);
            const data = await updateMyNotificationPreferences(next);
            setPrefs(data);
        } catch (e) {
            setError(getApiErrorMessage(e));
        } finally {
            setPrefsSaving(false);
        }
    }

    return (
        <div className={styles.page}>
            <Card
                title="🔔 Thông báo"
                sub={loading ? "Đang tải..." : `${total} thông báo`}
                right={
                    <button className={styles.btnGhost} type="button" onClick={() => void handleReadAll()}
                            disabled={!items.some((x) => !x.is_read)}>
                        Đánh dấu đã đọc
                    </button>
                }
            >
                <div className={styles.toolbar}>
                    <div className={styles.chips}>
                        <button
                            className={status === "all" ? `${styles.filterBtn} ${styles.filterBtnActive}` : styles.filterBtn}
                            type="button" onClick={() => setStatus("all")}>
                            Tất cả
                        </button>
                        <button
                            className={status === "unread" ? `${styles.filterBtn} ${styles.filterBtnActive}` : styles.filterBtn}
                            type="button" onClick={() => setStatus("unread")}>
                            Chưa đọc
                        </button>
                        <button
                            className={status === "archived" ? `${styles.filterBtn} ${styles.filterBtnActive}` : styles.filterBtn}
                            type="button" onClick={() => setStatus("archived")}>
                            Đã ẩn
                        </button>
                    </div>
                    <div className={styles.filters}>
                        <select className={styles.select} value={category} onChange={(e) => setCategory(e.target.value)}
                                aria-label="Lọc theo nhóm">
                            {categoryOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <select className={styles.select} value={severity} onChange={(e) => setSeverity(e.target.value)}
                                aria-label="Lọc theo mức độ">
                            {severityOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                {error ? <div className={styles.error}>{error}</div> : null}
                <div className={styles.list}>
                    {!loading && items.length === 0 ? <div className={styles.empty}>Chưa có thông báo nào.</div> : null}
                    {items.map((item) => (
                        <div key={item.id} className={item.is_read ? styles.item : `${styles.item} ${styles.unread}`}>
                            <button className={styles.itemMain} type="button" onClick={() => void handleRead(item)}>
                                <div className={styles.icon}>{getNotificationIcon(item)}</div>
                                <div className={styles.main}>
                                    <div className={styles.itemTopRow}>
                                        <div className={styles.title}>{item.title}</div>
                                        <div className={styles.metaRight}>
            <span className={`${styles.categoryPill} ${getCategoryPillClass(item.category)}`}>
              {categoryOptions.find((c) => c.value === item.category)?.label ?? item.category}
            </span>
                                            <span className={styles.time}>{formatTime(item.created_at)}</span>
                                            {/*{!item.is_read ? <span className={styles.dot}/> : null}*/}
                                        </div>
                                    </div>
                                    <div className={styles.sub}>{item.body || "Thông báo hệ thống"}</div>
                                </div>
                            </button>
                            <div className={styles.actions}>
                                <button
                                    className={styles.closeBtn}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();

                                        if (status === "archived") {
                                            void handleDelete(item);
                                        } else {
                                            void handleArchive(item);
                                        }
                                    }}
                                    aria-label={status === "archived" ? "Xóa thông báo" : "Ẩn thông báo"}
                                >
                                    <CloseOutlined/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                {!loading && items.length < total ? (
                    <button className={styles.loadMore} type="button"
                            onClick={() => void reload(status, category, severity, offset + pageSize, true)}>
                        Tải thêm
                    </button>
                ) : null}
            </Card>

            <Card title="Tùy chọn cá nhân" sub="Điều khiển loại thông báo và toast realtime của bạn">
                {prefs ? (
                    <div className={styles.prefGrid}>
                        <div className={styles.prefRow}>
                            <div>
                                <div className={styles.prefTitle}>Toast realtime</div>
                                <div className={styles.prefSub}>Hiện popup khi có thông báo mới</div>
                            </div>
                            <Toggle checked={prefs.realtime_toast_enabled}
                                    onChange={(next) => void savePrefs({...prefs, realtime_toast_enabled: next})}
                                    label="Toast realtime"/>
                        </div>
                        <div className={styles.prefRow}>
                            <div>
                                <div className={styles.prefTitle}>Chấm công</div>
                                <div className={styles.prefSub}>Check-in, check-out, lỗi GPS, lỗi khuôn mặt</div>
                            </div>
                            <Toggle checked={prefs.attendance_enabled}
                                    onChange={(next) => void savePrefs({...prefs, attendance_enabled: next})}
                                    label="Thông báo chấm công"/>
                        </div>
                        <div className={styles.prefRow}>
                            <div>
                                <div className={styles.prefTitle}>Nghỉ phép</div>
                                <div className={styles.prefSub}>Tạo, duyệt, từ chối, cập nhật đơn nghỉ</div>
                            </div>
                            <Toggle checked={prefs.leave_enabled}
                                    onChange={(next) => void savePrefs({...prefs, leave_enabled: next})}
                                    label="Thông báo nghỉ phép"/>
                        </div>
                        <div className={styles.prefRow}>
                            <div>
                                <div className={styles.prefTitle}>Lịch làm</div>
                                <div className={styles.prefSub}>Đăng ký ca, duyệt ca, hủy ca</div>
                            </div>
                            <Toggle checked={prefs.schedule_enabled}
                                    onChange={(next) => void savePrefs({...prefs, schedule_enabled: next})}
                                    label="Thông báo lịch làm"/>
                        </div>
                        <div className={styles.prefRow}>
                            <div>
                                <div className={styles.prefTitle}>Cài đặt hệ thống</div>
                                <div className={styles.prefSub}>Thay đổi policy chấm công, GPS, cấu hình công ty</div>
                            </div>
                            <Toggle checked={prefs.settings_enabled}
                                    onChange={(next) => void savePrefs({...prefs, settings_enabled: next})}
                                    label="Thông báo cài đặt hệ thống"/>
                        </div>
                        <div className={styles.prefRow}>
                            <div>
                                <div className={styles.prefTitle}>Tài khoản và phân quyền</div>
                                <div className={styles.prefSub}>Kích hoạt tài khoản, đổi mật khẩu, thay đổi quyền truy
                                    cập
                                </div>
                            </div>
                            <Toggle checked={prefs.iam_enabled}
                                    onChange={(next) => void savePrefs({...prefs, iam_enabled: next})}
                                    label="Thông báo tài khoản và phân quyền"/>
                        </div>
                        <div className={styles.prefRow}>
                            <div>
                                <div className={styles.prefTitle}>Thông báo hệ thống</div>
                                <div className={styles.prefSub}>Cảnh báo chung, sự cố và bản tin hệ thống</div>
                            </div>
                            <Toggle checked={prefs.system_enabled}
                                    onChange={(next) => void savePrefs({...prefs, system_enabled: next})}
                                    label="Thông báo hệ thống"/>
                        </div>
                    </div>
                ) : (
                    <div className={styles.empty}>Đang tải tùy chọn thông báo...</div>
                )}
                {prefsSaving ? <div className={styles.prefSaving}>Đang lưu tùy chọn...</div> : null}
            </Card>
        </div>
    );
}

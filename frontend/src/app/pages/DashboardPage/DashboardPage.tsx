import {useEffect, useMemo, useState} from "react";
import {
    ApartmentOutlined,
    ArrowDownOutlined,
    ArrowUpOutlined,
    AuditOutlined,
    BarChartOutlined,
    CalendarOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    FieldTimeOutlined,
    FireOutlined,
    InfoCircleOutlined,
    LoginOutlined,
    LogoutOutlined,
    NumberOutlined,
    RiseOutlined,
    TeamOutlined,
    TrophyOutlined,
    WarningOutlined
} from "@ant-design/icons";
import Card from "../../components/Card/Card";
import {
    getManagerDashboardDepartments,
    getManagerDashboardLeaveSummary,
    getManagerDashboardPendingLeaves,
    getManagerDashboardRecentLogs,
    getManagerDashboardToday,
    getManagerDashboardTrend,
    getManagerDashboardWorkHours,
    type ManagerDashboardDepartmentRow,
    type ManagerDashboardLeaveSummary,
    type ManagerDashboardPendingLeaveItem,
    type ManagerDashboardRecentLogItem,
    type ManagerDashboardTodaySummary,
    type ManagerDashboardTrendPoint,
    type ManagerDashboardWorkHoursPeriod,
    type ManagerDashboardWorkHoursSummary
} from "../../../shared/api/attendance";
import {useAuth} from "../../../shared/auth/auth";
import {getApiErrorMessage} from "../../../shared/lib/apiClient";
import styles from "./DashboardPage.module.scss";

const LEAVE_TYPE_VI: Record<string, string> = {
    annual: "Nghỉ phép năm",
    sick: "Nghỉ ốm",
    unpaid: "Nghỉ không lương",
    personal: "Nghỉ cá nhân"
};

type DashboardAlertTone = "danger" | "warn" | "info" | "good";

type DashboardAlert = {
    key: string;
    title: string;
    sub: string;
    tone: DashboardAlertTone;
    icon: React.ReactNode;
};

type ApiStatus = "pending" | "loading" | "success" | "error";

type DashboardSectionState<T> = {
    status: ApiStatus;
    data: T | null;
    error: string | null;
};

function createSectionState<T>(): DashboardSectionState<T> {
    return {
        status: "pending",
        data: null,
        error: null
    };
}

function isWaiting<T>(state: DashboardSectionState<T>) {
    return state.status === "pending" || state.status === "loading";
}

function isDashboardReload() {
    if (typeof performance === "undefined") return false;
    const [navigation] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    return navigation?.type === "reload";
}

function consumeDashboardIntroFlag() {
    if (typeof sessionStorage === "undefined") return false;
    const shouldAnimate = sessionStorage.getItem("dashboard:intro") === "login";
    if (shouldAnimate) sessionStorage.removeItem("dashboard:intro");
    return shouldAnimate;
}

function formatDate(day: string) {
    return new Date(`${day}T12:00:00`).toLocaleDateString("vi-VN", {day: "2-digit", month: "2-digit"});
}

function formatLongDate(day: string) {
    return new Date(`${day}T12:00:00`).toLocaleDateString("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
    });
}

function toDateInputValue(value: Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function todayInputValue() {
    return toDateInputValue(new Date());
}

function getIsoWeekValue(day: string) {
    const dateValue = new Date(`${day}T12:00:00`);
    const target = new Date(dateValue.valueOf());
    const dayNumber = (target.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNumber + 3);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const firstDayNumber = (firstThursday.getDay() + 6) % 7;
    const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + firstDayNumber) / 7);
    return `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function isoWeekToDate(value: string) {
    const match = /^(\d{4})-W(\d{2})$/.exec(value);
    if (!match) return todayInputValue();
    const year = Number(match[1]);
    const week = Number(match[2]);
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const day = (simple.getDay() + 6) % 7;
    const weekStart = new Date(simple.valueOf());
    if (day <= 3) {
        weekStart.setDate(simple.getDate() - day);
    } else {
        weekStart.setDate(simple.getDate() + 7 - day);
    }
    return toDateInputValue(weekStart);
}

function workHoursInputValue(period: ManagerDashboardWorkHoursPeriod, anchorDate: string) {
    if (period === "week") return getIsoWeekValue(anchorDate);
    if (period === "year") return anchorDate.slice(0, 4);
    return anchorDate.slice(0, 7);
}

function anchorDateFromInput(period: ManagerDashboardWorkHoursPeriod, value: string) {
    if (!value) return todayInputValue();
    if (period === "week") return isoWeekToDate(value);
    if (period === "year") return `${value}-06-15`;
    return `${value}-15`;
}

function formatDateTime(value: string) {
    return new Date(value).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function leaveTypeVi(type: string) {
    return LEAVE_TYPE_VI[type] ?? type;
}

function attendanceTypeVi(type: "checkin" | "checkout") {
    return type === "checkin" ? "Vào ca" : "Ra ca";
}

function attendanceIcon(type: "checkin" | "checkout") {
    return type === "checkin" ? <LoginOutlined/> : <LogoutOutlined/>;
}

function formatHours(value: number) {
    if (!Number.isFinite(value)) return "0h";
    const rounded = Math.round(value * 10) / 10;
    return `${rounded.toLocaleString("vi-VN")}h`;
}

function getInitials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "??";
    return parts
        .slice(-2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
}

function averageRate(items: ManagerDashboardTrendPoint[]) {
    if (!items.length) return 0;
    return Math.round((items.reduce((sum, item) => sum + item.attendance_rate, 0) / items.length) * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function absenceRate(total: number, absent: number) {
    if (!total) return 0;
    return Math.round((absent / total) * 100 * 10) / 10;
}

function queueAge(createdAt: string) {
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const diffHours = Math.max(0, Math.floor(diffMs / 3_600_000));
    if (diffHours < 24) return `${diffHours} giờ`;
    return `${Math.floor(diffHours / 24)} ngày`;
}

function departmentRiskScore(row: ManagerDashboardDepartmentRow) {
    return row.absent_count * 3 + row.late_count * 2 + (100 - row.attendance_rate);
}

function SectionError({message}: { message: string }) {
    return <div className={styles.sectionError}>{message}</div>;
}

function LoadingBadge() {
    return <span className={`${styles.skeletonLine} ${styles.badgeSkeleton}`}/>;
}

function ChartSkeleton() {
    return (
        <div className={styles.chartLayout}>
            <div className={styles.chartPanel}>
                <div className={styles.chartSummary}>
                    <div className={styles.chartHeadline}>
                        <span className={`${styles.skeletonLine} ${styles.chartValueSkeleton}`}/>
                        <div className={styles.chartHeadlineMeta}>
                            <span className={`${styles.skeletonLine} ${styles.textSkeletonSm}`}/>
                            <strong><span className={`${styles.skeletonLine} ${styles.textSkeletonMd}`}/></strong>
                        </div>
                    </div>
                    <div className={styles.chartPills}>
                        {Array.from({length: 4}).map((_, index) => (
                            <span key={index} className={`${styles.skeletonLine} ${styles.pillSkeleton}`}/>
                        ))}
                    </div>
                </div>
                <div className={`${styles.chartCanvas} ${styles.chartCanvasSkeleton}`}>
                    <span
                        className={`${styles.skeletonLine} ${styles.chartSkeletonLine} ${styles.chartSkeletonLineOne}`}/>
                    <span
                        className={`${styles.skeletonLine} ${styles.chartSkeletonLine} ${styles.chartSkeletonLineTwo}`}/>
                    <span
                        className={`${styles.skeletonLine} ${styles.chartSkeletonLine} ${styles.chartSkeletonLineThree}`}/>
                </div>
                <div className={styles.chartAxisRow}>
                    {Array.from({length: 7}).map((_, index) => (
                        <span key={index} className={`${styles.skeletonLine} ${styles.axisSkeleton}`}/>
                    ))}
                </div>
                {/*<div className={styles.chartDetailGrid}>*/}
                {/*    {Array.from({length: 3}).map((_, index) => (*/}
                {/*        <article key={index} className={styles.chartDetailCard}>*/}
                {/*            <span className={`${styles.skeletonLine} ${styles.textSkeletonSm}`}/>*/}
                {/*            <span className={`${styles.skeletonLine} ${styles.textSkeletonLg}`}/>*/}
                {/*            <span className={`${styles.skeletonLine} ${styles.textSkeletonMd}`}/>*/}
                {/*        </article>*/}
                {/*    ))}*/}
                {/*</div>*/}
            </div>
            <div className={styles.trendFacts}>
                {Array.from({length: 3}).map((_, index) => (
                    <div key={index} className={styles.factCard}>
                        <span className={`${styles.skeletonLine} ${styles.factIconSkeleton}`}/>
                        <div>
                            <div className={styles.factLabel}><span
                                className={`${styles.skeletonLine} ${styles.textSkeletonSm}`}/></div>
                            <strong className={styles.factValue}><span
                                className={`${styles.skeletonLine} ${styles.textSkeletonLg}`}/></strong>
                            <div className={styles.factSub}><span
                                className={`${styles.skeletonLine} ${styles.textSkeletonMd}`}/></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function WorkHoursSkeleton() {
    return (
        <div className={styles.workHoursChart}>
            <div className={styles.workHoursSummary}>
                {Array.from({length: 3}).map((_, index) => (
                    <div key={index} className={styles.workHoursMetric}>
                        <span className={`${styles.skeletonLine} ${styles.textSkeletonSm}`}/>
                        <strong><span className={`${styles.skeletonLine} ${styles.textSkeletonLg}`}/></strong>
                    </div>
                ))}
            </div>
            <div className={styles.workHoursList}>
                {Array.from({length: 3}).map((_, index) => (
                    <div key={index} className={styles.workHoursRow}>
                        <span className={`${styles.skeletonLine} ${styles.workRankSkeleton}`}/>
                        <div className={styles.workHoursMain}>
                            <div className={styles.workHoursTopLine}>
                                <span className={`${styles.skeletonLine} ${styles.textSkeletonMd}`}/>
                                <span className={`${styles.skeletonLine} ${styles.timeSkeleton}`}/>
                            </div>
                            <div className={styles.workHoursBarTrack}>
                                <span className={`${styles.skeletonLine} ${styles.progressSkeleton}`}/>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function DepartmentSkeleton() {
    return (
        <div className={styles.departmentOverview}>
            <div className={styles.calloutGrid}>
                {Array.from({length: 2}).map((_, index) => (
                    <div key={index} className={styles.calloutCard}>
                        <span className={`${styles.skeletonLine} ${styles.textSkeletonSm}`}/>
                        <span className={`${styles.skeletonLine} ${styles.textSkeletonLg}`}/>
                        <span className={`${styles.skeletonLine} ${styles.textSkeletonMd}`}/>
                    </div>
                ))}
            </div>
            <div className={styles.departmentList}>
                {Array.from({length: 4}).map((_, index) => (
                    <article key={index} className={styles.departmentRow}>
                        <div className={styles.departmentHead}>
                            <div className={styles.skeletonGrow}>
                                <span className={`${styles.skeletonLine} ${styles.textSkeletonLg}`}/>
                                <div className={styles.departmentMeta}>
                                    {Array.from({length: 4}).map((__, pillIndex) => (
                                        <span key={pillIndex}
                                              className={`${styles.skeletonLine} ${styles.pillSkeleton}`}/>
                                    ))}
                                </div>
                            </div>
                            <span className={`${styles.skeletonLine} ${styles.rateSkeleton}`}/>
                        </div>
                        <div className={styles.progressTrack}>
                            <span className={`${styles.skeletonLine} ${styles.progressSkeleton}`}/>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
}

function LeaveSummarySkeleton() {
    return (
        <div className={styles.leaveSummaryStrip}>
            {Array.from({length: 3}).map((_, index) => (
                <div key={index} className={styles.summaryMini}>
                    <span className={`${styles.skeletonLine} ${styles.textSkeletonSm}`}/>
                    <strong><span className={`${styles.skeletonLine} ${styles.summaryNumberSkeleton}`}/></strong>
                </div>
            ))}
        </div>
    );
}

function QueueSkeleton({rows = 3}: { rows?: number }) {
    return (
        <div className={styles.queueList}>
            {Array.from({length: rows}).map((_, index) => (
                <article key={index} className={styles.queueRow}>
                    <span className={`${styles.skeletonLine} ${styles.avatarSkeleton}`}/>
                    <div className={styles.queueMain}>
                        <div className={styles.queueTop}>
                            <span className={`${styles.skeletonLine} ${styles.textSkeletonLg}`}/>
                            <span className={`${styles.skeletonLine} ${styles.timeSkeleton}`}/>
                        </div>
                        <div className={styles.queueSub}><span
                            className={`${styles.skeletonLine} ${styles.textSkeletonMd}`}/></div>
                        <div className={styles.queueMeta}>
                            {Array.from({length: 3}).map((__, pillIndex) => (
                                <span key={pillIndex} className={`${styles.skeletonLine} ${styles.pillSkeleton}`}/>
                            ))}
                        </div>
                    </div>
                </article>
            ))}
        </div>
    );
}

export default function DashboardPage() {
    const auth = useAuth();
    const [todayState, setTodayState] = useState<DashboardSectionState<ManagerDashboardTodaySummary>>(() => createSectionState());
    const [leaveSummaryState, setLeaveSummaryState] = useState<DashboardSectionState<ManagerDashboardLeaveSummary>>(() => createSectionState());
    const [trendState, setTrendState] = useState<DashboardSectionState<ManagerDashboardTrendPoint[]>>(() => createSectionState());
    const [departmentsState, setDepartmentsState] = useState<DashboardSectionState<ManagerDashboardDepartmentRow[]>>(() => createSectionState());
    const [pendingLeavesState, setPendingLeavesState] = useState<DashboardSectionState<ManagerDashboardPendingLeaveItem[]>>(() => createSectionState());
    const [recentLogsState, setRecentLogsState] = useState<DashboardSectionState<ManagerDashboardRecentLogItem[]>>(() => createSectionState());
    const [workHoursState, setWorkHoursState] = useState<DashboardSectionState<ManagerDashboardWorkHoursSummary>>(() => createSectionState());
    const [workHoursPeriod, setWorkHoursPeriod] = useState<ManagerDashboardWorkHoursPeriod>("month");
    const [workHoursAnchorDate, setWorkHoursAnchorDate] = useState(() => todayInputValue());
    const [activeTrendIndex, setActiveTrendIndex] = useState(0);
    const [shouldAnimatePage] = useState(() => consumeDashboardIntroFlag() || isDashboardReload());
    const dashboardScopeKey = `${auth.selectedCompanyId ?? auth.companyId ?? "default"}`;

    useEffect(() => {
        let cancelled = false;

        const runSection = async <T, >(
            setState: (state: DashboardSectionState<T>) => void,
            request: () => Promise<T>
        ) => {
            if (cancelled) return;
            setState({status: "loading", data: null, error: null});
            try {
                const result = await request();
                if (cancelled) return;
                setState({status: "success", data: result, error: null});
            } catch (e) {
                if (cancelled) return;
                setState({status: "error", data: null, error: getApiErrorMessage(e)});
            }
        };

        (async () => {
            setTodayState(createSectionState());
            setLeaveSummaryState(createSectionState());
            setTrendState(createSectionState());
            setDepartmentsState(createSectionState());
            setPendingLeavesState(createSectionState());
            setRecentLogsState(createSectionState());

            await runSection(setTodayState, getManagerDashboardToday);
            await runSection(setLeaveSummaryState, getManagerDashboardLeaveSummary);
            await runSection(setTrendState, () => getManagerDashboardTrend({days: 7}));
            await runSection(setDepartmentsState, getManagerDashboardDepartments);
            await runSection(setPendingLeavesState, () => getManagerDashboardPendingLeaves({limit: 5}));
            await runSection(setRecentLogsState, () => getManagerDashboardRecentLogs({limit: 8}));
        })();

        return () => {
            cancelled = true;
        };
    }, [dashboardScopeKey]);

    useEffect(() => {
        let cancelled = false;

        setWorkHoursState({status: "loading", data: null, error: null});
        getManagerDashboardWorkHours({
            period: workHoursPeriod,
            anchor_date: workHoursAnchorDate,
            limit: 3
        })
            .then((result) => {
                if (cancelled) return;
                setWorkHoursState({status: "success", data: result, error: null});
            })
            .catch((e) => {
                if (cancelled) return;
                setWorkHoursState({status: "error", data: null, error: getApiErrorMessage(e)});
            });

        return () => {
            cancelled = true;
        };
    }, [dashboardScopeKey, workHoursAnchorDate, workHoursPeriod]);

    const today = todayState.data;
    const leaveSummary = leaveSummaryState.data;
    const trend = trendState.data ?? [];
    const departments = departmentsState.data ?? [];
    const pendingLeaves = pendingLeavesState.data ?? [];
    const recentLogs = recentLogsState.data ?? [];
    const workHours = workHoursState.data;
    const workHoursEmployees = workHours?.employees ?? [];
    const todayWaiting = isWaiting(todayState);
    const leaveSummaryWaiting = isWaiting(leaveSummaryState);
    const trendWaiting = isWaiting(trendState);
    const departmentsWaiting = isWaiting(departmentsState);
    const pendingLeavesWaiting = isWaiting(pendingLeavesState);
    const recentLogsWaiting = isWaiting(recentLogsState);
    const workHoursWaiting = isWaiting(workHoursState);

    const averageAttendance = useMemo(() => averageRate(trend), [trend]);
    const presentRate = today?.attendance_rate ?? 0;
    const absentRate = today ? absenceRate(today.total_users, today.absent_count) : 0;
    const lateRate = today?.total_users ? Math.round((today.late_count / today.total_users) * 100 * 10) / 10 : 0;

    const chartGeometry = useMemo(() => {
        if (!trend.length) return null;

        const width = 760;
        const height = 280;
        const padLeft = 30;
        const padRight = 18;
        const padTop = 20;
        const padBottom = 36;
        const values = trend.map((item) => item.attendance_rate);
        const rawMin = Math.min(...values);
        const rawMax = Math.max(...values);
        const lower = clamp(Math.floor((rawMin - 8) / 5) * 5, 0, 100);
        const upper = clamp(Math.ceil((rawMax + 8) / 5) * 5, 20, 100);
        const range = Math.max(upper - lower, 12);
        const usableWidth = width - padLeft - padRight;
        const usableHeight = height - padTop - padBottom;
        const stepX = trend.length > 1 ? usableWidth / (trend.length - 1) : 0;

        const points = trend.map((item, index) => {
            const x = padLeft + stepX * index;
            const normalized = (item.attendance_rate - lower) / range;
            const y = height - padBottom - normalized * usableHeight;
            return {...item, x, y};
        });

        const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
        const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padBottom} L ${points[0].x} ${height - padBottom} Z`;
        const gridValues = [upper, lower + range * 0.66, lower + range * 0.33, lower].map((value) => Math.round(value));

        return {
            width,
            height,
            padLeft,
            padRight,
            padBottom,
            lower,
            upper,
            usableHeight,
            points,
            linePath,
            areaPath,
            gridValues
        };
    }, [trend]);

    const latestTrend = trend[trend.length - 1] ?? null;
    const previousTrend = trend[trend.length - 2] ?? null;
    const trendDelta =
        latestTrend && previousTrend ? Math.round((latestTrend.attendance_rate - previousTrend.attendance_rate) * 10) / 10 : null;
    const activeTrend = trend[activeTrendIndex] ?? latestTrend;
    const activeTrendPrev = activeTrendIndex > 0 ? trend[activeTrendIndex - 1] ?? null : null;
    const activeTrendDelta =
        activeTrend && activeTrendPrev ? Math.round((activeTrend.attendance_rate - activeTrendPrev.attendance_rate) * 10) / 10 : null;
    const maxWorkHours = useMemo(
        () => Math.max(1, ...workHoursEmployees.map((item) => Number(item.total_work_hours) || 0)),
        [workHoursEmployees]
    );
    const workHoursRangeLabel = workHours ? `${formatDate(workHours.from_date)} - ${formatDate(workHours.to_date)}` : "--";

    useEffect(() => {
        if (!trend.length) {
            setActiveTrendIndex(0);
            return;
        }
        setActiveTrendIndex(trend.length - 1);
    }, [trend.length]);

    const bestTrendDay = useMemo(() => {
        if (!trend.length) return null;
        return [...trend].sort((a, b) => b.attendance_rate - a.attendance_rate || b.present_count - a.present_count)[0] ?? null;
    }, [trend]);

    const weakTrendDay = useMemo(() => {
        if (!trend.length) return null;
        return [...trend].sort((a, b) => a.attendance_rate - b.attendance_rate || b.absent_count - a.absent_count)[0] ?? null;
    }, [trend]);

    const departmentRanking = useMemo(() => {
        return [...departments].sort(
            (a, b) => b.attendance_rate - a.attendance_rate || b.present_count - a.present_count || a.late_count - b.late_count
        );
    }, [departments]);

    const bestDepartment = departmentRanking[0] ?? null;
    const riskDepartment = useMemo(() => {
        if (!departments.length) return null;
        return [...departments].sort((a, b) => departmentRiskScore(b) - departmentRiskScore(a))[0] ?? null;
    }, [departments]);

    const dashboardAlerts = useMemo<DashboardAlert[]>(() => {
        const items: DashboardAlert[] = [];

        if (today) {
            if (today.attendance_rate < 85) {
                items.push({
                    key: "attendance-low",
                    title: "Hiện diện thấp",
                    sub: `${today.attendance_rate}% có mặt, vắng ${today.absent_count} người`,
                    tone: "danger",
                    icon: <WarningOutlined/>
                });
            } else if (today.attendance_rate >= 95) {
                items.push({
                    key: "attendance-good",
                    title: "Tình hình ổn định",
                    sub: `${today.attendance_rate}% có mặt trong hôm nay`,
                    tone: "good",
                    icon: <CheckCircleOutlined/>
                });
            }

            if (today.late_count > 0) {
                items.push({
                    key: "late-users",
                    title: "Có nhân sự đi muộn",
                    sub: `${today.late_count} người đi muộn, chiếm ${lateRate}%`,
                    tone: "warn",
                    icon: <ClockCircleOutlined/>
                });
            }
        }

        if ((leaveSummary?.pending_count ?? 0) > 0) {
            items.push({
                key: "leave-pending",
                title: "Đơn nghỉ cần duyệt",
                sub: `${leaveSummary?.pending_count ?? 0} đơn đang chờ xử lý`,
                tone: "info",
                icon: <AuditOutlined/>
            });
        }

        if (riskDepartment && (riskDepartment.absent_count > 0 || riskDepartment.late_count > 0)) {
            items.push({
                key: "dept-risk",
                title: "Phòng ban cần chú ý",
                sub: `${riskDepartment.department_name} • ${riskDepartment.attendance_rate}% hiện diện`,
                tone: "warn",
                icon: <ApartmentOutlined/>
            });
        }

        if (trendDelta != null && trendDelta < 0) {
            items.push({
                key: "trend-down",
                title: "Xu hướng đang giảm",
                sub: `${trendDelta}% so với ${previousTrend?.label ?? "hôm trước"}`,
                tone: "danger",
                icon: <ArrowDownOutlined/>
            });
        }

        if (!items.length) {
            items.push({
                key: "all-good",
                title: "Không có điểm nóng lớn",
                sub: "Chưa thấy tín hiệu bất thường từ dashboard hôm nay",
                tone: "good",
                icon: <InfoCircleOutlined/>
            });
        }

        return items.slice(0, 4);
    }, [lateRate, leaveSummary?.pending_count, previousTrend?.label, riskDepartment, today, trendDelta]);

    const statCards = [
        {
            key: "present",
            label: "Có mặt",
            value: today?.present_count ?? 0,
            icon: <CheckCircleOutlined/>,
            foot: `${presentRate}% tổng nhân sự`,
            tone: "green",
            waiting: todayWaiting,
            error: todayState.error
        },
        {
            key: "absent",
            label: "Vắng mặt",
            value: today?.absent_count ?? 0,
            icon: <ExclamationCircleOutlined/>,
            foot: `${absentRate}% tổng nhân sự`,
            tone: "rose",
            waiting: todayWaiting,
            error: todayState.error
        },
        {
            key: "late",
            label: "Đi muộn",
            value: today?.late_count ?? 0,
            icon: <ClockCircleOutlined/>,
            foot: `${lateRate}% nhân sự hôm nay`,
            tone: "amber",
            waiting: todayWaiting,
            error: todayState.error
        },
        {
            key: "working",
            label: "Đang làm",
            value: today?.working_count ?? 0,
            icon: <FieldTimeOutlined/>,
            foot: `${today?.checked_out_count ?? 0} đã ra ca`,
            tone: "blue",
            waiting: todayWaiting,
            error: todayState.error
        },
        {
            key: "pending",
            label: "Chờ duyệt phép",
            value: leaveSummary?.pending_count ?? 0,
            icon: <AuditOutlined/>,
            foot: `${leaveSummary?.approved_count ?? 0} đã duyệt`,
            tone: "violet",
            waiting: leaveSummaryWaiting,
            error: leaveSummaryState.error
        },
    ] as const;

    const workHoursInputType = workHoursPeriod === "week" ? "week" : workHoursPeriod === "month" ? "month" : "number";
    const workHoursInputLabel = workHoursPeriod === "week" ? "Chọn tuần" : workHoursPeriod === "month" ? "Chọn tháng" : "Chọn năm";

    function moveTrendFocus(direction: number) {
        if (!trend.length || direction === 0) return;
        setActiveTrendIndex((current) => clamp(current + direction, 0, trend.length - 1));
    }

    const pageClassName = shouldAnimatePage ? `${styles.page} ${styles.pageAnimated}` : styles.page;

    return (
        <div className={pageClassName}>

            <section className={styles.heroGrid}>
            </section>

            <section className={styles.statsGrid}>
                {statCards.map((item) => (
                    <article key={item.key} className={styles.statCard}>
                        <div className={styles.statTop}>
                            <div className={styles.statLabel}>{item.label}</div>
                            <div className={styles.statIcon}>{item.icon}</div>
                        </div>
                        {item.waiting ? (
                            <>
                                <div className={styles.statValue}><span
                                    className={`${styles.skeletonLine} ${styles.statValueSkeleton}`}/></div>
                                <div className={styles.statFoot}><span
                                    className={`${styles.skeletonLine} ${styles.statFootSkeleton}`}/></div>
                            </>
                        ) : item.error ? (
                            <>
                                <div className={styles.statValue}>!</div>
                                <div className={styles.statFoot}>{item.error}</div>
                            </>
                        ) : (
                            <>
                                <div className={styles.statValue}>{item.value}</div>
                                <div className={styles.statFoot}>{item.foot}</div>
                            </>
                        )}
                    </article>
                ))}
            </section>

            <section className={styles.analyticsGrid}>
                <div className={styles.chartGridItem}>
                    <Card
                        title={
                            <span className={styles.sectionTitle}>
                <BarChartOutlined/>
                <span>Xu hướng 7 ngày</span>
              </span>
                        }
                    >
                        {trendWaiting ? <ChartSkeleton/> : trendState.error ?
                            <SectionError message={trendState.error}/> : (
                                <div className={styles.chartLayout}>
                                    <div className={styles.chartPanel}>
                                        {chartGeometry ? (
                                            <>
                                                <div className={styles.chartSummary}>
                                                    <div className={styles.chartHeadline}>
                                                        <div
                                                            className={styles.chartHeadlineValue}>{Math.round(activeTrend?.attendance_rate ?? averageAttendance)}%
                                                        </div>
                                                    </div>

                                                    <div className={styles.chartPills}>
                        <span className={styles.summaryPill}>
                          <CheckCircleOutlined/>
                            {activeTrend?.present_count ?? 0} có mặt
                        </span>
                                                        <span className={styles.summaryPill}>
                          <ExclamationCircleOutlined/>
                                                            {activeTrend?.absent_count ?? 0} vắng
                        </span>
                                                        <span className={styles.summaryPill}>
                          <ClockCircleOutlined/>
                                                            {activeTrend?.late_count ?? 0} muộn
                        </span>
                                                        {activeTrendDelta != null ? (
                                                            <span className={styles.summaryPill}>
                            {activeTrendDelta >= 0 ? <ArrowUpOutlined/> : <ArrowDownOutlined/>}
                                                                {activeTrendDelta > 0 ? "+" : ""}
                                                                {activeTrendDelta}%
                          </span>
                                                        ) : null}
                                                    </div>
                                                </div>

                                                <div
                                                    className={styles.chartCanvas}
                                                    onWheel={(event) => {
                                                        if (!trend.length) return;
                                                        event.preventDefault();
                                                        const direction = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? Math.sign(event.deltaX) : Math.sign(event.deltaY);
                                                        moveTrendFocus(direction);
                                                    }}
                                                >
                                                    <div className={styles.chartYAxis}>
                                                        {chartGeometry.gridValues.map((value, index) => (
                                                            <span key={`${value}-${index}`}>{value}%</span>
                                                        ))}
                                                    </div>

                                                    <svg
                                                        className={styles.chartSvg}
                                                        viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
                                                        role="img"
                                                        aria-label="Biểu đồ hiện diện 7 ngày"
                                                    >
                                                        <defs>
                                                            <linearGradient id="dashboardTrendArea" x1="0" x2="0" y1="0"
                                                                            y2="1">
                                                                <stop offset="0%" stopColor="rgba(14, 165, 233, 0.28)"/>
                                                                <stop offset="100%"
                                                                      stopColor="rgba(14, 165, 233, 0.02)"/>
                                                            </linearGradient>
                                                            <linearGradient id="dashboardTrendLine" x1="0" x2="1" y1="0"
                                                                            y2="0">
                                                                <stop offset="0%" stopColor="#0ea5e9"/>
                                                                <stop offset="100%" stopColor="#22c55e"/>
                                                            </linearGradient>
                                                        </defs>

                                                        {chartGeometry.gridValues.map((value, index) => {
                                                            const y =
                                                                chartGeometry.height -
                                                                chartGeometry.padBottom -
                                                                ((value - chartGeometry.lower) / Math.max(chartGeometry.upper - chartGeometry.lower, 1)) *
                                                                chartGeometry.usableHeight;
                                                            return (
                                                                <line
                                                                    key={`${value}-${index}`}
                                                                    x1={chartGeometry.padLeft}
                                                                    y1={y}
                                                                    x2={chartGeometry.width - chartGeometry.padRight}
                                                                    y2={y}
                                                                    className={styles.chartGridLine}
                                                                />
                                                            );
                                                        })}

                                                        <path d={chartGeometry.areaPath} className={styles.chartArea}/>
                                                        <path d={chartGeometry.linePath} className={styles.chartLine}/>

                                                        {activeTrend ? (
                                                            <line
                                                                x1={chartGeometry.points[activeTrendIndex]?.x ?? chartGeometry.padLeft}
                                                                y1={chartGeometry.padBottom / 2}
                                                                x2={chartGeometry.points[activeTrendIndex]?.x ?? chartGeometry.padLeft}
                                                                y2={chartGeometry.height - chartGeometry.padBottom}
                                                                className={styles.chartFocusLine}
                                                            />
                                                        ) : null}

                                                        {chartGeometry.points.map((point, index) => (
                                                            <g
                                                                key={point.day}
                                                                className={index === activeTrendIndex ? styles.chartPointActive : undefined}
                                                                onMouseEnter={() => setActiveTrendIndex(index)}
                                                                onFocus={() => setActiveTrendIndex(index)}
                                                            >
                                                                {index === activeTrendIndex ?
                                                                    <circle cx={point.x} cy={point.y} r="14"
                                                                            className={styles.chartPointHalo}/> : null}
                                                                <circle cx={point.x} cy={point.y} r="6"
                                                                        className={styles.chartPointOuter}/>
                                                                <circle cx={point.x} cy={point.y} r="3.5"
                                                                        className={styles.chartPointInner}/>
                                                            </g>
                                                        ))}
                                                    </svg>
                                                </div>

                                                <div className={styles.chartAxisRow}>
                                                    {chartGeometry.points.map((point, index) => (
                                                        <button
                                                            key={point.day}
                                                            type="button"
                                                            className={index === activeTrendIndex ? `${styles.chartAxisItem} ${styles.chartAxisItemActive}` : styles.chartAxisItem}
                                                            onMouseEnter={() => setActiveTrendIndex(index)}
                                                            onFocus={() => setActiveTrendIndex(index)}
                                                            onClick={() => setActiveTrendIndex(index)}
                                                        >
                                                            <strong>{point.label}</strong>
                                                            <span>{formatDate(point.day)}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <div className={styles.emptyState}>Chưa có dữ liệu xu hướng để hiển
                                                thị.</div>
                                        )}
                                    </div>
                                </div>
                            )}
                    </Card>
                </div>

                <div className={styles.chartGridItem}>
                    <Card
                        title={
                            <span className={styles.sectionTitle}>
                <TrophyOutlined/>
                <span>Xếp hạng</span>
              </span>
                        }
                        right={
                            <div className={styles.periodControls}>
                                <div className={styles.periodTabs} role="tablist" aria-label="Lọc kỳ thống kê giờ làm">
                                    {([
                                        ["week", "Tuần"],
                                        ["month", "Tháng"],
                                        ["year", "Năm"]
                                    ] as const).map(([period, label]) => (
                                        <button
                                            key={period}
                                            type="button"
                                            className={workHoursPeriod === period ? `${styles.periodTab} ${styles.periodTabActive}` : styles.periodTab}
                                            onClick={() => setWorkHoursPeriod(period)}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <label className={styles.periodInputWrap}>
                                    <CalendarOutlined/>
                                    <span className={styles.srOnly}>{workHoursInputLabel}</span>
                                    <input
                                        className={styles.periodInput}
                                        type={workHoursInputType}
                                        min={workHoursPeriod === "year" ? "2020" : undefined}
                                        max={workHoursPeriod === "year" ? "2100" : undefined}
                                        value={workHoursInputValue(workHoursPeriod, workHoursAnchorDate)}
                                        onChange={(event) => setWorkHoursAnchorDate(anchorDateFromInput(workHoursPeriod, event.target.value))}
                                    />
                                </label>
                            </div>
                        }
                    >
                        {workHoursWaiting ? <WorkHoursSkeleton/> : workHoursState.error ?
                            <SectionError message={workHoursState.error}/> : (
                                <div className={styles.workHoursChart}>
                                    <div className={styles.workHoursSummary}>
                                        <div className={styles.workHoursMetric}>
                                            <span>Tổng giờ</span>
                                            <strong>{formatHours(workHours?.total_work_hours ?? 0)}</strong>
                                        </div>
                                        <div className={styles.workHoursMetric}>
                                            <span>Trung bình</span>
                                            <strong>{formatHours(workHours?.average_work_hours ?? 0)}</strong>
                                        </div>
                                        <div className={styles.workHoursMetric}>
                                            <span>Khoảng thời gian</span>
                                            <strong>{workHoursRangeLabel}</strong>
                                        </div>
                                    </div>

                                    <div className={styles.workHoursList}>
                                        {workHoursEmployees.map((employee) => {
                                            const ratio = clamp((employee.total_work_hours / maxWorkHours) * 100, 4, 100);
                                            return (
                                                <article key={employee.user_id} className={styles.workHoursRow}>
                                                    <div
                                                        className={employee.rank <= 3 ? `${styles.workRank} ${styles.workRankTop}` : styles.workRank}>
                                                        {employee.rank}
                                                    </div>
                                                    <div className={styles.workHoursMain}>
                                                        <div className={styles.workHoursTopLine}>
                                                            <div className={styles.workHoursIdentity}>
                                                                <strong>{employee.user_code + ' - ' + employee.user_name}</strong>
                                                            </div>
                                                            <div
                                                                className={styles.workHoursValue}>{formatHours(employee.total_work_hours)}</div>
                                                        </div>
                                                        <div className={styles.workHoursBarTrack}>
                                                            <span className={styles.workHoursBar}
                                                                  style={{width: `${ratio}%`}}/>
                                                        </div>
                                                        <div className={styles.workHoursMeta}>
                                                            <span>{employee.working_days} ngày công</span>
                                                            <span>{formatHours(employee.average_hours_per_day)}/ngày</span>
                                                            <span>{employee.late_days} đi muộn</span>
                                                        </div>
                                                    </div>
                                                </article>
                                            );
                                        })}

                                        {!workHoursEmployees.length ? (
                                            <div className={styles.emptyState}>Chưa có dữ liệu giờ làm trong kỳ
                                                này.</div>
                                        ) : null}
                                    </div>
                                </div>
                            )}
                    </Card>
                </div>

                <div className={styles.spanFull}>
                    <Card
                        title={
                            <span className={styles.sectionTitle}>
                <ApartmentOutlined/>
                <span>Tình hình theo phòng ban</span>
              </span>
                        }
                        right={departmentsWaiting ? <LoadingBadge/> :
                            <span className={styles.softBadge}>{departments.length} phòng ban</span>}
                    >
                        {departmentsWaiting ? <DepartmentSkeleton/> : departmentsState.error ?
                            <SectionError message={departmentsState.error}/> : (
                                <div className={styles.departmentOverview}>
                                    <div className={styles.calloutGrid}>
                                        <div className={styles.calloutCard}>
                                            <span className={styles.calloutLabel}>Phòng ban nổi bật</span>
                                            <strong
                                                className={styles.calloutValue}>{bestDepartment?.department_name ?? "--"}</strong>
                                            <span
                                                className={styles.calloutSub}>{bestDepartment ? `${bestDepartment.attendance_rate}% hiện diện` : "Chưa có dữ liệu"}</span>
                                        </div>
                                        <div className={styles.calloutCard}>
                                            <span className={styles.calloutLabel}>Phòng ban cần theo dõi</span>
                                            <strong
                                                className={styles.calloutValue}>{riskDepartment?.department_name ?? "--"}</strong>
                                            <span className={styles.calloutSub}>
                    {riskDepartment ? `${riskDepartment.absent_count} vắng • ${riskDepartment.late_count} muộn` : "Chưa có dữ liệu"}
                  </span>
                                        </div>
                                    </div>

                                    <div className={styles.departmentList}>
                                        {departmentRanking.slice(0, 8).map((dept) => (
                                            <article key={`${dept.department_id ?? "none"}-${dept.department_name}`}
                                                     className={styles.departmentRow}>
                                                <div className={styles.departmentHead}>
                                                    <div>
                                                        <strong
                                                            className={styles.departmentName}>{dept.department_name}</strong>
                                                        <div className={styles.departmentMeta}>
                          <span className={styles.metaPill}>
                            <TeamOutlined/>
                              {dept.total_users} người
                          </span>
                                                            <span className={styles.metaPill}>
                            <CheckCircleOutlined/>
                                                                {dept.present_count} có mặt
                          </span>
                                                            <span className={styles.metaPill}>
                            <ClockCircleOutlined/>
                                                                {dept.late_count} muộn
                          </span>
                                                            <span className={styles.metaPill}>
                            <ExclamationCircleOutlined/>
                                                                {dept.absent_count} vắng
                          </span>
                                                        </div>
                                                    </div>
                                                    <span
                                                        className={`${styles.rateBadge} ${
                                                            dept.attendance_rate >= 95 ? styles.rateGood : dept.attendance_rate >= 85 ? styles.rateWarn : styles.rateBad
                                                        }`}
                                                    >
                        {dept.attendance_rate}%
                      </span>
                                                </div>
                                                <div className={styles.progressTrack}>
                                            <span className={styles.progressFill}
                                                  style={{width: `${clamp(dept.attendance_rate, 0, 100)}%`}}/>
                                                </div>
                                            </article>
                                        ))}

                                        {!departmentRanking.length ?
                                            <div className={styles.emptyState}>Chưa có dữ liệu phòng ban để hiển
                                                thị.</div> : null}
                                    </div>
                                </div>
                            )}
                    </Card>
                </div>

                <Card
                    title={
                        <span className={styles.sectionTitle}>
              <AuditOutlined/>
              <span>Hàng đợi nghỉ phép</span>
            </span>
                    }
                    right={leaveSummaryWaiting ? <LoadingBadge/> :
                        <span className={styles.softBadge}>{leaveSummary?.pending_count ?? 0} chờ duyệt</span>}
                >
                    {leaveSummaryWaiting ? (
                        <LeaveSummarySkeleton/>
                    ) : leaveSummaryState.error ? (
                        <SectionError message={leaveSummaryState.error}/>
                    ) : (
                        <div className={styles.leaveSummaryStrip}>
                            <div className={styles.summaryMini}>
                                <span>Chờ duyệt</span>
                                <strong>{leaveSummary?.pending_count ?? 0}</strong>
                            </div>
                            <div className={styles.summaryMini}>
                                <span>Đã duyệt</span>
                                <strong>{leaveSummary?.approved_count ?? 0}</strong>
                            </div>
                            <div className={styles.summaryMini}>
                                <span>Từ chối</span>
                                <strong>{leaveSummary?.rejected_count ?? 0}</strong>
                            </div>
                        </div>
                    )}

                    {pendingLeavesWaiting ? (
                        <QueueSkeleton rows={3}/>
                    ) : pendingLeavesState.error ? (
                        <SectionError message={pendingLeavesState.error}/>
                    ) : (
                        <div className={styles.queueList}>
                            {pendingLeaves.map((item) => (
                                <article key={item.id} className={styles.queueRow}>
                                    <div className={styles.queueAvatar}>{getInitials(item.user_name)}</div>
                                    <div className={styles.queueMain}>
                                        <div className={styles.queueTop}>
                                            <strong>{item.user_name}</strong>
                                            <span className={styles.timeBadge}>{queueAge(item.created_at)}</span>
                                        </div>
                                        <div className={styles.queueSub}>{leaveTypeVi(item.type)}</div>
                                        <div className={styles.queueMeta}>
                    <span className={styles.metaPill}>
                      <CalendarOutlined/>
                        {formatDate(item.start_date)} - {formatDate(item.end_date)}
                    </span>
                                            <span className={styles.metaPill}>
                      <NumberOutlined/>
                                                {item.user_code || "--"}
                    </span>
                                            <span className={styles.metaPill}>
                      <ApartmentOutlined/>
                                                {item.department_name || "Chưa phân phòng ban"}
                    </span>
                                        </div>
                                    </div>
                                </article>
                            ))}

                            {!pendingLeaves.length ?
                                <div className={styles.emptyState}>Không có đơn nghỉ phép đang chờ duyệt.</div> : null}
                        </div>
                    )}
                </Card>

                <Card
                    title={
                        <span className={styles.sectionTitle}>
              <FieldTimeOutlined/>
              <span>Chấm công gần nhất</span>
            </span>
                    }
                    right={recentLogsWaiting ? <LoadingBadge/> :
                        <span className={styles.softBadge}>{recentLogs.length} bản ghi</span>}
                >
                    {recentLogsWaiting ? (
                        <QueueSkeleton rows={4}/>
                    ) : recentLogsState.error ? (
                        <SectionError message={recentLogsState.error}/>
                    ) : (
                        <div className={styles.queueList}>
                            {recentLogs.map((item) => (
                                <article key={item.id} className={styles.queueRow}>
                                    <div className={styles.queueAvatar}>{getInitials(item.user_name)}</div>
                                    <div className={styles.queueMain}>
                                        <div className={styles.queueTop}>
                                            <strong>{item.user_name}</strong>
                                            <span className={styles.timeBadge}>{formatDateTime(item.timestamp)}</span>
                                        </div>
                                        <div className={styles.queueSub}>{attendanceTypeVi(item.type)}</div>
                                        <div className={styles.queueMeta}>
                    <span className={styles.metaPill}>
                      {attendanceIcon(item.type)}
                        {attendanceTypeVi(item.type)}
                    </span>
                                            <span className={styles.metaPill}>
                      <NumberOutlined/>
                                                {item.user_code || "--"}
                    </span>
                                            <span className={styles.metaPill}>
                      <CheckCircleOutlined/>
                                                {item.confidence.toFixed(3)}
                    </span>
                                        </div>
                                    </div>
                                </article>
                            ))}

                            {!recentLogs.length ?
                                <div className={styles.emptyState}>Chưa có log chấm công gần đây.</div> : null}
                        </div>
                    )}
                </Card>
            </section>
        </div>
    );
}

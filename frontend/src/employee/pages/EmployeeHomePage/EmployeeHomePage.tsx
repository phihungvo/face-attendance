import styles from "./EmployeeHomePage.module.scss";
import {Link} from "react-router-dom";
import {useEffect, useMemo, useState} from "react";
import {getMyProfile} from "../../../shared/api/users";
import {listMyTimelog} from "../../../shared/api/attendance";
import {getMyLeaveBalance} from "../../../shared/api/leaves";
import {useTheme} from "../../../shared/theme/theme";
import {useAuth} from "../../../shared/auth/auth";
import {
    acceptCompanyInvitation,
    createCompanyJoinRequest,
    declineCompanyInvitation,
    getMyCompanyMembership
} from "../../../shared/api/companyMembership";
import {
    listMyScheduleRegistrations,
    listSchedules,
    type WorkSchedule,
    type WorkScheduleRegistration
} from "../../../shared/api/schedules";
import {getApiErrorMessage} from "../../../shared/lib/apiClient";
import {
    ArrowRightOutlined,
    CalendarOutlined,
    CameraOutlined,
    ClockCircleOutlined,
    DollarOutlined,
    MedicineBoxOutlined,
    MoonOutlined,
    StopOutlined,
    SunOutlined,
    TeamOutlined,
    WarningOutlined
} from "@ant-design/icons";
import {useCachedQuery} from "../../../shared/hooks/useCachedQuery";
import {empKeys} from "../../cacheKeys";

export default function EmployeeHomePage() {
    const auth = useAuth();
    const {resolvedTheme, toggle} = useTheme();
    const hasCompany = Boolean(auth.companyId);
    const [joinCode, setJoinCode] = useState("");
    const [membershipActionLoading, setMembershipActionLoading] = useState(false);
    const [membershipActionError, setMembershipActionError] = useState<string | null>(null);
    const [today, setToday] = useState<{ checkin: string; checkout: string; worked: string; status: "in" | "idle" }>({
        checkin: "—",
        checkout: "—",
        worked: "—",
        status: "idle"
    });
    const [monthStats, setMonthStats] = useState<{ days: number; late: number; leaveRemaining: number }>({
        days: 0,
        late: 0,
        leaveRemaining: 0
    });
    const [leaveBalance, setLeaveBalance] = useState<{
        annual: { remaining: number; percent: number };
        sick: { remaining: number; percent: number }
    } | null>(null);
    const [recentLogs, setRecentLogs] = useState<Array<{
        id: string;
        day: string;
        dow: string;
        checkin: string;
        checkout: string;
        hours: string;
        status: "ok" | "late"
    }>>([]);
    const [streak, setStreak] = useState<{
        title: string;
        countLabel: string;
        weekSummary: string;
        days: Array<{ label: string; state: "done" | "late" | "today" | "miss" }>;
    }>({title: "Chuỗi chuyên cần", countLabel: "—", weekSummary: "—", days: []});
    const [now, setNow] = useState(() => new Date());
    const [todayShift, setTodayShift] = useState<{ name: string; start: string; end: string } | null>(null);
    const [todayShiftErr, setTodayShiftErr] = useState<string | null>(null);
    const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const monthKey = useMemo(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }, []);

    const qMe = useCachedQuery({
        key: empKeys.meProfile(),
        ttlMs: 5 * 60_000,
        fetcher: getMyProfile
    });
    const me = qMe.data;

    const qMembership = useCachedQuery({
        key: empKeys.companyMembership(),
        ttlMs: 30_000,
        fetcher: getMyCompanyMembership
    });
    const membership = qMembership.data;

    const qSchedules = useCachedQuery({
        key: empKeys.schedules("active-summary"),
        ttlMs: 5 * 60_000,
        fetcher: () => listSchedules({status: "active", limit: 200, offset: 0}),
        enabled: hasCompany
    });
    const schedules = qSchedules.data ?? [];

    const qRegs = useCachedQuery({
        key: empKeys.myScheduleRegs("today", todayKey),
        ttlMs: 30_000,
        fetcher: () => {
            const today = new Date().toISOString().slice(0, 10);
            return listMyScheduleRegistrations({from_date: today, to_date: today, limit: 20, offset: 0});
        },
        enabled: hasCompany
    });
    const regs = qRegs.data ?? [];

    const qLeaveBalance = useCachedQuery({
        key: empKeys.myLeaveBalance(null),
        ttlMs: 2 * 60_000,
        fetcher: () => getMyLeaveBalance(),
        enabled: hasCompany
    });

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const qMonth = useCachedQuery({
        key: empKeys.myTimelogMonth(monthKey),
        ttlMs: 60_000,
        fetcher: async () => {
            const d = new Date();
            const from = `${monthKey}-01`;
            const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            const to = `${monthKey}-${String(lastDay).padStart(2, "0")}`;
            return listMyTimelog({from_date: from, to_date: to});
        },
        enabled: hasCompany
    });

    useEffect(() => {
        // `me` is cached via `useCachedQuery`.
    }, []);

    useEffect(() => {
        const rows: any[] | null = (qMonth.data as any) ?? null;
        if (!rows) return;

        const todayRow = rows.find((r) => r.date === todayKey);
        const fmtTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit"
        }) : "—");
        const minutes = (r: any) => (typeof r.working_minutes === "number" ? r.working_minutes : Math.round((r.work_hours ?? 0) * 60));
        const workedMin = todayRow ? minutes(todayRow) : 0;
        const workedLabel = todayRow && !todayRow.absent ? `${Math.floor(workedMin / 60)}:${String(workedMin % 60).padStart(2, "0")}` : "—";
        setToday({
            checkin: todayRow?.checkin_time ? fmtTime(todayRow.checkin_time) : "—",
            checkout: todayRow?.checkout_time ? fmtTime(todayRow.checkout_time) : "—",
            worked: workedLabel,
            status: todayRow?.checkin_time && !todayRow?.checkout_time ? "in" : "idle"
        });

        const days = rows.filter((r) => !r.absent).length;
        const late = rows.filter((r) => !!r.late).length;
        setMonthStats((s) => ({...s, days, late}));

        const rec = rows
            .slice()
            .filter((r) => !r.absent)
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .slice(0, 5)
            .map((r) => {
                const dt = new Date(`${r.date}T00:00:00`);
                const checkin = r.checkin_time ? fmtTime(r.checkin_time) : "—";
                const checkout = r.checkout_time ? fmtTime(r.checkout_time) : "—";
                const mins = minutes(r);
                const hrs = `${Math.round((mins / 60) * 10) / 10}`;
                return {
                    id: r.date,
                    day: String(dt.getDate()),
                    dow: dt.toLocaleDateString("vi-VN", {weekday: "short"}),
                    checkin,
                    checkout,
                    hours: hrs,
                    status: r.late ? ("late" as const) : ("ok" as const)
                };
            });
        setRecentLogs(rec);

        const last7: Array<{ label: string; state: "done" | "late" | "today" | "miss" }> = [];
        let doneCount = 0;
        for (let i = 6; i >= 0; i--) {
            const x = new Date();
            x.setDate(x.getDate() - i);
            const key = x.toISOString().slice(0, 10);
            const r = rows.find((z) => z.date === key);
            const label = x.toLocaleDateString("vi-VN", {weekday: "short"}).replace(".", "");
            if (i === 0) {
                last7.push({label, state: "today"});
            } else if (!r || r.absent) {
                last7.push({label, state: "miss"});
            } else if (r.late) {
                last7.push({label, state: "late"});
                doneCount++;
            } else {
                last7.push({label, state: "done"});
                doneCount++;
            }
        }
        setStreak({
            title: "Chuỗi chuyên cần",
            countLabel: `${doneCount}/7`,
            weekSummary: `${days} ngày công • ${late} lần muộn`,
            days: last7
        });
    }, [qMonth.data, todayKey]);

    useEffect(() => {
        setTodayShiftErr(null);
        if (qSchedules.error) setTodayShiftErr(qSchedules.error);
        if (qRegs.error) setTodayShiftErr(qRegs.error);

        if (!schedules.length || !regs.length) {
            setTodayShift(null);
            return;
        }
        const byId = new Map<number, WorkSchedule>(schedules.map((s: any) => [s.id, s]));
        const todayRegs = (regs as any as WorkScheduleRegistration[])
            .filter((r) => String(r.day).slice(0, 10) === todayKey)
            .sort((a, b) => (a.status === b.status ? b.id - a.id : a.status === "approved" ? -1 : 1));
        const pick = todayRegs[0];
        const s = pick ? byId.get(pick.schedule_id) : null;
        if (s && (s as any).shift_start && (s as any).shift_end) setTodayShift({
            name: (s as any).name,
            start: (s as any).shift_start,
            end: (s as any).shift_end
        });
        else setTodayShift(null);
    }, [qSchedules.error, qRegs.error, regs, schedules, todayKey]);

    const hhmmToMinutes = (hhmm: string) => {
        const [h, m] = hhmm.split(":");
        return Number(h) * 60 + Number(m);
    };

    const nowMinutes = useMemo(() => now.getHours() * 60 + now.getMinutes(), [now]);
    const shiftStartMin = useMemo(() => (todayShift?.start ? hhmmToMinutes(todayShift.start) : null), [todayShift]);
    const shiftEndMin = useMemo(() => (todayShift?.end ? hhmmToMinutes(todayShift.end) : null), [todayShift]);

    const canCheckinNow = useMemo(() => {
        if (today.status === "in") return false;
        if (shiftStartMin == null || shiftEndMin == null) return true;
        // Allow early check-in up to 120 minutes before shift start, and until shift end + 60 minutes.
        return nowMinutes >= shiftStartMin - 120 && nowMinutes <= shiftEndMin + 60;
    }, [today.status, shiftStartMin, shiftEndMin, nowMinutes]);

    const canCheckoutNow = useMemo(() => {
        if (today.status !== "in") return false;
        if (shiftStartMin == null || shiftEndMin == null) return true;
        // Allow checkout from 60 minutes after shift start (avoid accidental immediate checkout).
        return nowMinutes >= shiftStartMin + 60;
    }, [today.status, shiftStartMin, shiftEndMin, nowMinutes]);

    const primaryAttendanceAction = useMemo(() => {
        if (today.status === "in") {
            return {
                action: "checkout" as const,
                label: "Ra ca",
                hint: todayShift ? `Ca: ${todayShift.start}–${todayShift.end}` : "Ra ca",
                disabled: !canCheckoutNow
            };
        }
        return {
            action: "checkin" as const,
            label: "Vào ca",
            hint: todayShift ? `Ca: ${todayShift.start}–${todayShift.end}` : "Vào ca",
            disabled: !canCheckinNow
        };
    }, [today.status, todayShift, canCheckoutNow, canCheckinNow]);

    useEffect(() => {
        const b = qLeaveBalance.data ?? null;
        if (!b) return;
        const annual = b.items.find((x) => x.type === "annual");
        const sick = b.items.find((x) => x.type === "sick");
        if (annual && sick) {
            setLeaveBalance({
                annual: {
                    remaining: annual.remaining_days,
                    percent: Math.round((annual.remaining_days / Math.max(1, annual.allowance_days)) * 100)
                },
                sick: {
                    remaining: sick.remaining_days,
                    percent: Math.round((sick.remaining_days / Math.max(1, sick.allowance_days)) * 100)
                }
            });
            setMonthStats((s) => ({...s, leaveRemaining: annual.remaining_days}));
        }
    }, [qLeaveBalance.data]);

    const clock = useMemo(() => {
        const h = String(now.getHours()).padStart(2, "0");
        const m = String(now.getMinutes()).padStart(2, "0");
        return `${h}:${m}`;
    }, [now]);

    const dateLabel = useMemo(() => {
        const days = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
        return `${days[now.getDay()]}, ${now.getDate()}/${now.getMonth() + 1}`;
    }, [now]);

    const greetingSub = useMemo(() => {
        const days = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
        return `${days[now.getDay()]}, ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
    }, [now]);

    const initials = (me?.name || "ME")
        .split(" ")
        .filter(Boolean)
        .slice(-2)
        .map((s) => s[0]?.toUpperCase() ?? "")
        .join("");
    async function refreshMembershipAfterAction() {
        qMembership.refresh();
        qMe.refresh();
        await auth.refreshMe().catch(() => undefined);
    }

    if (!hasCompany) {
        const invitations = membership?.invitations ?? [];
        const pendingRequest = membership?.pending_request ?? null;
        return (
            <div className={styles.page}>
                <div className={styles.mainHeader}>
                    <div className={styles.headerTop}>
                        <div className={styles.greetingWrap}>
                            <div className={styles.greetingName}>Xin chào, {(me?.name || "Bạn").split(" ").slice(-1)[0]}!</div>
                            <div className={styles.greetingSub}>Bạn chưa tham gia công ty nào</div>
                        </div>
                        <div className={styles.headerActions}>
                            <button className={styles.themeBtn} type="button" onClick={toggle} aria-label="Đổi giao diện sáng/tối" title="Đổi giao diện">
                                {resolvedTheme === "dark" ? <MoonOutlined/> : <SunOutlined/>}
                            </button>
                            <Link to="/employee/profile" className={styles.headerAvatar} aria-label="Hồ sơ">
                                {initials || "ME"}
                            </Link>
                        </div>
                    </div>
                </div>

                <div className={styles.membershipPanel}>
                    {membershipActionError ? <div className={styles.membershipError}>{membershipActionError}</div> : null}

                    {invitations.length > 0 ? (
                        <div className={styles.membershipCard}>
                            <div className={styles.membershipCardHead}>
                                <TeamOutlined/>
                                <div>
                                    <div className={styles.membershipTitle}>Lời mời tham gia</div>
                                    <div className={styles.membershipSub}>Bạn có {invitations.length} lời mời đang chờ phản hồi</div>
                                </div>
                            </div>
                            {invitations.map((invitation) => (
                                <div key={invitation.id} className={styles.membershipItem}>
                                    <div>
                                        <div className={styles.membershipCompany}>{invitation.company?.name ?? `Công ty #${invitation.company_id}`}</div>
                                        <div className={styles.membershipCode}>{invitation.company?.code ?? "—"}</div>
                                    </div>
                                    <div className={styles.membershipActions}>
                                        <button
                                            className={styles.membershipPrimary}
                                            type="button"
                                            disabled={membershipActionLoading}
                                            onClick={async () => {
                                                try {
                                                    setMembershipActionLoading(true);
                                                    setMembershipActionError(null);
                                                    await acceptCompanyInvitation(invitation.id);
                                                    await refreshMembershipAfterAction();
                                                } catch (e) {
                                                    setMembershipActionError(getApiErrorMessage(e));
                                                } finally {
                                                    setMembershipActionLoading(false);
                                                }
                                            }}
                                        >
                                            Chấp nhận
                                        </button>
                                        <button
                                            className={styles.membershipGhost}
                                            type="button"
                                            disabled={membershipActionLoading}
                                            onClick={async () => {
                                                try {
                                                    setMembershipActionLoading(true);
                                                    setMembershipActionError(null);
                                                    await declineCompanyInvitation(invitation.id);
                                                    qMembership.refresh();
                                                } catch (e) {
                                                    setMembershipActionError(getApiErrorMessage(e));
                                                } finally {
                                                    setMembershipActionLoading(false);
                                                }
                                            }}
                                        >
                                            Từ chối
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {pendingRequest ? (
                        <div className={styles.membershipCard}>
                            <div className={styles.membershipCardHead}>
                                <ClockCircleOutlined/>
                                <div>
                                    <div className={styles.membershipTitle}>Yêu cầu tham gia</div>
                                    <div className={styles.membershipSub}>Trạng thái: Đang chờ duyệt</div>
                                </div>
                            </div>
                            <div className={styles.membershipItem}>
                                <div>
                                    <div className={styles.membershipCompany}>{pendingRequest.company?.name ?? `Công ty #${pendingRequest.company_id}`}</div>
                                    <div className={styles.membershipCode}>{pendingRequest.company?.code ?? "—"}</div>
                                </div>
                                <span className={styles.membershipPending}>PENDING</span>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.membershipCard}>
                            <div className={styles.membershipCardHead}>
                                <TeamOutlined/>
                                <div>
                                    <div className={styles.membershipTitle}>Tham gia công ty</div>
                                    <div className={styles.membershipSub}>Nhập mã công ty để gửi yêu cầu cho quản lý duyệt</div>
                                </div>
                            </div>
                            <div className={styles.joinForm}>
                                <input
                                    className={styles.joinInput}
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                    placeholder="Mã công ty"
                                />
                                <button
                                    className={styles.membershipPrimary}
                                    type="button"
                                    disabled={membershipActionLoading || !joinCode.trim()}
                                    onClick={async () => {
                                        try {
                                            setMembershipActionLoading(true);
                                            setMembershipActionError(null);
                                            await createCompanyJoinRequest(joinCode.trim());
                                            setJoinCode("");
                                            qMembership.refresh();
                                        } catch (e) {
                                            setMembershipActionError(getApiErrorMessage(e));
                                        } finally {
                                            setMembershipActionLoading(false);
                                        }
                                    }}
                                >
                                    {membershipActionLoading ? "Đang gửi..." : "Tham gia công ty"}
                                </button>
                            </div>
                        </div>
                    )}

                    {!me?.email ? (
                        <div className={styles.membershipHint}>
                            Cập nhật email trong hồ sơ để nhận lời mời từ quản lý.
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.mainHeader}>
                <div className={`${styles.headerOrb} ${styles.ho1}`}/>
                <div className={`${styles.headerOrb} ${styles.ho2}`}/>
                <div className={styles.headerTop}>
                    <div className={styles.greetingWrap}>
                        <div className={styles.greetingName}>Xin chào, {(me?.name || "Bạn").split(" ").slice(-1)[0]}!
                        </div>
                        <div className={styles.greetingSub}>{greetingSub}</div>
                    </div>
                    <div className={styles.headerActions}>
                        <button className={styles.themeBtn} type="button" onClick={toggle}
                                aria-label="Đổi giao diện sáng/tối" title="Đổi giao diện">
                            {resolvedTheme === "dark" ? <MoonOutlined/> : <SunOutlined/>}
                        </button>
                        <Link to="/employee/profile" className={styles.headerAvatar} aria-label="Hồ sơ">
                            {initials || "ME"}
                        </Link>
                    </div>
                </div>
            </div>

            <div className={styles.checkinFloat}>
                <div className={styles.checkinFloatTop}>
                    <div>
                        <div className={styles.checkinFloatLabel}>Giờ hiện tại</div>
                        <div className={styles.checkinFloatTime}>{clock}</div>
                        <div className={styles.checkinFloatDate}>{dateLabel}</div>
                    </div>
                    <div
                        className={`${styles.statusChip} ${today.status === "in" ? styles.statusIn : styles.statusIdle}`}>
                        {today.status === "in" ? "Đang làm việc" : "Chưa vào ca"}
                    </div>
                </div>

                <div className={styles.checkinTimes}>
                    <div className={styles.timeBlock}>
                        <div className={styles.timeBlockLabel}>Vào ca</div>
                        <div className={`${styles.timeBlockVal} ${styles.green}`}>{today.checkin}</div>
                        <div className={styles.timeBlockSub}>Đúng giờ ✓</div>
                    </div>
                    <div className={styles.timeBlock}>
                        <div className={styles.timeBlockLabel}>Ra ca</div>
                        <div className={`${styles.timeBlockVal} ${styles.gray}`}>{today.checkout}</div>
                        <div className={styles.timeBlockSub}>Chưa kết thúc</div>
                    </div>
                    <div className={styles.timeBlock}>
                        <div className={styles.timeBlockLabel}>Đã làm</div>
                        <div className={styles.timeBlockVal} style={{color: "var(--indigo)"}}>
                            {today.worked}
                        </div>
                        <div className={styles.timeBlockSub}>Hôm nay</div>
                    </div>
                </div>

                <div className={styles.checkinBtnRow}>
                    <Link
                        to="/employee/checkin"
                        className={`${styles.btnCi} ${styles.btnOut} ${primaryAttendanceAction.disabled ? styles.btnDisabled : ""}`}
                        aria-disabled={primaryAttendanceAction.disabled}
                        onClick={(e) => {
                            if (primaryAttendanceAction.disabled) e.preventDefault();
                        }}
                        title={primaryAttendanceAction.hint}
                    >
                        {primaryAttendanceAction.action === "checkout" ? <StopOutlined/> :
                            <CameraOutlined/>} {primaryAttendanceAction.label}
                    </Link>
                    <Link
                        to="/employee/schedules?tab=calendar"
                        className={`${styles.btnCi} ${styles.btnBreak}`}
                        title="Xem lịch đăng ký ca"
                    >
                        <CalendarOutlined/> Lịch của tôi
                    </Link>
                </div>
                {todayShift ? <div className={styles.shiftHint}>Hôm nay: <span
                    className={styles.mono}>{todayShift.start}–{todayShift.end}</span> • {todayShift.name}</div> : null}
                {todayShiftErr ? (
                    <div className={styles.shiftHint} style={{color: "var(--rose)"}}>
                        <WarningOutlined/> {todayShiftErr}
                    </div>
                ) : null}
            </div>

            <div className={styles.scrollArea}>
                <div className={styles.sectionHead} style={{marginTop: 24}}>
                    <div className={styles.sectionTitle}>Tháng này</div>
                    <Link to="/employee/timesheet" className={styles.sectionLink}>
                        Xem chi tiết <ArrowRightOutlined/>
                    </Link>
                </div>

                <div className={styles.statsRow}>
                    <div className={styles.statPill}>
                        <div className={styles.statPillIcon}>
                            <CalendarOutlined/>
                        </div>
                        <div className={styles.statPillVal} style={{color: "var(--indigo)"}}>{monthStats.days}</div>
                        <div className={styles.statPillLbl}>Ngày công</div>
                    </div>
                    <div className={styles.statPill}>
                        <div className={styles.statPillIcon}>
                            <ClockCircleOutlined/>
                        </div>
                        <div className={styles.statPillVal} style={{color: "var(--amber)"}}>{monthStats.late}</div>
                        <div className={styles.statPillLbl}>Muộn</div>
                    </div>
                    <div className={styles.statPill}>
                        <div className={styles.statPillIcon}>
                            <CalendarOutlined/>
                        </div>
                        <div className={styles.statPillVal}
                             style={{color: "var(--green)"}}>{monthStats.leaveRemaining}</div>
                        <div className={styles.statPillLbl}>Phép còn</div>
                    </div>
                </div>

                <div className={styles.streakCard}>
                    <div className={styles.streakTop}>
                        <div>
                            <div className={styles.streakLabel}>{streak.title}</div>
                            <div className={styles.streakCount}>{streak.countLabel}</div>
                        </div>
                        <div style={{textAlign: "right"}}>
                            <div style={{fontSize: 13, color: "rgba(255,255,255,0.6)"}}>Tuần này</div>
                            <div style={{
                                fontSize: 15,
                                fontWeight: 800,
                                color: "#fff",
                                marginTop: 3
                            }}>{streak.weekSummary}</div>
                        </div>
                    </div>

                    <div className={styles.streakDays}>
                        {streak.days.map((d) => {
                            const dotClass =
                                d.state === "done"
                                    ? styles.streakDotDone
                                    : d.state === "late"
                                        ? styles.streakDotLate
                                        : d.state === "today"
                                            ? styles.streakDotToday
                                            : styles.streakDotMiss;
                            const dotText = d.state === "done" ? "✓" : d.state === "today" ? "•" : "-";
                            return (
                                <div key={d.label} className={styles.streakDay}>
                                    <div className={styles.streakDayLabel}>{d.label}</div>
                                    <div className={`${styles.streakDot} ${dotClass}`}>{dotText}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className={styles.sectionHead}>
                    <div className={styles.sectionTitle}>Thao tác nhanh</div>
                </div>
                <div className={styles.actionsGrid}>
                    <Link to="/employee/leave" className={styles.actionBtn}>
                        <div className={styles.actionBtnIcon} style={{background: "#FDE8ED"}}>
                            <CalendarOutlined/>
                        </div>
                        <div className={styles.actionBtnLbl}>Xin nghỉ phép</div>
                    </Link>
                    <button type="button" className={styles.actionBtn}>
                        <div className={styles.actionBtnIcon} style={{background: "var(--amber-light)"}}>
                            <ClockCircleOutlined/>
                        </div>
                        <div className={styles.actionBtnLbl}>Đăng ký tăng ca</div>
                    </button>
                    <button type="button" className={styles.actionBtn}>
                        <div className={styles.actionBtnIcon} style={{background: "var(--green-light)"}}>
                            <DollarOutlined/>
                        </div>
                        <div className={styles.actionBtnLbl}>Xem lương</div>
                    </button>
                    <Link to="/employee/checkin" className={styles.actionBtn}>
                        <div className={styles.actionBtnIcon} style={{background: "var(--indigo-light)"}}>
                            <CameraOutlined/>
                        </div>
                        <div className={styles.actionBtnLbl}>Chấm công nhanh</div>
                    </Link>
                </div>

                <div className={styles.sectionHead}>
                    <div className={styles.sectionTitle}>Ngày phép</div>
                    <Link to="/employee/leave" className={styles.sectionLink}>
                        Xin nghỉ <ArrowRightOutlined/>
                    </Link>
                </div>
                <div className={styles.leaveRow}>
                    <div className={styles.leavePill}>
                        <div className={styles.leavePillIcon}>
                            <CalendarOutlined/>
                        </div>
                        <div className={styles.leavePillVal} style={{color: "var(--indigo)"}}>
                            {leaveBalance?.annual.remaining ?? 0}
                        </div>
                        <div className={styles.leavePillLbl}>Phép năm còn lại</div>
                        <div className={styles.leaveBar}>
                            <div className={styles.leaveFill}
                                 style={{width: `${leaveBalance?.annual.percent ?? 0}%`, background: "var(--indigo)"}}/>
                        </div>
                    </div>
                    <div className={styles.leavePill}>
                        <div className={styles.leavePillIcon}>
                            <MedicineBoxOutlined/>
                        </div>
                        <div className={styles.leavePillVal} style={{color: "var(--rose)"}}>
                            {leaveBalance?.sick.remaining ?? 0}
                        </div>
                        <div className={styles.leavePillLbl}>Phép ốm còn lại</div>
                        <div className={styles.leaveBar}>
                            <div className={styles.leaveFill}
                                 style={{width: `${leaveBalance?.sick.percent ?? 0}%`, background: "var(--rose)"}}/>
                        </div>
                    </div>
                </div>

                <div className={styles.sectionHead}>
                    <div className={styles.sectionTitle}>Gần đây</div>
                    <Link to="/employee/timesheet" className={styles.sectionLink}>
                        Tất cả <ArrowRightOutlined/>
                    </Link>
                </div>

                {recentLogs.map((l) => {
                    const isLate = l.status === "late";
                    return (
                        <div key={l.id} className={styles.logItem}>
                            <div
                                className={`${styles.logDateBox} ${isLate ? styles.logDateBoxAmber : styles.logDateBoxGreen}`}>
                                <div className={styles.logDay}
                                     style={{color: isLate ? "var(--amber)" : "var(--green)"}}>
                                    {l.day}
                                </div>
                                <div className={styles.logDow}>{l.dow}</div>
                            </div>
                            <div className={styles.logInfo}>
                                <div className={styles.logTitle}>
                                    {isLate ? "Đi trễ" : "Có mặt"} • {l.hours}h
                                </div>
                                <div className={styles.logSub}>
                                    Vào {l.checkin} · Ra {l.checkout}
                                </div>
                            </div>
                        </div>
                    );
                })}

                <div className={styles.pad16}/>
            </div>
        </div>
    );
}

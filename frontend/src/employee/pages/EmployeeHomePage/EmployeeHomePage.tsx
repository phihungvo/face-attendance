import styles from "./EmployeeHomePage.module.scss";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getMyProfile } from "../../../shared/api/users";
import { listMyTimelog } from "../../../shared/api/attendance";
import { getMyLeaveBalance } from "../../../shared/api/leaves";
import { useTheme } from "../../../shared/theme/theme";
import { listMyScheduleRegistrations, listSchedules, type WorkSchedule, type WorkScheduleRegistration } from "../../../shared/api/schedules";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";

export default function EmployeeHomePage() {
  const { resolvedTheme, toggle } = useTheme();
  const [me, setMe] = useState<{ name: string; code?: string | null; department_name?: string | null } | null>(null);
  const [today, setToday] = useState<{ checkin: string; checkout: string; worked: string; status: "in" | "idle" }>({
    checkin: "—",
    checkout: "—",
    worked: "—",
    status: "idle"
  });
  const [monthStats, setMonthStats] = useState<{ days: number; late: number; leaveRemaining: number }>({ days: 0, late: 0, leaveRemaining: 0 });
  const [leaveBalance, setLeaveBalance] = useState<{ annual: { remaining: number; percent: number }; sick: { remaining: number; percent: number } } | null>(null);
  const [recentLogs, setRecentLogs] = useState<Array<{ id: string; day: string; dow: string; checkin: string; checkout: string; hours: string; status: "ok" | "late" }>>([]);
  const [streak, setStreak] = useState<{
    title: string;
    countLabel: string;
    weekSummary: string;
    days: Array<{ label: string; state: "done" | "late" | "today" | "miss" }>;
  }>({ title: "Chuỗi chuyên cần", countLabel: "—", weekSummary: "—", days: [] });
  const [now, setNow] = useState(() => new Date());
  const [todayShift, setTodayShift] = useState<{ name: string; start: string; end: string } | null>(null);
  const [todayShiftErr, setTodayShiftErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    (async () => {
      try {
        const prof = await getMyProfile();
        setMe(prof);
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const d = new Date();
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const from = `${ym}-01`;
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const to = `${ym}-${String(lastDay).padStart(2, "0")}`;
        const rows: any[] = await listMyTimelog({ from_date: from, to_date: to });

        const todayRow = rows.find((r) => r.date === todayKey);
        const fmtTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—");
        const minutes = (r: any) => (typeof r.working_minutes === "number" ? r.working_minutes : Math.round((r.work_hours ?? 0) * 60));
        const workedMin = todayRow ? minutes(todayRow) : 0;
        const workedLabel = todayRow && !todayRow.absent ? `${Math.floor(workedMin / 60)}h ${String(workedMin % 60).padStart(2, "0")}m` : "—";
        setToday({
          checkin: todayRow?.checkin_time ? fmtTime(todayRow.checkin_time) : "—",
          checkout: todayRow?.checkout_time ? fmtTime(todayRow.checkout_time) : "—",
          worked: workedLabel,
          status: todayRow?.checkin_time && !todayRow?.checkout_time ? "in" : "idle"
        });

        const days = rows.filter((r) => !r.absent).length;
        const late = rows.filter((r) => !!r.late).length;
        setMonthStats((s) => ({ ...s, days, late }));

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
              dow: dt.toLocaleDateString("vi-VN", { weekday: "short" }),
              checkin,
              checkout,
              hours: hrs,
              status: r.late ? ("late" as const) : ("ok" as const)
            };
          });
        setRecentLogs(rec);

        // streak: last 7 days
        const last7: Array<{ label: string; state: "done" | "late" | "today" | "miss" }> = [];
        let doneCount = 0;
        for (let i = 6; i >= 0; i--) {
          const x = new Date();
          x.setDate(x.getDate() - i);
          const key = x.toISOString().slice(0, 10);
          const r = rows.find((z) => z.date === key);
          const label = x.toLocaleDateString("vi-VN", { weekday: "short" }).replace(".", "");
          if (i === 0) {
            last7.push({ label, state: r && !r.absent ? "today" : "today" });
          } else if (!r || r.absent) {
            last7.push({ label, state: "miss" });
          } else if (r.late) {
            last7.push({ label, state: "late" });
            doneCount++;
          } else {
            last7.push({ label, state: "done" });
            doneCount++;
          }
        }
        setStreak({
          title: "Chuỗi chuyên cần",
          countLabel: `${doneCount}/7`,
          weekSummary: `${days} ngày công • ${late} lần muộn`,
          days: last7
        });
      } catch {
        // ignore
      }
    })();
  }, [todayKey]);

  useEffect(() => {
    (async () => {
      setTodayShiftErr(null);
      try {
        const [sch, regs] = await Promise.all([
          listSchedules({ limit: 500, offset: 0, status: "active" }),
          listMyScheduleRegistrations({ limit: 200, offset: 0 })
        ]);
        const byId = new Map<number, WorkSchedule>(sch.map((s) => [s.id, s]));
        const todayRegs = (regs as WorkScheduleRegistration[])
          .filter((r) => String(r.day).slice(0, 10) === todayKey)
          .sort((a, b) => (a.status === b.status ? b.id - a.id : a.status === "approved" ? -1 : 1));
        const pick = todayRegs[0];
        const s = pick ? byId.get(pick.schedule_id) : null;
        if (s && s.shift_start && s.shift_end) setTodayShift({ name: s.name, start: s.shift_start, end: s.shift_end });
        else setTodayShift(null);
      } catch (e) {
        setTodayShiftErr(getApiErrorMessage(e));
        setTodayShift(null);
      }
    })();
  }, [todayKey]);

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
      return { label: "⏹ Ra ca", hint: todayShift ? `Ca: ${todayShift.start}–${todayShift.end}` : "Ra ca", disabled: !canCheckoutNow };
    }
    return { label: "📷 Vào ca", hint: todayShift ? `Ca: ${todayShift.start}–${todayShift.end}` : "Vào ca", disabled: !canCheckinNow };
  }, [today.status, todayShift, canCheckoutNow, canCheckinNow]);

  useEffect(() => {
    (async () => {
      try {
        const b = await getMyLeaveBalance();
        const annual = b.items.find((x) => x.type === "annual");
        const sick = b.items.find((x) => x.type === "sick");
        if (annual && sick) {
          setLeaveBalance({
            annual: { remaining: annual.remaining_days, percent: Math.round((annual.remaining_days / Math.max(1, annual.allowance_days)) * 100) },
            sick: { remaining: sick.remaining_days, percent: Math.round((sick.remaining_days / Math.max(1, sick.allowance_days)) * 100) }
          });
          setMonthStats((s) => ({ ...s, leaveRemaining: annual.remaining_days }));
        }
      } catch {
        // ignore
      }
    })();
  }, []);

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

  return (
    <div className={styles.page}>
      <div className={styles.mainHeader}>
        <div className={`${styles.headerOrb} ${styles.ho1}`} />
        <div className={`${styles.headerOrb} ${styles.ho2}`} />
        <div className={styles.headerTop}>
          <div className={styles.greetingWrap}>
            <div className={styles.greetingName}>Xin chào, {(me?.name || "Bạn").split(" ").slice(-1)[0]}! 👋</div>
            <div className={styles.greetingSub}>{greetingSub}</div>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.themeBtn} type="button" onClick={toggle} aria-label="Đổi giao diện sáng/tối" title="Đổi giao diện">
              {resolvedTheme === "dark" ? "🌙" : "☀️"}
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
          <div className={`${styles.statusChip} ${today.status === "in" ? styles.statusIn : styles.statusIdle}`}>
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
            <div className={styles.timeBlockVal} style={{ color: "var(--indigo)" }}>
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
            {primaryAttendanceAction.label}
          </Link>
          <Link to="/employee/leave" className={`${styles.btnCi} ${styles.btnBreak}`} title="Tạo đơn xin nghỉ">
            🌴 Xin nghỉ
          </Link>
        </div>
        {todayShift ? <div className={styles.shiftHint}>Hôm nay: <span className={styles.mono}>{todayShift.start}–{todayShift.end}</span> • {todayShift.name}</div> : null}
        {todayShiftErr ? <div className={styles.shiftHint} style={{ color: "var(--rose)" }}>⚠️ {todayShiftErr}</div> : null}
      </div>

      <div className={styles.scrollArea}>
        <div className={styles.sectionHead} style={{ marginTop: 24 }}>
          <div className={styles.sectionTitle}>Tháng này</div>
          <Link to="/employee/timesheet" className={styles.sectionLink}>
            Xem chi tiết →
          </Link>
        </div>

        <div className={styles.statsRow}>
          <div className={styles.statPill}>
            <div className={styles.statPillIcon}>📅</div>
            <div className={styles.statPillVal} style={{ color: "var(--indigo)" }}>{monthStats.days}</div>
            <div className={styles.statPillLbl}>Ngày công</div>
          </div>
          <div className={styles.statPill}>
            <div className={styles.statPillIcon}>⏰</div>
            <div className={styles.statPillVal} style={{ color: "var(--amber)" }}>{monthStats.late}</div>
            <div className={styles.statPillLbl}>Muộn</div>
          </div>
          <div className={styles.statPill}>
            <div className={styles.statPillIcon}>🌴</div>
            <div className={styles.statPillVal} style={{ color: "var(--green)" }}>{monthStats.leaveRemaining}</div>
            <div className={styles.statPillLbl}>Phép còn</div>
          </div>
        </div>

        <div className={styles.streakCard}>
          <div className={styles.streakTop}>
            <div>
              <div className={styles.streakLabel}>{streak.title}</div>
              <div className={styles.streakCount}>{streak.countLabel}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Tuần này</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginTop: 3 }}>{streak.weekSummary}</div>
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
            <div className={styles.actionBtnIcon} style={{ background: "#FDE8ED" }}>
              🌴
            </div>
            <div className={styles.actionBtnLbl}>Xin nghỉ phép</div>
          </Link>
          <button type="button" className={styles.actionBtn}>
            <div className={styles.actionBtnIcon} style={{ background: "var(--amber-light)" }}>
              ⏰
            </div>
            <div className={styles.actionBtnLbl}>Đăng ký tăng ca</div>
          </button>
          <button type="button" className={styles.actionBtn}>
            <div className={styles.actionBtnIcon} style={{ background: "var(--green-light)" }}>
              💰
            </div>
            <div className={styles.actionBtnLbl}>Xem lương</div>
          </button>
          <Link to="/employee/checkin" className={styles.actionBtn}>
            <div className={styles.actionBtnIcon} style={{ background: "var(--indigo-light)" }}>
              📷
            </div>
            <div className={styles.actionBtnLbl}>Chấm công nhanh</div>
          </Link>
        </div>

        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Ngày phép</div>
          <Link to="/employee/leave" className={styles.sectionLink}>
            Xin nghỉ →
          </Link>
        </div>
        <div className={styles.leaveRow}>
          <div className={styles.leavePill}>
            <div className={styles.leavePillIcon}>🌴</div>
            <div className={styles.leavePillVal} style={{ color: "var(--indigo)" }}>
              {leaveBalance?.annual.remaining ?? 0}
            </div>
            <div className={styles.leavePillLbl}>Phép năm còn lại</div>
            <div className={styles.leaveBar}>
              <div className={styles.leaveFill} style={{ width: `${leaveBalance?.annual.percent ?? 0}%`, background: "var(--indigo)" }} />
            </div>
          </div>
          <div className={styles.leavePill}>
            <div className={styles.leavePillIcon}>🤒</div>
            <div className={styles.leavePillVal} style={{ color: "var(--rose)" }}>
              {leaveBalance?.sick.remaining ?? 0}
            </div>
            <div className={styles.leavePillLbl}>Phép ốm còn lại</div>
            <div className={styles.leaveBar}>
              <div className={styles.leaveFill} style={{ width: `${leaveBalance?.sick.percent ?? 0}%`, background: "var(--rose)" }} />
            </div>
          </div>
        </div>

        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Gần đây</div>
          <Link to="/employee/timesheet" className={styles.sectionLink}>
            Tất cả →
          </Link>
        </div>

        {recentLogs.map((l) => {
          const isLate = l.status === "late";
          return (
            <div key={l.id} className={styles.logItem}>
              <div className={`${styles.logDateBox} ${isLate ? styles.logDateBoxAmber : styles.logDateBoxGreen}`}>
                <div className={styles.logDay} style={{ color: isLate ? "var(--amber)" : "var(--green)" }}>
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

        <div className={styles.pad16} />
      </div>
    </div>
  );
}

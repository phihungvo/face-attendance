import { employeeMock } from "../../mock/employeeMock";
import styles from "./EmployeeHomePage.module.scss";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

export default function EmployeeHomePage() {
  const me = employeeMock.me;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
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

  const initials = me.name
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
          <div>
            <div className={styles.greetingName}>Xin chào, {me.name.split(" ").slice(-1)[0]}! 👋</div>
            <div className={styles.greetingSub}>{greetingSub}</div>
          </div>
          <Link to="/employee/profile" className={styles.headerAvatar} aria-label="Hồ sơ">
            {initials || "ME"}
          </Link>
        </div>
      </div>

      <div className={styles.checkinFloat}>
        <div className={styles.checkinFloatTop}>
          <div>
            <div className={styles.checkinFloatLabel}>Giờ hiện tại</div>
            <div className={styles.checkinFloatTime}>{clock}</div>
            <div className={styles.checkinFloatDate}>{dateLabel}</div>
          </div>
          <div className={`${styles.statusChip} ${styles.statusIn}`}>Đang làm việc</div>
        </div>

        <div className={styles.checkinTimes}>
          <div className={styles.timeBlock}>
            <div className={styles.timeBlockLabel}>Vào ca</div>
            <div className={`${styles.timeBlockVal} ${styles.green}`}>{employeeMock.today.checkin}</div>
            <div className={styles.timeBlockSub}>Đúng giờ ✓</div>
          </div>
          <div className={styles.timeBlock}>
            <div className={styles.timeBlockLabel}>Ra ca</div>
            <div className={`${styles.timeBlockVal} ${styles.gray}`}>{employeeMock.today.checkout}</div>
            <div className={styles.timeBlockSub}>Chưa kết thúc</div>
          </div>
          <div className={styles.timeBlock}>
            <div className={styles.timeBlockLabel}>Đã làm</div>
            <div className={styles.timeBlockVal} style={{ color: "var(--indigo)" }}>
              {employeeMock.today.worked}
            </div>
            <div className={styles.timeBlockSub}>Hôm nay</div>
          </div>
        </div>

        <div className={styles.checkinBtnRow}>
          <Link to="/employee/checkin" className={`${styles.btnCi} ${styles.btnOut}`}>
            ⏹ Ra ca
          </Link>
          <button className={`${styles.btnCi} ${styles.btnBreak}`} type="button">
            ☕ Nghỉ giải lao
          </button>
        </div>
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
            <div className={styles.statPillVal} style={{ color: "var(--indigo)" }}>
              {employeeMock.month.days}
            </div>
            <div className={styles.statPillLbl}>Ngày công</div>
          </div>
          <div className={styles.statPill}>
            <div className={styles.statPillIcon}>⏰</div>
            <div className={styles.statPillVal} style={{ color: "var(--amber)" }}>
              {employeeMock.month.late}
            </div>
            <div className={styles.statPillLbl}>Muộn</div>
          </div>
          <div className={styles.statPill}>
            <div className={styles.statPillIcon}>🌴</div>
            <div className={styles.statPillVal} style={{ color: "var(--green)" }}>
              {employeeMock.month.leaveRemaining}
            </div>
            <div className={styles.statPillLbl}>Phép còn</div>
          </div>
        </div>

        <div className={styles.streakCard}>
          <div className={styles.streakTop}>
            <div>
              <div className={styles.streakLabel}>{employeeMock.streak.title}</div>
              <div className={styles.streakCount}>{employeeMock.streak.countLabel}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Tuần này</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginTop: 3 }}>{employeeMock.streak.weekSummary}</div>
            </div>
          </div>

          <div className={styles.streakDays}>
            {employeeMock.streak.days.map((d) => {
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
              {employeeMock.leaveBalance.annual.remaining}
            </div>
            <div className={styles.leavePillLbl}>Phép năm còn lại</div>
            <div className={styles.leaveBar}>
              <div className={styles.leaveFill} style={{ width: `${employeeMock.leaveBalance.annual.percent}%`, background: "var(--indigo)" }} />
            </div>
          </div>
          <div className={styles.leavePill}>
            <div className={styles.leavePillIcon}>🤒</div>
            <div className={styles.leavePillVal} style={{ color: "var(--rose)" }}>
              {employeeMock.leaveBalance.sick.remaining}
            </div>
            <div className={styles.leavePillLbl}>Phép ốm còn lại</div>
            <div className={styles.leaveBar}>
              <div className={styles.leaveFill} style={{ width: `${employeeMock.leaveBalance.sick.percent}%`, background: "var(--rose)" }} />
            </div>
          </div>
        </div>

        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Gần đây</div>
          <Link to="/employee/timesheet" className={styles.sectionLink}>
            Tất cả →
          </Link>
        </div>

        {employeeMock.recentLogs.map((l) => {
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

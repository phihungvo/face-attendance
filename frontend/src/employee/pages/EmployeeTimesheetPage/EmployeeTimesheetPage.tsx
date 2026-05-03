import { employeeMock } from "../../mock/employeeMock";
import styles from "./EmployeeTimesheetPage.module.scss";
import { useMemo, useState } from "react";

export default function EmployeeTimesheetPage() {
  const months = employeeMock.history.months;
  const [active, setActive] = useState(months[0]?.key ?? "");

  const rows = useMemo(() => months.find((m) => m.key === active)?.rows ?? [], [active, months]);

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.title}>📋 Lịch sử chấm công</div>
        <div className={styles.monthRow}>
          {months.map((m) => (
            <button key={m.key} type="button" className={m.key === active ? `${styles.monthTab} ${styles.monthTabActive}` : styles.monthTab} onClick={() => setActive(m.key)}>
              {m.key}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.content}>
        {rows.map((r) => {
          const statusLabel = r.status === "late" ? "Đi trễ" : r.status === "absent" ? "Vắng" : "Đúng giờ";
          const dayColor = r.status === "late" ? "var(--amber)" : r.status === "absent" ? "var(--ink3)" : "var(--green)";
          return (
            <div key={`${r.day}-${r.dow}`} className={styles.histRow}>
              <div className={styles.dateBox}>
                <div className={styles.dateDay} style={{ color: dayColor }}>
                  {r.day}
                </div>
                <div className={styles.dateDow}>{r.dow}</div>
              </div>
              <div className={styles.main}>
                <div className={styles.mainTitle}>
                  {statusLabel} · {r.hours}
                </div>
                <div className={styles.mainSub}>
                  Vào {r.checkin} · Ra {r.checkout}
                </div>
              </div>
              <div className={styles.right}>
                <div className={styles.hours}>{r.hours}</div>
                <div className={styles.ot}>OT {r.ot}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

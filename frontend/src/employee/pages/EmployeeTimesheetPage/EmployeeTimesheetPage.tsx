import styles from "./EmployeeTimesheetPage.module.scss";
import { useEffect, useMemo, useState } from "react";
import { listMyTimelog, type TimelogRow } from "../../../shared/api/attendance";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";

export default function EmployeeTimesheetPage() {
  const now = useMemo(() => new Date(), []);
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [active, setActive] = useState(currentMonth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<TimelogRow[]>([]);

  const months = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  }, [now]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [y, m] = active.split("-").map((x) => Number(x));
        const from = `${active}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const to = `${active}-${String(lastDay).padStart(2, "0")}`;
        const data = await listMyTimelog({ from_date: from, to_date: to });
        setRows(data);
      } catch (e) {
        setError(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [active]);

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.title}>📋 Lịch sử chấm công</div>
        <div className={styles.monthRow}>
          {months.map((m) => (
            <button key={m} type="button" className={m === active ? `${styles.monthTab} ${styles.monthTabActive}` : styles.monthTab} onClick={() => setActive(m)}>
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.content}>
        {error ? <div className={styles.errorBox}>{error}</div> : null}
        {loading ? <div className={styles.loading}>Đang tải...</div> : null}
        {rows.map((r) => {
          const statusLabel = r.absent ? "Vắng" : r.late ? "Đi trễ" : "Đúng giờ";
          const dayColor = r.absent ? "var(--ink3)" : r.late ? "var(--amber)" : "var(--green)";
          const d = new Date(`${r.date}T00:00:00`);
          const day = String(d.getDate());
          const dow = d.toLocaleDateString("vi-VN", { weekday: "short" });
          const hours = `${Math.floor((r.working_minutes ?? 0) / 60)}h ${String((r.working_minutes ?? 0) % 60).padStart(2, "0")}m`;
          const checkin = r.checkin_time ? new Date(r.checkin_time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—";
          const checkout = r.checkout_time ? new Date(r.checkout_time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—";
          const ot = `${Math.floor((r.overtime_minutes ?? 0) / 60)}h ${String((r.overtime_minutes ?? 0) % 60).padStart(2, "0")}m`;
          return (
            <div key={r.date} className={styles.histRow}>
              <div className={styles.dateBox}>
                <div className={styles.dateDay} style={{ color: dayColor }}>
                  {day}
                </div>
                <div className={styles.dateDow}>{dow}</div>
              </div>
              <div className={styles.main}>
                <div className={styles.mainTitle}>
                  {statusLabel} · {hours}
                </div>
                <div className={styles.mainSub}>
                  Vào {checkin} · Ra {checkout}
                </div>
              </div>
              <div className={styles.right}>
                <div className={styles.hours}>{hours}</div>
                <div className={styles.ot}>OT {ot}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

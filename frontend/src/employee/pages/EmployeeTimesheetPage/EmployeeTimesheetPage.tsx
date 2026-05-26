import styles from "./EmployeeTimesheetPage.module.scss";
import { useEffect, useMemo, useState } from "react";
import { listMyTimelog, type TimelogRow } from "../../../shared/api/attendance";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import { ProfileOutlined } from "@ant-design/icons";
import { useCachedQuery } from "../../../shared/hooks/useCachedQuery";
import { empKeys } from "../../cacheKeys";
import AttendanceEvidenceHistoryPanel from "../../../shared/attendanceEvidence/AttendanceEvidenceHistoryPanel";

export default function EmployeeTimesheetPage() {
  const now = useMemo(() => new Date(), []);
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [active, setActive] = useState(currentMonth);
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

  const q = useCachedQuery({
    key: empKeys.myTimelogMonth(active),
    ttlMs: 60_000,
    fetcher: async () => {
      const [y, m] = active.split("-").map((x) => Number(x));
      const from = `${active}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const to = `${active}-${String(lastDay).padStart(2, "0")}`;
      return listMyTimelog({ from_date: from, to_date: to });
    }
  });

  useEffect(() => {
    if (q.error) setError(q.error);
    else setError(null);
    if (q.data) setRows(q.data);
  }, [q.data, q.error]);

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.title}>
          <ProfileOutlined /> Lịch sử chấm công
        </div>
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
        {q.loading ? <div className={styles.loading}>Đang tải...</div> : null}
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

        <div className={styles.evidenceSection}>
          <AttendanceEvidenceHistoryPanel
            title="Ảnh bằng chứng"
            sub="Ảnh lưu theo từng lần vào/ra ca. Chỉ những bản ghi đã upload thành công mới mở được ảnh."
            defaultDays={14}
            pageSize={12}
            compact
          />
        </div>
      </div>
    </div>
  );
}

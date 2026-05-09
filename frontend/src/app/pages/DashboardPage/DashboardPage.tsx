import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card/Card";
import StatCard from "../../components/StatCard/StatCard";
import Table from "../../components/Table/Table";
import { getAttendanceStats, getDailyAttendanceReport, listAttendanceLogs, type AttendanceLog } from "../../../shared/api/attendance";
import { listLeaves } from "../../../shared/api/leaves";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import type { LeaveRequest } from "../../../shared/types/leave";
import styles from "./DashboardPage.module.scss";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState<{ total: number; present: number; late: number; absent: number; working: number } | null>(null);
  const [weekBars, setWeekBars] = useState<{ label: string; value: number }[]>([]);
  const [recent, setRecent] = useState<AttendanceLog[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<{ id: number; name: string; type: string; range: string; status: string }[]>([]);

  const todayStr = useMemo(() => new Date().toLocaleDateString("en-CA"), []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const stats = await getAttendanceStats({ from_date: todayStr, to_date: todayStr });
        const total = stats.total_users ?? 0;
        const present = stats.total_checkins ?? 0;
        const late = stats.late_count ?? 0;
        const absent = Math.max(0, total - present);
        const working = Math.max(0, (stats.total_checkins ?? 0) - (stats.total_checkouts ?? 0));
        setToday({ total, present, late, absent, working });

        const logs = await listAttendanceLogs();
        setRecent(logs.slice(0, 8));

        const leaves = await listLeaves({ status: "pending", limit: 5, offset: 0 });
        setPendingLeaves(
          ((leaves.items ?? []) as LeaveRequest[]).slice(0, 5).map((l) => ({
            id: l.id,
            name: l.user_name || `#${l.user_id}`,
            type: l.type,
            range: `${l.start_date} → ${l.end_date}`,
            status: l.status
          }))
        );

        const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
        const tasks = Array.from({ length: 7 }, (_, idx) => {
          const i = 6 - idx;
          const d = new Date();
          d.setDate(d.getDate() - i);
          const day = d.toLocaleDateString("en-CA");
          return getDailyAttendanceReport({ day }).then((rows) => {
            const presentCount = rows.filter((r) => !r.absent).length;
            const pct = total > 0 ? Math.round((presentCount / total) * 100) : 0;
            return { label: days[d.getDay()], value: pct };
          });
        });
        setWeekBars(await Promise.all(tasks));
      } catch (e) {
        setError(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [todayStr]);

  return (
    <div className={styles.page}>
      <div className={styles.statsGrid}>
        <StatCard icon="👥" label="Tổng nhân viên" value={today?.total ?? (loading ? "…" : 0)} variant="blue" />
        <StatCard icon="✅" label="Có mặt hôm nay" value={today?.present ?? (loading ? "…" : 0)} variant="green" delta={today ? { label: `${today.working} đang làm việc`, tone: "neutral" } : undefined} />
        <StatCard icon="⏰" label="Đi trễ hôm nay" value={today?.late ?? (loading ? "…" : 0)} variant="orange" />
        <StatCard icon="❌" label="Vắng hôm nay" value={today?.absent ?? (loading ? "…" : 0)} variant="red" />
      </div>

      {error ? <div className={styles.errorBox}>⚠️ {error}</div> : null}

      <div className={styles.grid2}>
        <Card title="📊 Tỉ lệ chấm công 7 ngày" sub="% nhân viên có mặt theo ngày (theo ngày công)">
          <div className={styles.chartBars}>
            {(weekBars.length ? weekBars : Array.from({ length: 7 }, (_, i) => ({ label: String(i + 1), value: 0 }))).map((d) => (
              <div key={d.label} className={styles.barCol}>
                <div className={styles.bar} style={{ height: `${Math.round(d.value)}%` }} />
                <div className={styles.barLabel}>{d.label}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="🌴 Đơn nghỉ phép chờ duyệt" sub={loading ? "Đang tải..." : `${pendingLeaves.length} đơn gần nhất`}>
          <div className={styles.list}>
            {pendingLeaves.map((l) => (
              <div key={l.id} className={styles.listRow}>
                <div className={styles.listAvatar}>{(l.name || "?").split(" ").slice(-2).map((s) => s[0]?.toUpperCase() ?? "").join("")}</div>
                <div className={styles.listMain}>
                  <div className={styles.listTitle}>{l.name}</div>
                  <div className={styles.listSub}>
                    {l.type} • {l.range}
                  </div>
                </div>
                <div className={styles.listTag}>{l.status}</div>
              </div>
            ))}
            {!loading && pendingLeaves.length === 0 ? <div className={styles.empty}>Không có đơn chờ duyệt</div> : null}
          </div>
        </Card>
      </div>

      <Card title="👤 Log chấm công gần nhất" sub={loading ? "Đang tải..." : "Cập nhật theo hệ thống"}>
        <Table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Nhân viên</th>
              <th>Loại</th>
              <th>Độ tin cậy</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.timestamp).toLocaleString("vi-VN")}</td>
                <td className={styles.employeeCell}>
                  <span className={styles.empAvatar}>{(l.user_name || "??").slice(0, 2).toUpperCase()}</span>
                  <span className={styles.empText}>
                    <span className={styles.empName}>{l.user_name || `#${l.user_id}`}</span>
                    <span className={styles.empCode}>ID: {l.user_id}</span>
                  </span>
                </td>
                <td>
                  <span className={l.type === "checkin" ? `${styles.status} ${styles.good}` : `${styles.status} ${styles.warn}`}>{l.type}</span>
                </td>
                <td>{l.confidence.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

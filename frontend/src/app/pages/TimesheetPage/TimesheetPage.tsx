import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card/Card";
import Modal from "../../components/Modal/Modal";
import Table from "../../components/Table/Table";
import { deleteTimelogDay, listTimelog, upsertTimelogDay, type TimelogRow } from "../../../shared/api/attendance";
import { listDepartments } from "../../../shared/api/departments";
import type { Department } from "../../../shared/types/department";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import styles from "./TimesheetPage.module.scss";

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toHm(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function buildIso(day: string, hm: string) {
  return `${day}T${hm}:00`;
}

export default function TimesheetPage() {
  const now = useMemo(() => new Date(), []);
  const [fromDate, setFromDate] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const [toDate, setToDate] = useState(() => toYmd(new Date()));
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [status, setStatus] = useState<"" | "on-time" | "late" | "absent">("");
  const [includeAbsent, setIncludeAbsent] = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [rows, setRows] = useState<TimelogRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<TimelogRow | null>(null);
  const [editCheckin, setEditCheckin] = useState("");
  const [editCheckout, setEditCheckout] = useState("");

  const summary = useMemo(() => {
    const totalEmployees = new Set(rows.map((r) => r.user_id)).size;
    const totalHours = rows.reduce((acc, r) => acc + (r.work_hours || 0), 0);
    const lateDays = rows.reduce((acc, r) => acc + (r.late ? 1 : 0), 0);
    const absentDays = rows.reduce((acc, r) => acc + (r.absent ? 1 : 0), 0);
    return { totalEmployees, totalHours: Math.round(totalHours * 10) / 10, lateDays, absentDays };
  }, [rows]);

  async function refresh() {
    try {
      setBusy(true);
      setError(null);
      const data = await listTimelog({
        from_date: fromDate,
        to_date: toDate,
        department_id: departmentId,
        status: status || null,
        include_absent: includeAbsent || status === "absent"
      });
      setRows(data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const depts = await listDepartments({ limit: 500, offset: 0 });
        setDepartments(depts);
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.page}>
      <Card title="📋 Nhật ký giờ công" sub="Lịch sử chấm công chi tiết">
        <div className={styles.filters}>
          <div className={styles.filterItem}>
            <div className={styles.filterLabel}>Từ ngày</div>
            <input className={styles.input} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className={styles.filterItem}>
            <div className={styles.filterLabel}>Đến ngày</div>
            <input className={styles.input} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className={styles.filterItem}>
            <div className={styles.filterLabel}>Phòng ban</div>
            <select
              className={styles.input}
              value={departmentId ?? ""}
              onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Tất cả</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterItem}>
            <div className={styles.filterLabel}>Trạng thái</div>
            <select className={styles.input} value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="">Tất cả</option>
              <option value="on-time">Đúng giờ</option>
              <option value="late">Muộn</option>
              <option value="absent">Vắng mặt</option>
            </select>
          </div>
          <label className={styles.check}>
            <input type="checkbox" checked={includeAbsent} onChange={(e) => setIncludeAbsent(e.target.checked)} /> Hiện vắng
          </label>
          <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" disabled={busy} onClick={refresh}>
            {busy ? "Đang tải..." : "🔍 Lọc"}
          </button>
          <button
            className={`${styles.btn} ${styles.btnGhost}`}
            type="button"
            disabled={!rows.length}
            onClick={() => {
              const lines = [
                ["Mã NV", "Tên", "Phòng ban", "Ngày", "Giờ vào", "Giờ ra", "Giờ làm", "Trạng thái", "Phương thức"].join(",")
              ];
              for (const r of rows) {
                const st = r.absent ? "absent" : r.late ? "late" : "on-time";
                lines.push(
                  [
                    r.user_code || String(r.user_id),
                    r.user_name,
                    r.department_name || "",
                    r.date,
                    toHm(r.checkin_time),
                    toHm(r.checkout_time),
                    String(r.work_hours ?? 0),
                    st,
                    r.method || ""
                  ].join(",")
                );
              }
              const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `timelog_${fromDate}_${toDate}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            📥 Xuất CSV
          </button>

          <div className={styles.chips}>
            <div className={styles.chip}>👥 {summary.totalEmployees} nhân viên</div>
            <div className={styles.chip}>⏱ {summary.totalHours} giờ</div>
            <div className={styles.chip}>🟡 {summary.lateDays} đi trễ</div>
            <div className={styles.chip}>🔴 {summary.absentDays} vắng</div>
          </div>
        </div>
      </Card>

      <Card title="📄 Bảng chấm công" sub={`${rows.length} bản ghi`}>
        {error ? <div className={styles.errorBox}>{error}</div> : null}
        <div className={styles.timelogTable}>
          <Table>
            <thead>
              <tr>
                <th>Mã NV</th>
                <th>Nhân viên</th>
                {/* <th>Tên nhân viên</th> */}
                <th>Phòng ban</th>
                <th>Ngày</th>
                <th>Giờ vào</th>
                <th>Giờ ra</th>
                <th>Giờ làm</th>
                <th>Tăng ca</th>
                <th>Trạng thái</th>
                <th>Phương thức</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const statusKey = r.absent ? "absent" : r.late ? "late" : "on-time";
                const statusLabel = r.absent ? "✗ Vắng mặt" : r.late ? "⚠ Đi muộn" : "✓ Đúng giờ";
                const initials = r.user_name
                  .split(" ")
                  .filter(Boolean)
                  .slice(-2)
                  .map((x) => x[0])
                  .join("")
                  .toUpperCase();

                const checkinHm = toHm(r.checkin_time);
                const checkoutHm = toHm(r.checkout_time);
                const workMin = Number.isFinite(r.work_hours) ? Math.max(0, Math.round((r.work_hours ?? 0) * 60)) : 0;
                const workLabel = `${Math.floor(workMin / 60)}h ${String(workMin % 60).padStart(2, "0")}m`;
                const otMin = 0;
                const otLabel = `${Math.floor(otMin / 60)}h ${String(otMin % 60).padStart(2, "0")}m`;

                return (
                  <tr key={`${r.user_id}-${r.date}`}>
                    <td className={`${styles.mono} ${styles.colCode}`}>{r.user_code || `#${r.user_id}`}</td>
                    <td className={styles.colName}>
                      <span className={styles.empCell}>
                        <span className={styles.empAvatar}>{initials || "??"}</span>
                        <span className={styles.empName}>{r.user_name}</span>
                      </span>
                    </td>
                    <td>{r.department_name || "—"}</td>
                    <td className={styles.mono}>{r.date}</td>
                    <td className={styles.timeIn}>{checkinHm || "—"}</td>
                    <td className={styles.timeOut}>{checkoutHm || "—"}</td>
                    <td className={styles.timeWork}>{workLabel}</td>
                    <td className={styles.timeOt}>{otLabel}</td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          statusKey === "on-time" ? styles.badgeGreen : statusKey === "late" ? styles.badgeOrange : styles.badgeRed
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className={styles.note}>{r.method || "—"}</td>
                    <td className={styles.colActions}>
                      <div className={styles.rowActions}>
                        <button
                          className={`${styles.rowBtn} ${styles.rowBtnEdit}`}
                          type="button"
                          onClick={() => {
                            setEditing(r);
                            setEditCheckin(toHm(r.checkin_time));
                            setEditCheckout(toHm(r.checkout_time));
                            setEditOpen(true);
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          className={`${styles.rowBtn} ${styles.rowBtnDel}`}
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(`Xoá giờ công ngày ${r.date} của ${r.user_name}?`)) return;
                            try {
                              setBusy(true);
                              setError(null);
                              await deleteTimelogDay({ user_id: r.user_id, day: r.date });
                              setRows((prev) => prev.filter((x) => !(x.user_id === r.user_id && x.date === r.date)));
                            } catch (e) {
                              setError(getApiErrorMessage(e));
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card>

      <Modal
        open={editOpen && !!editing}
        title={editing ? `Chỉnh giờ công • ${editing.user_name} • ${editing.date}` : "Chỉnh giờ công"}
        onClose={() => {
          setEditOpen(false);
          setEditing(null);
          setEditCheckin("");
          setEditCheckout("");
        }}
        footer={
          <div className={styles.modalFooter}>
            <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={() => setEditOpen(false)}>
              Huỷ
            </button>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              type="button"
              disabled={!editing || busy}
              onClick={async () => {
                if (!editing) return;
                try {
                  setBusy(true);
                  setError(null);
                  const updated = await upsertTimelogDay({
                    user_id: editing.user_id,
                    day: editing.date,
                    checkin_time: editCheckin ? buildIso(editing.date, editCheckin) : null,
                    checkout_time: editCheckout ? buildIso(editing.date, editCheckout) : null
                  });
                  setRows((prev) => prev.map((x) => (x.user_id === updated.user_id && x.date === updated.date ? updated : x)));
                  setEditOpen(false);
                } catch (e) {
                  setError(getApiErrorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Lưu
            </button>
          </div>
        }
      >
        <div className={styles.formGrid}>
          <div className={styles.formItem}>
            <div className={styles.filterLabel}>Giờ vào</div>
            <input className={styles.input} type="time" value={editCheckin} onChange={(e) => setEditCheckin(e.target.value)} />
          </div>
          <div className={styles.formItem}>
            <div className={styles.filterLabel}>Giờ ra</div>
            <input className={styles.input} type="time" value={editCheckout} onChange={(e) => setEditCheckout(e.target.value)} />
          </div>
        </div>
        <div className={styles.note} style={{ marginTop: 10 }}>
          Lưu ý: thao tác này sẽ ghi đè log check-in/check-out trong ngày (nếu có) và đánh dấu phương thức là Manual.
        </div>
      </Modal>
    </div>
  );
}

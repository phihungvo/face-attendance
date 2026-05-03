import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card/Card";
import Table from "../../components/Table/Table";
import Modal from "../../components/Modal/Modal";
import { listDepartments } from "../../../shared/api/departments";
import { listUsers } from "../../../shared/api/users";
import { approveLeave, createLeave, deleteLeave, listLeaves, rejectLeave, updateLeave } from "../../../shared/api/leaves";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import type { Department } from "../../../shared/types/department";
import type { User } from "../../../shared/types/user";
import type { LeaveRequest, LeaveStatus } from "../../../shared/types/leave";
import styles from "./LeavePage.module.scss";

function initialsFromName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/g)
    .filter(Boolean);
  if (parts.length === 0) return "??";
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : parts[0]?.[1] ?? "";
  return `${a}${b}`.toUpperCase();
}

export default function LeavePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<"all" | LeaveStatus>("pending");
  const [query, setQuery] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [kpis, setKpis] = useState({ pending: 0, approved: 0, rejected: 0 });

  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveRequest | null>(null);
  const [userId, setUserId] = useState("");
  const [type, setType] = useState("Nghỉ phép");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const deptById = useMemo(() => {
    const m = new Map<number, Department>();
    for (const d of departments) m.set(d.id, d);
    return m;
  }, [departments]);

  const pageButtons = useMemo(() => {
    const windowSize = 5;
    const half = Math.floor(windowSize / 2);
    let start = Math.max(1, pageSafe - half);
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    const out: number[] = [];
    for (let p = start; p <= end; p++) out.push(p);
    return out;
  }, [pageSafe, totalPages]);

  async function refresh() {
    try {
      setLoading(true);
      setError(null);
      const res = await listLeaves({
        q: query.trim() || undefined,
        status: status === "all" ? undefined : status,
        department_id: departmentId ? Number(departmentId) : undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        limit: pageSize,
        offset: (pageSafe - 1) * pageSize
      });
      setRows(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function refreshKpis() {
    try {
      const [p, a, r] = await Promise.all([
        listLeaves({ status: "pending", limit: 1, offset: 0 }),
        listLeaves({ status: "approved", limit: 1, offset: 0 }),
        listLeaves({ status: "rejected", limit: 1, offset: 0 })
      ]);
      setKpis({ pending: p.total, approved: a.total, rejected: r.total });
    } catch {
      // ignore KPI failure
    }
  }

  useEffect(() => {
    refresh();
  }, [pageSafe, status, query, departmentId, fromDate, toDate]);

  useEffect(() => {
    setPage(1);
  }, [status, query, departmentId, fromDate, toDate]);

  useEffect(() => {
    refreshKpis();
    (async () => {
      try {
        const [depts, us] = await Promise.all([
          listDepartments({ limit: 500, offset: 0 }),
          listUsers({ limit: 500, offset: 0 })
        ]);
        setDepartments(depts);
        setUsers(us);
      } catch {
        // ignore
      }
    })();
  }, []);

  const deptOptions = useMemo(() => {
    return departments
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
      .map((d) => ({ id: String(d.id), label: `${d.code} - ${d.name}` }));
  }, [departments]);

  const userOptions = useMemo(() => {
    return users
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
      .map((u) => ({ id: String(u.id), label: `${u.code ? `${u.code} - ` : ""}${u.name}` }));
  }, [users]);

  return (
    <div className={styles.page}>
      <div className={styles.grid2}>
        <Card title="🌴 Trạng thái duyệt" sub="Tổng quan">
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>Chờ duyệt</div>
              <div className={styles.kpiValue}>{kpis.pending}</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>Đã duyệt</div>
              <div className={styles.kpiValue}>{kpis.approved}</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>Từ chối</div>
              <div className={styles.kpiValue}>{kpis.rejected}</div>
            </div>
          </div>
        </Card>
        <Card title="🧾 Quy tắc" sub="Gợi ý xử lý đơn">
          <div className={styles.warningBox}>Đơn nghỉ phép cần đối chiếu bảng giờ công và chính sách nội bộ trước khi duyệt.</div>
        </Card>
      </div>

      <Card title="🌴 Đơn nghỉ phép" sub="CRUD thật qua API">
        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.toolbar}>
          <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value as any)} aria-label="Trạng thái">
          <option value="all">Tất cả</option>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Từ chối</option>
          </select>

          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>🔍</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên/mã nhân viên..." />
          </div>

          <select className={styles.select} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} aria-label="Phòng ban">
            <option value="">Tất cả phòng ban</option>
            {deptOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>

          <div className={styles.dateFilters}>
            <input className={styles.dateInput} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="Từ ngày" />
            <span className={styles.dateSep}>→</span>
            <input className={styles.dateInput} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="Đến ngày" />
          </div>

          <button className={styles.btnGhost} type="button" disabled={loading} onClick={() => refresh()}>
            {loading ? "⏳" : "🔄"}
          </button>

          <button
            className={styles.btnPrimary}
            type="button"
            onClick={() => {
              setEditing(null);
              setUserId(userOptions[0]?.id ?? "");
              setType("Nghỉ phép");
              const today = new Date().toISOString().slice(0, 10);
              setStartDate(today);
              setEndDate(today);
              setReason("");
              setModalOpen(true);
            }}
          >
            + Tạo đơn
          </button>
        </div>

        <Table>
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Loại</th>
              <th>Thời gian</th>
              <th>Lý do</th>
              <th>Trạng thái</th>
              <th style={{ width: 140 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const name = r.user_name || `#${r.user_id}`;
              const code = r.user_code || "—";
              const range = r.start_date === r.end_date ? r.start_date : `${r.start_date} → ${r.end_date}`;
              const dept = r.department_id ? deptById.get(r.department_id)?.name ?? `#${r.department_id}` : "—";
              return (
                <tr key={r.id}>
                  <td className={styles.empCell}>
                    <span className={styles.empAvatar}>{initialsFromName(name)}</span>
                    <span className={styles.empMain}>
                      <span className={styles.empName}>{name}</span>
                      <span className={styles.empSub}>
                        {code} • {dept}
                      </span>
                    </span>
                  </td>
                  <td>{r.type}</td>
                  <td className={styles.mono}>{range}</td>
                  <td className={styles.muted}>{r.reason || "—"}</td>
                  <td>
                    <span
                      className={
                        r.status === "pending"
                          ? `${styles.tag} ${styles.warn}`
                          : r.status === "approved"
                            ? `${styles.tag} ${styles.good}`
                            : `${styles.tag} ${styles.bad}`
                      }
                    >
                      {r.status === "pending" ? "Chờ duyệt" : r.status === "approved" ? "Đã duyệt" : "Từ chối"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      {r.status === "pending" ? (
                        <>
                          <button
                            className={`${styles.actionBtn} ${styles.ok}`}
                            type="button"
                            disabled={loading}
                            title="Duyệt"
                            onClick={async () => {
                              try {
                                setLoading(true);
                                setError(null);
                                await approveLeave(r.id);
                                await Promise.all([refresh(), refreshKpis()]);
                              } catch (e) {
                                setError(getApiErrorMessage(e));
                              } finally {
                                setLoading(false);
                              }
                            }}
                          >
                            ✅
                          </button>
                          <button
                            className={`${styles.actionBtn} ${styles.no}`}
                            type="button"
                            disabled={loading}
                            title="Từ chối"
                            onClick={async () => {
                              try {
                                setLoading(true);
                                setError(null);
                                await rejectLeave(r.id);
                                await Promise.all([refresh(), refreshKpis()]);
                              } catch (e) {
                                setError(getApiErrorMessage(e));
                              } finally {
                                setLoading(false);
                              }
                            }}
                          >
                            ❌
                          </button>
                        </>
                      ) : null}

                      <button
                        className={styles.actionBtn}
                        type="button"
                        title="Sửa"
                        onClick={() => {
                          setEditing(r);
                          setUserId(String(r.user_id));
                          setType(r.type);
                          setStartDate(r.start_date);
                          setEndDate(r.end_date);
                          setReason(r.reason || "");
                          setModalOpen(true);
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.no}`}
                        type="button"
                        disabled={loading}
                        onClick={async () => {
                          if (!confirm(`Xóa đơn nghỉ phép của "${name}"?`)) return;
                          try {
                            setLoading(true);
                            setError(null);
                            await deleteLeave(r.id);
                            await Promise.all([refresh(), refreshKpis()]);
                          } catch (e) {
                            setError(getApiErrorMessage(e));
                          } finally {
                            setLoading(false);
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

        {rows.length === 0 ? <div className={styles.empty}>Chưa có đơn nghỉ phép (hoặc không khớp bộ lọc).</div> : null}

        <div className={styles.pagination}>
          <div className={styles.pageHint}>{total === 0 ? "0 kết quả" : `Trang ${pageSafe}/${totalPages} • ${total} đơn`}</div>
          <div className={styles.pageControls}>
            <button className={styles.pageBtn} type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSafe <= 1}>
              ←
            </button>
            {pageButtons.map((p) => (
              <button
                key={p}
                className={p === pageSafe ? `${styles.pageBtn} ${styles.pageBtnActive}` : styles.pageBtn}
                type="button"
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button className={styles.pageBtn} type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={pageSafe >= totalPages}>
              →
            </button>
          </div>
        </div>
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? "✏️ Sửa đơn nghỉ phép" : "➕ Tạo đơn nghỉ phép"}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className={styles.btnGhost} type="button" onClick={() => setModalOpen(false)} disabled={loading}>
              Hủy
            </button>
            <button
              className={styles.btnPrimary}
              type="button"
              disabled={loading || !userId || !type.trim() || !startDate || !endDate}
              onClick={async () => {
                try {
                  setLoading(true);
                  setError(null);
                  const payload = {
                    user_id: Number(userId),
                    type: type.trim(),
                    start_date: startDate,
                    end_date: endDate,
                    reason: reason.trim() || null
                  };
                  if (editing) await updateLeave(editing.id, payload);
                  else await createLeave(payload);
                  setModalOpen(false);
                  await Promise.all([refresh(), refreshKpis()]);
                } catch (e) {
                  setError(getApiErrorMessage(e));
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? "Đang lưu..." : "Lưu"}
            </button>
          </>
        }
      >
        <div className={styles.modalGrid}>
          <div className={styles.formGroup}>
            <div className={styles.formLabelTop}>Nhân viên</div>
            <select className={styles.input} value={userId} onChange={(e) => setUserId(e.target.value)}>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <div className={styles.formLabelTop}>Loại</div>
            <select className={styles.input} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="Nghỉ phép">Nghỉ phép</option>
              <option value="Nghỉ ốm">Nghỉ ốm</option>
              <option value="Nghỉ không lương">Nghỉ không lương</option>
              <option value="Đi công tác">Đi công tác</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <div className={styles.formLabelTop}>Từ ngày</div>
            <input className={styles.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div className={styles.formGroup}>
            <div className={styles.formLabelTop}>Đến ngày</div>
            <input className={styles.input} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          <div className={styles.formGroupFull}>
            <div className={styles.formLabelTop}>Lý do</div>
            <textarea className={styles.textarea} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ghi chú / lý do nghỉ..." />
          </div>
        </div>
      </Modal>
    </div>
  );
}

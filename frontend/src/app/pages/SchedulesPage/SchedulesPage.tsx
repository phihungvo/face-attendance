import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card/Card";
import Modal from "../../components/Modal/Modal";
import Table from "../../components/Table/Table";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import { useAuth } from "../../../shared/auth/auth";
import {
  approveScheduleRegistration,
  approveRegistrationRequest,
  createSchedule,
  deleteScheduleRegistration,
  deleteSchedule,
  listRegistrationRequests,
  listScheduleRegistrations,
  listSchedules,
  rejectRegistrationRequest,
  rejectScheduleRegistration,
  updateSchedule,
  type WorkSchedule,
  type WorkScheduleRegistrationRequestListItem,
  type WorkScheduleRegistrationListItem
} from "../../../shared/api/schedules";
import { listDepartments } from "../../../shared/api/departments";
import type { Department } from "../../../shared/types/department";
import styles from "./SchedulesPage.module.scss";

function defaultScheduleForm(): Partial<WorkSchedule> {
  return {
    code: "",
    name: "",
    status: "active",
    shift_start: "09:00",
    shift_end: "18:00",
    late_grace_minutes: 0,
    early_leave_grace_minutes: 0,
    break_start: "12:00",
    break_end: "13:00",
    break_duration_minutes: 60,
    break_threshold_hours: 6,
    auto_checkout_time: "23:59",
    department_id: null,
    max_registrations: 0,
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    date_start: null,
    date_end: null,
    note: null
  };
}

const DOW_LABEL: Record<number, string> = { 0: "T2", 1: "T3", 2: "T4", 3: "T5", 4: "T6", 5: "T7", 6: "CN" };

export default function SchedulesPage() {
  const auth = useAuth();
  const canManage = useMemo(() => auth.permissionKeys.includes("schedules.manage"), [auth.permissionKeys]);
  const canApprove = useMemo(() => auth.permissionKeys.includes("schedules.approve"), [auth.permissionKeys]);

  const [error, setError] = useState<string | null>(null);

  const [schedulesLoading, setSchedulesLoading] = useState(true);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [openScheduleModal, setOpenScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
  const [scheduleForm, setScheduleForm] = useState<Partial<WorkSchedule>>(() => defaultScheduleForm());

  const [regLoading, setRegLoading] = useState(true);
  const [regItems, setRegItems] = useState<WorkScheduleRegistrationListItem[]>([]);
  const [regStatus, setRegStatus] = useState<string>("pending");

  const [reqLoading, setReqLoading] = useState(true);
  const [reqItems, setReqItems] = useState<WorkScheduleRegistrationRequestListItem[]>([]);
  const [reqStatus, setReqStatus] = useState<string>("pending");

  const reloadSchedules = async () => {
    setSchedulesLoading(true);
    setError(null);
    try {
      const items = await listSchedules({ limit: 500, offset: 0 });
      setSchedules(items);
      if (canManage) {
        const depts = await listDepartments({ limit: 500, offset: 0 });
        setDepartments(depts);
      }
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSchedulesLoading(false);
    }
  };

  const reloadRegs = async () => {
    setRegLoading(true);
    setError(null);
    try {
      const res = await listScheduleRegistrations({ limit: 200, offset: 0, status: regStatus || undefined });
      setRegItems(res.items ?? []);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setRegLoading(false);
    }
  };

  const reloadReqs = async () => {
    setReqLoading(true);
    setError(null);
    try {
      const res = await listRegistrationRequests({ limit: 200, offset: 0, status: reqStatus || undefined });
      setReqItems(res.items ?? []);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setReqLoading(false);
    }
  };

  useEffect(() => {
    reloadSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    reloadRegs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regStatus]);

  useEffect(() => {
    reloadReqs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqStatus]);

  const openCreateSchedule = () => {
    setEditingSchedule(null);
    setScheduleForm(defaultScheduleForm());
    setOpenScheduleModal(true);
  };

  const openEditSchedule = (s: WorkSchedule) => {
    setEditingSchedule(s);
    setScheduleForm({ ...s });
    setOpenScheduleModal(true);
  };

  const saveSchedule = async () => {
    setError(null);
    try {
      const payload = {
        code: String(scheduleForm.code ?? "").trim(),
        name: String(scheduleForm.name ?? "").trim(),
        status: String(scheduleForm.status ?? "active"),
        shift_start: String(scheduleForm.shift_start ?? "09:00"),
        shift_end: String(scheduleForm.shift_end ?? "18:00"),
        late_grace_minutes: Number(scheduleForm.late_grace_minutes ?? 0),
        early_leave_grace_minutes: Number(scheduleForm.early_leave_grace_minutes ?? 0),
        break_start: String(scheduleForm.break_start ?? "12:00"),
        break_end: String(scheduleForm.break_end ?? "13:00"),
        break_duration_minutes: Number(scheduleForm.break_duration_minutes ?? 60),
        break_threshold_hours: Number(scheduleForm.break_threshold_hours ?? 6),
        auto_checkout_time: String(scheduleForm.auto_checkout_time ?? "23:59"),
        department_id: scheduleForm.department_id === null || scheduleForm.department_id === undefined || scheduleForm.department_id === "" ? null : Number(scheduleForm.department_id),
        max_registrations: Number(scheduleForm.max_registrations ?? 0),
        days_of_week: Array.isArray(scheduleForm.days_of_week) ? scheduleForm.days_of_week : [0, 1, 2, 3, 4, 5, 6],
        date_start: scheduleForm.date_start ? String(scheduleForm.date_start) : null,
        date_end: scheduleForm.date_end ? String(scheduleForm.date_end) : null,
        note: scheduleForm.note ? String(scheduleForm.note) : null
      };
      if (editingSchedule) await updateSchedule(editingSchedule.id, payload);
      else await createSchedule(payload as any);
      setOpenScheduleModal(false);
      await reloadSchedules();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  const removeSchedule = async (s: WorkSchedule) => {
    if (!canManage) return;
    // eslint-disable-next-line no-alert
    if (!confirm(`Xoá ca làm "${s.name}"?`)) return;
    setError(null);
    try {
      await deleteSchedule(s.id);
      await reloadSchedules();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  const approve = async (r: WorkScheduleRegistrationListItem) => {
    if (!canApprove) return;
    setError(null);
    try {
      await approveScheduleRegistration(r.id);
      await reloadRegs();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  const approveAllPending = async () => {
    if (!canApprove) return;
    const pending = regItems.filter((x) => x.status === "pending");
    if (!pending.length) return;
    // eslint-disable-next-line no-alert
    if (!confirm(`Duyệt tất cả ${pending.length} yêu cầu pending?`)) return;
    setError(null);
    try {
      for (const r of pending) await approveScheduleRegistration(r.id);
      await reloadRegs();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  const reject = async (r: WorkScheduleRegistrationListItem) => {
    if (!canApprove) return;
    // eslint-disable-next-line no-alert
    const note = prompt("Phản hồi / lý do từ chối (tuỳ chọn):") || "";
    setError(null);
    try {
      await rejectScheduleRegistration(r.id, note.trim() || undefined);
      // eslint-disable-next-line no-alert
      const shouldDelete = confirm("Đã từ chối. Bạn có muốn xoá yêu cầu này khỏi hệ thống không?");
      if (shouldDelete) await deleteScheduleRegistration(r.id);
      await reloadRegs();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  const approveReq = async (r: WorkScheduleRegistrationRequestListItem) => {
    if (!canApprove) return;
    setError(null);
    try {
      await approveRegistrationRequest(r.id);
      await reloadReqs();
      await reloadRegs();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  const rejectReq = async (r: WorkScheduleRegistrationRequestListItem) => {
    if (!canApprove) return;
    // eslint-disable-next-line no-alert
    const note = prompt("Phản hồi / lý do từ chối (tuỳ chọn):") || "";
    setError(null);
    try {
      await rejectRegistrationRequest(r.id, note.trim() || undefined);
      await reloadReqs();
      await reloadRegs();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  return (
    <div className={styles.page}>
      {error ? <div className={styles.errorBox}>⚠️ {error}</div> : null}

      <div className={styles.grid2}>
        <Card
          title="🗓️ Ca làm"
          sub={schedulesLoading ? "Đang tải..." : `${schedules.length} ca`}
          right={
            canManage ? (
              <button className={styles.primaryBtn} type="button" onClick={openCreateSchedule}>
                + Thêm ca
              </button>
            ) : undefined
          }
        >
          <Table>
            <thead>
              <tr>
                <th style={{ width: 64 }}>ID</th>
                <th>Code</th>
                <th>Tên ca</th>
                <th style={{ width: 120 }}>Giờ</th>
                <th style={{ width: 120 }}>Trạng thái</th>
                <th style={{ width: 220 }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td>#{s.id}</td>
                  <td className={styles.mono}>{s.code}</td>
                  <td>{s.name}</td>
                  <td className={styles.mono}>
                    {s.shift_start}–{s.shift_end}
                  </td>
                  <td>
                    <span className={s.status === "active" ? `${styles.tag} ${styles.good}` : `${styles.tag} ${styles.bad}`}>{s.status}</span>
                  </td>
                  <td className={styles.actions}>
                    <button className={styles.smallBtn} type="button" onClick={() => openEditSchedule(s)} disabled={!canManage}>
                      Sửa
                    </button>
                    <button className={styles.smallBtnDanger} type="button" onClick={() => removeSchedule(s)} disabled={!canManage}>
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
              {!schedulesLoading && schedules.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, textAlign: "center", color: "var(--text3)", fontWeight: 800 }}>
                    Chưa có ca làm
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </Card>

        <Card
          title="🧺 Duyệt theo đợt (1 lần cho nhiều ngày)"
          sub={reqLoading ? "Đang tải..." : `${reqItems.length} yêu cầu`}
          right={
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <select value={reqStatus} onChange={(e) => setReqStatus(e.target.value)} aria-label="Lọc trạng thái">
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
                <option value="cancelled">cancelled</option>
                <option value="">all</option>
              </select>
            </div>
          }
        >
          <Table>
            <thead>
              <tr>
                <th style={{ width: 70 }}>ID</th>
                <th>Nhân viên</th>
                <th>Ca</th>
                <th style={{ width: 220 }}>Khoảng ngày</th>
                <th style={{ width: 110 }}>Trạng thái</th>
                <th style={{ width: 220 }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {reqItems.map((r) => (
                <tr key={r.id}>
                  <td className={styles.mono}>#{r.id}</td>
                  <td>
                    {r.user_name} {r.user_code ? <span style={{ color: "var(--text3)", fontWeight: 800 }}>({r.user_code})</span> : null}
                  </td>
                  <td>{r.schedule_name}</td>
                  <td className={styles.mono}>
                    {r.date_from} → {r.date_to}
                  </td>
                  <td>
                    <span className={r.status === "approved" ? `${styles.tag} ${styles.good}` : r.status === "pending" ? styles.tag : `${styles.tag} ${styles.bad}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className={styles.actions}>
                    <button className={styles.smallBtn} type="button" disabled={!canApprove || r.status !== "pending"} onClick={() => approveReq(r)}>
                      Duyệt
                    </button>
                    <button className={styles.smallBtnDanger} type="button" disabled={!canApprove || r.status !== "pending"} onClick={() => rejectReq(r)}>
                      Từ chối
                    </button>
                  </td>
                </tr>
              ))}
              {!reqLoading && reqItems.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, textAlign: "center", color: "var(--text3)", fontWeight: 800 }}>
                    Không có dữ liệu
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </Card>

      </div>

      <Modal
        open={openScheduleModal}
        title={editingSchedule ? "Sửa ca làm" : "Thêm ca làm"}
        onClose={() => setOpenScheduleModal(false)}
        modalClassName={styles.scheduleModal}
        footer={
          <>
            <button className={styles.secondaryBtn} type="button" onClick={() => setOpenScheduleModal(false)}>
              Huỷ
            </button>
            <button
              className={styles.primaryBtn}
              type="button"
              onClick={saveSchedule}
              disabled={!String(scheduleForm.code ?? "").trim() || !String(scheduleForm.name ?? "").trim()}
            >
              Lưu
            </button>
          </>
        }
      >
        <div className={styles.form}>
          <div>
            <div className={styles.sectionTitle}>Thông tin ca</div>
            <div className={styles.sectionSub}>Thiết lập tên, bộ phận, số lượng và ngày áp dụng</div>
          </div>

          <label>
            <div className={styles.label}>Code</div>
            <input value={String(scheduleForm.code ?? "")} onChange={(e) => setScheduleForm((p) => ({ ...p, code: e.target.value }))} placeholder="vd: ca_sang" />
          </label>
          <label>
            <div className={styles.label}>Tên ca</div>
            <input value={String(scheduleForm.name ?? "")} onChange={(e) => setScheduleForm((p) => ({ ...p, name: e.target.value }))} placeholder="vd: Ca sáng 8-17" />
          </label>

          <div className={styles.row3}>
            <label>
              <div className={styles.label}>Bộ phận</div>
              <select
                value={scheduleForm.department_id === null || scheduleForm.department_id === undefined ? "" : String(scheduleForm.department_id)}
                onChange={(e) => setScheduleForm((p) => ({ ...p, department_id: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">Tất cả</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className={styles.label}>Số người tối đa</div>
              <input
                type="number"
                min={0}
                value={Number(scheduleForm.max_registrations ?? 0)}
                onChange={(e) => setScheduleForm((p) => ({ ...p, max_registrations: Number(e.target.value) }))}
              />
              <div className={styles.hint}>0 = không giới hạn</div>
            </label>
            <label>
              <div className={styles.label}>Trạng thái</div>
              <select value={String(scheduleForm.status ?? "active")} onChange={(e) => setScheduleForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </label>
          </div>

          <label>
            <div className={styles.label}>Ngày trong tuần áp dụng</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                const cur = Array.isArray(scheduleForm.days_of_week) ? scheduleForm.days_of_week : [0, 1, 2, 3, 4, 5, 6];
                const active = cur.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    className={active ? `${styles.dowChip} ${styles.dowChipActive}` : styles.dowChip}
                    onClick={() =>
                      setScheduleForm((p) => {
                        const list = Array.isArray(p.days_of_week) ? [...p.days_of_week] : [0, 1, 2, 3, 4, 5, 6];
                        const next = list.includes(d) ? list.filter((x) => x !== d) : [...list, d];
                        next.sort((a, b) => a - b);
                        return { ...p, days_of_week: next.length ? next : list };
                      })
                    }
                  >
                    {DOW_LABEL[d]}
                  </button>
                );
              })}
            </div>
          </label>

          <div className={styles.row2}>
            <label>
              <div className={styles.label}>Ngày bắt đầu áp dụng</div>
              <input
                type="date"
                value={scheduleForm.date_start ? String(scheduleForm.date_start) : ""}
                onChange={(e) => setScheduleForm((p) => ({ ...p, date_start: e.target.value || null }))}
              />
            </label>
            <label>
              <div className={styles.label}>Ngày kết thúc</div>
              <input
                type="date"
                value={scheduleForm.date_end ? String(scheduleForm.date_end) : ""}
                onChange={(e) => setScheduleForm((p) => ({ ...p, date_end: e.target.value || null }))}
              />
            </label>
          </div>

          <div className={styles.divider} />
          <div>
            <div className={styles.sectionTitle}>Thời gian & quy định</div>
            <div className={styles.sectionSub}>Cấu hình giờ làm, nghỉ và auto checkout</div>
          </div>

          <div className={styles.row2}>
            <label>
              <div className={styles.label}>Giờ bắt đầu</div>
              <input value={String(scheduleForm.shift_start ?? "09:00")} onChange={(e) => setScheduleForm((p) => ({ ...p, shift_start: e.target.value }))} placeholder="HH:MM" />
            </label>
            <label>
              <div className={styles.label}>Giờ kết thúc</div>
              <input value={String(scheduleForm.shift_end ?? "18:00")} onChange={(e) => setScheduleForm((p) => ({ ...p, shift_end: e.target.value }))} placeholder="HH:MM" />
            </label>
          </div>

          <div className={styles.row2}>
            <label>
              <div className={styles.label}>Grace đi trễ (phút)</div>
              <input
                type="number"
                min={0}
                value={Number(scheduleForm.late_grace_minutes ?? 0)}
                onChange={(e) => setScheduleForm((p) => ({ ...p, late_grace_minutes: Number(e.target.value) }))}
              />
            </label>
            <label>
              <div className={styles.label}>Grace về sớm (phút)</div>
              <input
                type="number"
                min={0}
                value={Number(scheduleForm.early_leave_grace_minutes ?? 0)}
                onChange={(e) => setScheduleForm((p) => ({ ...p, early_leave_grace_minutes: Number(e.target.value) }))}
              />
            </label>
          </div>

          <div className={styles.row2}>
            <label>
              <div className={styles.label}>Nghỉ trưa bắt đầu</div>
              <input value={String(scheduleForm.break_start ?? "12:00")} onChange={(e) => setScheduleForm((p) => ({ ...p, break_start: e.target.value }))} placeholder="HH:MM" />
            </label>
            <label>
              <div className={styles.label}>Nghỉ trưa kết thúc</div>
              <input value={String(scheduleForm.break_end ?? "13:00")} onChange={(e) => setScheduleForm((p) => ({ ...p, break_end: e.target.value }))} placeholder="HH:MM" />
            </label>
          </div>

          <div className={styles.row2}>
            <label>
              <div className={styles.label}>Số phút nghỉ trừ</div>
              <input
                type="number"
                min={0}
                value={Number(scheduleForm.break_duration_minutes ?? 60)}
                onChange={(e) => setScheduleForm((p) => ({ ...p, break_duration_minutes: Number(e.target.value) }))}
              />
            </label>
            <label>
              <div className={styles.label}>Ngưỡng trừ nghỉ (giờ)</div>
              <input
                type="number"
                min={0}
                step={0.5}
                value={Number(scheduleForm.break_threshold_hours ?? 6)}
                onChange={(e) => setScheduleForm((p) => ({ ...p, break_threshold_hours: Number(e.target.value) }))}
              />
            </label>
          </div>

          <label>
            <div className={styles.label}>Auto checkout</div>
            <input
              value={String(scheduleForm.auto_checkout_time ?? "23:59")}
              onChange={(e) => setScheduleForm((p) => ({ ...p, auto_checkout_time: e.target.value }))}
              placeholder="HH:MM"
            />
            <div className={styles.hint}>Dùng khi nhân viên quên check-out.</div>
          </label>

          <label>
            <div className={styles.label}>Ghi chú cho nhân viên</div>
            <input value={String(scheduleForm.note ?? "")} onChange={(e) => setScheduleForm((p) => ({ ...p, note: e.target.value }))} placeholder="VD: trang phục, lưu ý..." />
          </label>
        </div>
      </Modal>
    </div>
  );
}

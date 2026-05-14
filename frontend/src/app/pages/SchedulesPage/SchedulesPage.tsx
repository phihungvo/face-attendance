import { useEffect, useMemo, useState } from "react";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  PlusOutlined,
  SunOutlined,
  MoonOutlined
} from "@ant-design/icons";
import Card from "../../components/Card/Card";
import Modal from "../../components/Modal/Modal";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import { useAuth } from "../../../shared/auth/auth";
import { viStatusLabel } from "../../../shared/i18n/vi";
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
const REQ_STATUSES: Array<{ key: string; label: string }> = [
  { key: "pending", label: viStatusLabel("pending") },
  { key: "approved", label: viStatusLabel("approved") },
  { key: "rejected", label: viStatusLabel("rejected") },
  { key: "cancelled", label: viStatusLabel("cancelled") },
  { key: "", label: "Tất cả" }
];
const REG_STATUSES: Array<{ key: string; label: string }> = [
  { key: "pending", label: viStatusLabel("pending") },
  { key: "approved", label: viStatusLabel("approved") },
  { key: "rejected", label: viStatusLabel("rejected") },
  { key: "", label: "Tất cả" }
];

export default function SchedulesPage() {
  const auth = useAuth();
  const canManage = useMemo(() => auth.permissionKeys.includes("schedules.manage"), [auth.permissionKeys]);
  const canApprove = useMemo(() => auth.permissionKeys.includes("schedules.approve"), [auth.permissionKeys]);

  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"schedules" | "requests" | "registrations">("schedules");

  const [schedulesLoading, setSchedulesLoading] = useState(true);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [openScheduleModal, setOpenScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
  const [scheduleForm, setScheduleForm] = useState<Partial<WorkSchedule>>(() => defaultScheduleForm());
  const [scheduleQuery, setScheduleQuery] = useState("");
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<"" | "active" | "inactive">("");
  const [schedulePageSize, setSchedulePageSize] = useState<number>(12);
  const [schedulePage, setSchedulePage] = useState<number>(0);

  const [regLoading, setRegLoading] = useState(true);
  const [regItems, setRegItems] = useState<WorkScheduleRegistrationListItem[]>([]);
  const [regStatus, setRegStatus] = useState<string>("pending");
  const [regLimit, setRegLimit] = useState<number>(12);
  const [regOffset, setRegOffset] = useState<number>(0);
  const [regTotal, setRegTotal] = useState<number>(0);

  const [reqLoading, setReqLoading] = useState(true);
  const [reqItems, setReqItems] = useState<WorkScheduleRegistrationRequestListItem[]>([]);
  const [reqStatus, setReqStatus] = useState<string>("pending");
  const [reqLimit, setReqLimit] = useState<number>(12);
  const [reqOffset, setReqOffset] = useState<number>(0);
  const [reqTotal, setReqTotal] = useState<number>(0);

  const filteredSchedules = useMemo(() => {
    const q = scheduleQuery.trim().toLowerCase();
    let items = schedules;
    if (scheduleStatusFilter) items = items.filter((s) => s.status === scheduleStatusFilter);
    if (!q) return items;
    return items.filter((s) => `${s.code} ${s.name} ${s.id}`.toLowerCase().includes(q));
  }, [scheduleQuery, scheduleStatusFilter, schedules]);

  const schedulesTotalFiltered = filteredSchedules.length;
  const schedulesTotalPages = Math.max(1, Math.ceil(schedulesTotalFiltered / Math.max(1, schedulePageSize)));
  const schedulePageClamped = Math.min(Math.max(0, schedulePage), schedulesTotalPages - 1);
  const pagedSchedules = useMemo(() => {
    const start = schedulePageClamped * schedulePageSize;
    return filteredSchedules.slice(start, start + schedulePageSize);
  }, [filteredSchedules, schedulePageClamped, schedulePageSize]);

  const scheduleStats = useMemo(() => {
    let active = 0;
    let inactive = 0;
    for (const s of schedules) {
      if (s.status === "active") active += 1;
      else inactive += 1;
    }
    return { active, inactive };
  }, [schedules]);

  const deptById = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);

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
      const res = await listScheduleRegistrations({ limit: regLimit, offset: regOffset, status: regStatus || undefined });
      setRegItems(res.items ?? []);
      setRegTotal(Number(res.total ?? 0));
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
      const res = await listRegistrationRequests({ limit: reqLimit, offset: reqOffset, status: reqStatus || undefined });
      setReqItems(res.items ?? []);
      setReqTotal(Number(res.total ?? 0));
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
  }, [regStatus, regLimit, regOffset]);

  useEffect(() => {
    reloadReqs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqStatus, reqLimit, reqOffset]);

  useEffect(() => {
    setSchedulePage(0);
  }, [scheduleQuery, scheduleStatusFilter, schedulePageSize]);

  useEffect(() => {
    setReqOffset(0);
  }, [reqStatus, reqLimit]);

  useEffect(() => {
    setRegOffset(0);
  }, [regStatus, regLimit]);

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
    if (!confirm(`Duyệt tất cả ${pending.length} yêu cầu ${viStatusLabel("pending").toLowerCase()}?`)) return;
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

  const scheduleIconKind = (s: WorkSchedule) => {
    const start = String(s.shift_start ?? "");
    const h = Number(start.split(":")[0] || 0);
    if (h >= 5 && h < 12) return "morning";
    if (h >= 12 && h < 18) return "day";
    return "night";
  };

  const scheduleSubtitle = (s: WorkSchedule) => {
    const parts: string[] = [];
    parts.push(`${s.shift_start}–${s.shift_end}`);
    if (s.department_id != null) {
      const name = deptById.get(Number(s.department_id))?.name;
      if (name) parts.push(name);
    }
    if (Number(s.max_registrations ?? 0) > 0) parts.push(`Tối đa ${Number(s.max_registrations)} người`);
    return parts.join(" • ");
  };

  return (
    <div className={styles.page}>
      {error ? <div className={styles.errorBox}>⚠️ {error}</div> : null}

      <div className={styles.shell}>
        <div className={styles.hero}>
          <div className={styles.heroLeft}>
            <div className={styles.heroTitle}>
              <CalendarOutlined /> Ca làm
            </div>
            <div className={styles.heroSub}>
              {schedulesLoading
                ? "Đang tải dữ liệu…"
                : `${schedules.length} ca • ${scheduleStats.active} ${viStatusLabel("active")} • ${scheduleStats.inactive} ${viStatusLabel("inactive")}`}
            </div>
          </div>
          {canManage ? (
            <button className={styles.heroCta} type="button" onClick={openCreateSchedule}>
              <PlusOutlined /> Thêm ca
            </button>
          ) : null}
        </div>

        <div className={styles.topTabs} role="tablist" aria-label="Chế độ xem">
          <button
            type="button"
            className={tab === "schedules" ? `${styles.topTab} ${styles.topTabActive}` : styles.topTab}
            onClick={() => setTab("schedules")}
            role="tab"
            aria-selected={tab === "schedules"}
          >
            <CalendarOutlined /> Ca làm
            <span className={styles.topTabCount}>{schedulesLoading ? "…" : String(schedules.length)}</span>
          </button>
          <button
            type="button"
            className={tab === "requests" ? `${styles.topTab} ${styles.topTabActive}` : styles.topTab}
            onClick={() => setTab("requests")}
            role="tab"
            aria-selected={tab === "requests"}
          >
            <FileTextOutlined /> Duyệt theo đợt
            <span className={styles.topTabCount}>{reqLoading ? "…" : String(reqItems.length)}</span>
          </button>
          <button
            type="button"
            className={tab === "registrations" ? `${styles.topTab} ${styles.topTabActive}` : styles.topTab}
            onClick={() => setTab("registrations")}
            role="tab"
            aria-selected={tab === "registrations"}
          >
            <FileDoneOutlined /> Duyệt theo lẻ
            <span className={styles.topTabCount}>{regLoading ? "…" : String(regItems.length)}</span>
          </button>
        </div>

        {tab === "schedules" ? (
          <Card
            title="Danh sách ca"
            sub={
              schedulesLoading
                ? "Đang tải..."
                : `${schedulesTotalFiltered} kết quả • Trang ${schedulePageClamped + 1}/${schedulesTotalPages}`
            }
            right={
              <div className={styles.headerTools}>
                <div className={styles.searchWrap}>
                  <input
                    className={styles.searchInput}
                    value={scheduleQuery}
                    onChange={(e) => setScheduleQuery(e.target.value)}
                    placeholder="Tìm theo code / tên / id…"
                    aria-label="Tìm ca làm"
                  />
                </div>
                <div className={styles.segmented} role="tablist" aria-label="Lọc trạng thái ca">
                  {[
                    { key: "", label: "Tất cả" },
                    { key: "active", label: viStatusLabel("active") },
                    { key: "inactive", label: viStatusLabel("inactive") }
                  ].map((x) => {
                    const active = scheduleStatusFilter === (x.key as any);
                    return (
                      <button
                        key={x.key || "all"}
                        type="button"
                        className={active ? `${styles.segBtn} ${styles.segActive}` : styles.segBtn}
                        onClick={() => setScheduleStatusFilter(x.key as any)}
                        aria-pressed={active}
                      >
                        {x.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            }
          >
            <div className={styles.cardsGrid}>
              {pagedSchedules.map((s) => (
                <div key={s.id} className={styles.scheduleCard}>
                  <div
                    className={
                      scheduleIconKind(s) === "morning"
                        ? `${styles.cardIcon} ${styles.iconMorning}`
                        : scheduleIconKind(s) === "day"
                          ? `${styles.cardIcon} ${styles.iconDay}`
                          : `${styles.cardIcon} ${styles.iconNight}`
                    }
                    aria-hidden="true"
                  >
                    {scheduleIconKind(s) === "night" ? <MoonOutlined /> : scheduleIconKind(s) === "morning" ? <SunOutlined /> : <ClockCircleOutlined />}
                  </div>
                  <div className={styles.cardMain}>
                    <div className={styles.cardTitleRow}>
                      <div className={styles.cardTitle}>
                        {s.name} <span className={styles.cardId}>#{s.id}</span>
                      </div>
                      <span className={styles.cardCode}>{s.code}</span>
                    </div>
                    <div className={styles.cardSub}>{scheduleSubtitle(s)}</div>
                    <div className={styles.cardChips} aria-label="Ngày áp dụng">
                      {(s.days_of_week?.length ? [...s.days_of_week].sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6]).map((d) => (
                        <span key={d} className={styles.dayChip}>
                          {DOW_LABEL[d] ?? String(d)}
                        </span>
                      ))}
                      {s.date_start ? <span className={styles.metaChip}>Từ {String(s.date_start)}</span> : null}
                      {s.date_end ? <span className={styles.metaChip}>Đến {String(s.date_end)}</span> : null}
                    </div>
                  </div>
                  <div className={styles.cardRight}>
                    <span className={s.status === "active" ? `${styles.tag} ${styles.good}` : `${styles.tag} ${styles.bad}`}>
                      {viStatusLabel(s.status)}
                    </span>
                    <div className={styles.cardActions}>
                      <button className={styles.iconBtn} type="button" onClick={() => openEditSchedule(s)} disabled={!canManage} aria-label={`Sửa ${s.name}`}>
                        <EditOutlined />
                      </button>
                      <button className={styles.iconBtnDanger} type="button" onClick={() => removeSchedule(s)} disabled={!canManage} aria-label={`Xoá ${s.name}`}>
                        <DeleteOutlined />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {!schedulesLoading && schedulesTotalFiltered === 0 ? (
                <div className={styles.emptyState}>{schedules.length ? "Không tìm thấy ca phù hợp" : "Chưa có ca làm"}</div>
              ) : null}
            </div>

            {!schedulesLoading && schedulesTotalFiltered > 0 ? (
                <div className={styles.pager}>
                  <div className={styles.pagerLeft}>
                    <button
                      className={styles.pageBtn}
                      type="button"
                      onClick={() => setSchedulePage((p) => Math.max(0, p - 1))}
                      disabled={schedulePageClamped <= 0}
                    >
                    ← Trước
                    </button>
                    <button
                      className={styles.pageBtn}
                      type="button"
                      onClick={() => setSchedulePage((p) => Math.min(schedulesTotalPages - 1, p + 1))}
                      disabled={schedulePageClamped >= schedulesTotalPages - 1}
                    >
                    Sau →
                    </button>
                  </div>
                <div className={styles.pagerMid}>
                  <span className={styles.pagerHint}>
                    Trang <b>{schedulePageClamped + 1}</b>/<b>{schedulesTotalPages}</b>
                  </span>
                </div>
                <div className={styles.pagerRight}>
                  <select
                    className={styles.pageSelect}
                    value={String(schedulePageSize)}
                    onChange={(e) => setSchedulePageSize(Number(e.target.value))}
                    aria-label="Số dòng mỗi trang"
                  >
                    {[8, 12, 20, 36].map((n) => (
                      <option key={n} value={String(n)}>
                        {n}/trang
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
          </Card>
        ) : tab === "requests" ? (
          <Card
            title={
              <>
                <FileTextOutlined /> Duyệt theo đợt
              </>
            }
            sub={reqLoading ? "Đang tải..." : `${reqTotal} yêu cầu • ${reqItems.length} hiển thị`}
            right={
              <div className={styles.headerTools}>
                <div className={styles.segmented} role="tablist" aria-label="Lọc trạng thái">
                  {REQ_STATUSES.map((s) => {
                    const active = reqStatus === s.key;
                    return (
                      <button
                        key={s.key || "all"}
                        type="button"
                        className={active ? `${styles.segBtn} ${styles.segActive}` : styles.segBtn}
                        onClick={() => setReqStatus(s.key)}
                        role="tab"
                        aria-selected={active}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            }
          >
            <div className={styles.cardsGrid}>
              {reqItems.map((r) => (
                <div key={r.id} className={styles.reqCard}>
                  <div className={styles.reqMain}>
                    <div className={styles.reqTitleRow}>
                      <div className={styles.reqTitle}>
                        {r.user_name} {r.user_code ? <span className={styles.reqMuted}>({r.user_code})</span> : null}{" "}
                        <span className={styles.reqId}>#{r.id}</span>
                      </div>
                      <span className={styles.reqRange}>
                        {r.date_from} → {r.date_to}
                      </span>
                    </div>
                    <div className={styles.reqSub}>
                      <span className={styles.reqSchedule}>{r.schedule_name}</span>
                    </div>
                  </div>
                  <div className={styles.reqRight}>
                    <span className={r.status === "approved" ? `${styles.tag} ${styles.good}` : r.status === "pending" ? styles.tag : `${styles.tag} ${styles.bad}`}>
                      {viStatusLabel(r.status)}
                    </span>
                    <div className={styles.cardActions}>
                      <button className={styles.iconBtn} type="button" disabled={!canApprove || r.status !== "pending"} onClick={() => approveReq(r)} aria-label={`Duyệt yêu cầu ${r.id}`}>
                        <CheckOutlined />
                      </button>
                      <button
                        className={styles.iconBtnDanger}
                        type="button"
                        disabled={!canApprove || r.status !== "pending"}
                        onClick={() => rejectReq(r)}
                        aria-label={`Từ chối yêu cầu ${r.id}`}
                      >
                        <CloseOutlined />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {!reqLoading && reqItems.length === 0 ? <div className={styles.emptyState}>Không có dữ liệu</div> : null}
            </div>

            {!reqLoading && reqTotal > 0 ? (
              <div className={styles.pager}>
                <div className={styles.pagerLeft}>
                  <button className={styles.pageBtn} type="button" onClick={() => setReqOffset((o) => Math.max(0, o - reqLimit))} disabled={reqOffset <= 0}>
                    ← Trước
                  </button>
                  <button
                    className={styles.pageBtn}
                    type="button"
                    onClick={() => setReqOffset((o) => (o + reqLimit < reqTotal ? o + reqLimit : o))}
                    disabled={reqOffset + reqLimit >= reqTotal}
                  >
                    Sau →
                  </button>
                </div>
                <div className={styles.pagerMid}>
                  <span className={styles.pagerHint}>
                    {reqOffset + 1}–{Math.min(reqOffset + reqLimit, reqTotal)} / {reqTotal}
                  </span>
                </div>
                <div className={styles.pagerRight}>
                  <select className={styles.pageSelect} value={String(reqLimit)} onChange={(e) => setReqLimit(Number(e.target.value))} aria-label="Số dòng mỗi trang">
                    {[8, 12, 20, 36].map((n) => (
                      <option key={n} value={String(n)}>
                        {n}/trang
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
          </Card>
        ) : (
          <Card
            title={
              <>
                <FileDoneOutlined /> Duyệt theo lẻ
              </>
            }
            sub={regLoading ? "Đang tải..." : `${regTotal} yêu cầu • ${regItems.length} hiển thị`}
            right={
              <div className={styles.headerTools}>
                <div className={styles.segmented} role="tablist" aria-label="Lọc trạng thái">
                  {REG_STATUSES.map((s) => {
                    const active = regStatus === s.key;
                    return (
                      <button
                        key={s.key || "all"}
                        type="button"
                        className={active ? `${styles.segBtn} ${styles.segActive}` : styles.segBtn}
                        onClick={() => setRegStatus(s.key)}
                        role="tab"
                        aria-selected={active}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                {canApprove && regItems.some((x) => x.status === "pending") ? (
                  <button className={styles.primaryBtn} type="button" onClick={approveAllPending} disabled={regLoading || regStatus !== "pending"}>
                    <CheckCircleOutlined /> Duyệt tất cả {viStatusLabel("pending").toLowerCase()}
                  </button>
                ) : null}
              </div>
            }
          >
            <div className={styles.cardsGrid}>
              {regItems.map((r) => (
                <div key={r.id} className={styles.reqCard}>
                  <div className={styles.reqMain}>
                    <div className={styles.reqTitleRow}>
                      <div className={styles.reqTitle}>
                        {r.user_name} {r.user_code ? <span className={styles.reqMuted}>({r.user_code})</span> : null}{" "}
                        <span className={styles.reqId}>#{r.id}</span>
                      </div>
                      <span className={styles.reqRange}>{r.day}</span>
                    </div>
                    <div className={styles.reqSub}>
                      <span className={styles.reqSchedule}>
                        {r.schedule_name} <span className={styles.reqMuted}>({r.schedule_code})</span>
                      </span>
                    </div>
                  </div>
                  <div className={styles.reqRight}>
                    <span className={r.status === "approved" ? `${styles.tag} ${styles.good}` : r.status === "pending" ? styles.tag : `${styles.tag} ${styles.bad}`}>
                      {viStatusLabel(r.status)}
                    </span>
                    <div className={styles.cardActions}>
                      <button className={styles.iconBtn} type="button" disabled={!canApprove || r.status !== "pending"} onClick={() => approve(r)} aria-label={`Duyệt yêu cầu ${r.id}`}>
                        <CheckOutlined />
                      </button>
                      <button
                        className={styles.iconBtnDanger}
                        type="button"
                        disabled={!canApprove || r.status !== "pending"}
                        onClick={() => reject(r)}
                        aria-label={`Từ chối yêu cầu ${r.id}`}
                      >
                        <CloseOutlined />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {!regLoading && regItems.length === 0 ? <div className={styles.emptyState}>Không có dữ liệu</div> : null}
            </div>

            {!regLoading && regTotal > 0 ? (
              <div className={styles.pager}>
                <div className={styles.pagerLeft}>
                  <button className={styles.pageBtn} type="button" onClick={() => setRegOffset((o) => Math.max(0, o - regLimit))} disabled={regOffset <= 0}>
                    ← Trước
                  </button>
                  <button
                    className={styles.pageBtn}
                    type="button"
                    onClick={() => setRegOffset((o) => (o + regLimit < regTotal ? o + regLimit : o))}
                    disabled={regOffset + regLimit >= regTotal}
                  >
                    Sau →
                  </button>
                </div>
                <div className={styles.pagerMid}>
                  <span className={styles.pagerHint}>
                    {regOffset + 1}–{Math.min(regOffset + regLimit, regTotal)} / {regTotal}
                  </span>
                </div>
                <div className={styles.pagerRight}>
                  <select className={styles.pageSelect} value={String(regLimit)} onChange={(e) => setRegLimit(Number(e.target.value))} aria-label="Số dòng mỗi trang">
                    {[8, 12, 20, 36].map((n) => (
                      <option key={n} value={String(n)}>
                        {n}/trang
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
          </Card>
        )}
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
                <option value="active">{viStatusLabel("active")}</option>
                <option value="inactive">{viStatusLabel("inactive")}</option>
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

import { useEffect, useMemo, useState } from "react";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  CloudOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
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

function statusTone(status: string) {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return "pending";
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  return parts
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
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
  const canReadDepartments = useMemo(() => auth.permissionKeys.includes("departments.read"), [auth.permissionKeys]);

  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"schedules" | "calendar" | "requests">("calendar");

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

  const [reqLoading, setReqLoading] = useState(true);
  const [reqItems, setReqItems] = useState<WorkScheduleRegistrationRequestListItem[]>([]);
  const [reqStatus, setReqStatus] = useState<string>("pending");
  const [reqQuery, setReqQuery] = useState<string>("");
  const [reqQueryApplied, setReqQueryApplied] = useState<string>("");
  const [reqLimit, setReqLimit] = useState<number>(12);
  const [reqOffset, setReqOffset] = useState<number>(0);
  const [reqTotal, setReqTotal] = useState<number>(0);

  const [calLoading, setCalLoading] = useState<boolean>(true);
  const [calYear, setCalYear] = useState<number>(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState<number>(() => new Date().getMonth()); // 0-index
  const [calDepartmentId, setCalDepartmentId] = useState<number | "">("");
  const [calUserQuery, setCalUserQuery] = useState<string>("");
  const [calUserSearch, setCalUserSearch] = useState<string>("");
  const [calUserId, setCalUserId] = useState<number | "">("");
  const [calStatus, setCalStatus] = useState<string>(""); // "" = all
  const [calRegs, setCalRegs] = useState<WorkScheduleRegistrationListItem[]>([]);
  const [calTotal, setCalTotal] = useState<number>(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayActionLoading, setDayActionLoading] = useState(false);

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

  function normalizeYmd(v: unknown): string {
    if (!v) return "";
    if (typeof v === "string") {
      if (/^\\d{4}-\\d{2}-\\d{2}$/.test(v)) return v;
      const m = v.match(/^(\\d{4}-\\d{2}-\\d{2})/);
      if (m) return m[1];
      const dt = new Date(v);
      if (!Number.isNaN(dt.getTime())) {
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      }
      return v;
    }
    if (v instanceof Date) {
      return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
    }
    return String(v);
  }

  function weekdayMon0(ymd: string) {
    const d = new Date(`${ymd}T00:00:00`);
    const js = d.getDay(); // Sun=0
    return (js + 6) % 7; // Mon=0
  }

  function formatMonthTitle(year: number, month0: number) {
    const dt = new Date(year, month0, 1);
    return dt.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
  }

  function formatDateVi(ymd: string) {
    const dt = new Date(`${ymd}T00:00:00`);
    return dt.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
  }

  const calendarRange = useMemo(() => {
    const firstOfMonth = new Date(calYear, calMonth, 1);
    const firstYmd = `${firstOfMonth.getFullYear()}-${String(firstOfMonth.getMonth() + 1).padStart(2, "0")}-${String(firstOfMonth.getDate()).padStart(2, "0")}`;
    const startOffset = weekdayMon0(firstYmd);
    const gridStart = new Date(calYear, calMonth, 1 - startOffset);
    const gridEnd = new Date(calYear, calMonth, 1 - startOffset + 41);
    const from = `${gridStart.getFullYear()}-${String(gridStart.getMonth() + 1).padStart(2, "0")}-${String(gridStart.getDate()).padStart(2, "0")}`;
    const to = `${gridEnd.getFullYear()}-${String(gridEnd.getMonth() + 1).padStart(2, "0")}-${String(gridEnd.getDate()).padStart(2, "0")}`;
    return { from, to };
  }, [calMonth, calYear]);

  const calendarDays = useMemo(() => {
    const out: Array<{ ymd: string; inMonth: boolean; dayNum: number }> = [];
    const start = new Date(`${calendarRange.from}T00:00:00`);
    for (let i = 0; i < 42; i++) {
      const dt = new Date(start);
      dt.setDate(dt.getDate() + i);
      const ymd = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      out.push({ ymd, inMonth: dt.getMonth() === calMonth, dayNum: dt.getDate() });
    }
    return out;
  }, [calMonth, calendarRange.from]);

  const scheduleById = useMemo(() => new Map(schedules.map((s) => [s.id, s])), [schedules]);

  const calByDay = useMemo(() => {
    const m = new Map<string, WorkScheduleRegistrationListItem[]>();
    for (const it of calRegs) {
      const key = normalizeYmd(it.day);
      if (!key) continue;
      const arr = m.get(key) ?? [];
      arr.push(it);
      m.set(key, arr);
    }
    for (const [, arr] of m) arr.sort((a, b) => a.id - b.id);
    return m;
  }, [calRegs]);

  const dayStats = (items: WorkScheduleRegistrationListItem[]) => {
    const pending = items.filter((x) => x.status === "pending").length;
    const approved = items.filter((x) => x.status === "approved").length;
    const rejected = items.filter((x) => x.status === "rejected").length;
    return { total: items.length, pending, approved, rejected };
  };

  const clearCalendarUserFilter = () => {
    setCalUserId("");
    setCalUserQuery("");
    setCalUserSearch("");
    setUserSuggestions([]);
  };

  const reloadSchedules = async () => {
    setSchedulesLoading(true);
    setError(null);
    try {
      const items = await listSchedules({ limit: 500, offset: 0 });
      setSchedules(items);
      if (canManage || canReadDepartments) {
        const depts = await listDepartments({ limit: 500, offset: 0 });
        setDepartments(depts);
      }
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSchedulesLoading(false);
    }
  };

  const reloadReqs = async () => {
    setReqLoading(true);
    setError(null);
    try {
      const res = await listRegistrationRequests({
        limit: reqLimit,
        offset: reqOffset,
        status: reqStatus || undefined,
        q: reqQueryApplied || undefined
      });
      setReqItems(res.items ?? []);
      setReqTotal(Number(res.total ?? 0));
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setReqLoading(false);
    }
  };

  const reloadCalendar = async () => {
    setCalLoading(true);
    setError(null);
    try {
      const pageLimit = 500; // backend validation cap
      const maxItems = 2000; // UI cap for performance; encourages filtering when very large

      const all: WorkScheduleRegistrationListItem[] = [];
      let offset = 0;
      let total = 0;

      for (let i = 0; i < 20; i++) {
        const q = calUserId === "" ? calUserSearch : "";
        const res = await listScheduleRegistrations({
          from_date: calendarRange.from,
          to_date: calendarRange.to,
          status: calStatus || undefined,
          user_id: calUserId === "" ? undefined : Number(calUserId),
          q: q || undefined,
          department_id: calDepartmentId === "" ? undefined : Number(calDepartmentId),
          limit: pageLimit,
          offset
        });
        const items = res.items ?? [];
        total = Number(res.total ?? total ?? 0);
        all.push(...items);
        offset += items.length;
        if (items.length < pageLimit) break;
        if (all.length >= Math.min(maxItems, total || maxItems)) break;
      }

      setCalRegs(all.slice(0, maxItems));
      setCalTotal(total);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setCalLoading(false);
    }
  };

  const [userSuggestions, setUserSuggestions] = useState<Array<{ id: number; name: string; code?: string | null }>>([]);
  useEffect(() => {
    let alive = true;
    const q = calUserQuery.trim();
    if (!q) {
      setUserSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { listUsers } = await import("../../../shared/api/users");
        const items = await listUsers({ q, limit: 12, offset: 0 });
        if (!alive) return;
        setUserSuggestions(items.map((u) => ({ id: u.id, name: u.name, code: (u as any).code ?? null })));
      } catch {
        if (!alive) return;
        setUserSuggestions([]);
      }
    }, 220);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [calUserQuery]);

  useEffect(() => {
    reloadSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setReqQueryApplied(reqQuery.trim()), 250);
    return () => window.clearTimeout(t);
  }, [reqQuery]);

  useEffect(() => {
    const t = window.setTimeout(() => setCalUserSearch(calUserQuery.trim()), 250);
    return () => window.clearTimeout(t);
  }, [calUserQuery]);

  useEffect(() => {
    reloadReqs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqStatus, reqQueryApplied, reqLimit, reqOffset]);

  useEffect(() => {
    if (tab !== "calendar") return;
    reloadCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, calendarRange.from, calendarRange.to, calDepartmentId, calUserId, calUserSearch, calStatus]);

  useEffect(() => {
    setSchedulePage(0);
  }, [scheduleQuery, scheduleStatusFilter, schedulePageSize]);

  useEffect(() => {
    setReqOffset(0);
  }, [reqStatus, reqQueryApplied, reqLimit]);

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

  const approveReq = async (r: WorkScheduleRegistrationRequestListItem) => {
    if (!canApprove) return;
    setError(null);
    try {
      await approveRegistrationRequest(r.id);
      await reloadReqs();
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

  const scheduleHeaderIcon = (s?: WorkSchedule | null) => {
    if (!s) return <ClockCircleOutlined />;
    const kind = scheduleIconKind(s);
    if (kind === "morning") return <SunOutlined />;
    if (kind === "night") return <MoonOutlined />;
    return <CloudOutlined />;
  };

  const goPrevMonth = () => {
    setCalMonth((m) => {
      if (m === 0) {
        setCalYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  };

  const goNextMonth = () => {
    setCalMonth((m) => {
      if (m === 11) {
        setCalYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  };

  const dayRegs = selectedDay ? calByDay.get(selectedDay) ?? [] : [];
  const dayGroups = useMemo(() => {
    const bySchedule = new Map<number, WorkScheduleRegistrationListItem[]>();
    for (const r of dayRegs) {
      const arr = bySchedule.get(r.schedule_id) ?? [];
      arr.push(r);
      bySchedule.set(r.schedule_id, arr);
    }
    return [...bySchedule.entries()].sort((a, b) => a[0] - b[0]);
  }, [dayRegs]);

  const daySummary = useMemo(() => dayStats(dayRegs), [dayRegs]);

  const dayApproveOne = async (id: number) => {
    if (!canApprove) return;
    setDayActionLoading(true);
    setError(null);
    try {
      await approveScheduleRegistration(id);
      await reloadCalendar();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setDayActionLoading(false);
    }
  };

  const dayRejectOne = async (id: number) => {
    if (!canApprove) return;
    // eslint-disable-next-line no-alert
    const note = window.prompt("Ghi chú từ chối (tuỳ chọn):") ?? undefined;
    setDayActionLoading(true);
    setError(null);
    try {
      await rejectScheduleRegistration(id, note || undefined);
      await reloadCalendar();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setDayActionLoading(false);
    }
  };

  const dayApproveAllPending = async () => {
    if (!canApprove || !selectedDay) return;
    const pending = dayRegs.filter((x) => x.status === "pending");
    if (pending.length === 0) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Duyệt tất cả ${pending.length} đăng ký chờ duyệt trong ngày ${formatDateVi(selectedDay)}?`)) return;
    setDayActionLoading(true);
    setError(null);
    try {
      for (const p of pending) {
        await approveScheduleRegistration(p.id);
      }
      await reloadCalendar();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setDayActionLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {error ? <div className={styles.errorBox}>⚠️ {error}</div> : null}

      <div className={styles.shell}>
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
            className={tab === "calendar" ? `${styles.topTab} ${styles.topTabActive}` : styles.topTab}
            onClick={() => setTab("calendar")}
            role="tab"
            aria-selected={tab === "calendar"}
          >
            <ClockCircleOutlined /> Lịch nhân sự
            <span className={styles.topTabCount}>{calLoading ? "…" : String(calRegs.length)}</span>
          </button>
          <button
            type="button"
            className={tab === "requests" ? `${styles.topTab} ${styles.topTabActive}` : styles.topTab}
            onClick={() => setTab("requests")}
            role="tab"
            aria-selected={tab === "requests"}
            disabled={!canApprove}
            title={!canApprove ? "Bạn không có quyền phê duyệt" : undefined}
          >
            <FileTextOutlined /> Duyệt theo đợt
            <span className={styles.topTabCount}>{reqLoading ? "…" : String(reqItems.length)}</span>
          </button>
        </div>

        {tab === "calendar" ? (
          <Card
            title="Lịch ca làm (quản lý)"
            sub={
              calLoading
                ? "Đang tải..."
                : calTotal > 2000
                  ? `Hiển thị ${calRegs.length}/${calTotal} đăng ký (vui lòng lọc thêm)`
                  : `${calRegs.length} đăng ký trong lưới tháng`
            }
            right={
              <div className={styles.calHeaderRight}>
                <button type="button" className={styles.calNavBtn} onClick={goPrevMonth} aria-label="Tháng trước">
                  ‹
                </button>
                <div className={styles.calTitle}>{formatMonthTitle(calYear, calMonth)}</div>
                <button type="button" className={styles.calNavBtn} onClick={goNextMonth} aria-label="Tháng sau">
                  ›
                </button>
                <button type="button" className={styles.calReload} onClick={reloadCalendar} aria-label="Tải lại">
                  <ReloadOutlined />
                </button>
              </div>
            }
          >
            <div className={styles.calFilters}>
              <div className={styles.searchWrap}>
                <input
                  className={styles.searchInput}
                  value={calUserQuery}
                  onChange={(e) => {
                    setCalUserQuery(e.target.value);
                    setCalUserId("");
                  }}
                  placeholder="Tìm nhân viên (tên / mã)…"
                  aria-label="Tìm nhân viên"
                />
                {calUserId !== "" || calUserQuery.trim() ? (
                  <button
                    type="button"
                    className={styles.searchClearBtn}
                    onClick={clearCalendarUserFilter}
                    aria-label="Xóa lựa chọn nhân viên"
                    title="Xóa lựa chọn nhân viên"
                  >
                    <CloseOutlined />
                  </button>
                ) : null}
                {userSuggestions.length ? (
                  <div className={styles.suggestBox} role="listbox" aria-label="Gợi ý nhân viên">
                    {userSuggestions.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className={styles.suggestItem}
                        onClick={() => {
                          setCalUserId(u.id);
                          setCalUserQuery(`${u.name}${u.code ? ` (${u.code})` : ""}`);
                          setUserSuggestions([]);
                        }}
                      >
                        <span className={styles.suggestName}>{u.name}</span>
                        <span className={styles.suggestMeta}>{u.code ? u.code : `#${u.id}`}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className={styles.calSelectWrap}>
                <select
                  className={styles.calSelect}
                  value={calDepartmentId}
                  onChange={(e) => setCalDepartmentId(e.target.value ? Number(e.target.value) : "")}
                  disabled={!canReadDepartments}
                  title={!canReadDepartments ? "Bạn không có quyền xem phòng ban" : undefined}
                >
                  <option value="">Tất cả phòng ban</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.segmented} role="tablist" aria-label="Lọc trạng thái đăng ký">
                {REG_STATUSES.map((x) => {
                  const active = calStatus === x.key;
                  return (
                    <button
                      key={x.key || "all"}
                      type="button"
                      className={active ? `${styles.segBtn} ${styles.segActive}` : styles.segBtn}
                      onClick={() => setCalStatus(x.key)}
                      aria-pressed={active}
                    >
                      {x.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.calGrid}>
              <div className={styles.calWeekHead}>
                {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((x) => (
                  <div key={x} className={styles.calWeekCell}>
                    {x}
                  </div>
                ))}
              </div>
              <div className={styles.calBody}>
                {calendarDays.map((d) => {
                  const items = calByDay.get(d.ymd) ?? [];
                  const stats = dayStats(items);

                  const scheduleCounts = new Map<number, number>();
                  for (const it of items) scheduleCounts.set(it.schedule_id, (scheduleCounts.get(it.schedule_id) ?? 0) + 1);
                  const top = [...scheduleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);

                  const isMuted = !d.inMonth;
                  const clickable = items.length > 0 || canApprove;
                  const tone =
                    stats.pending > 0
                      ? "pending"
                      : stats.rejected > 0 && stats.approved === 0
                        ? "rejected"
                        : stats.approved > 0 && stats.rejected === 0
                          ? "approved"
                          : stats.approved > 0 && stats.rejected > 0
                            ? "mixed"
                            : "empty";
                  return (
                    <button
                      key={d.ymd}
                      type="button"
                      className={
                        selectedDay === d.ymd
                          ? `${styles.calDay} ${styles.calDayActive} ${styles[`calTone_${tone}`]}${isMuted ? ` ${styles.calDayMuted}` : ""}`
                          : `${styles.calDay} ${styles[`calTone_${tone}`]}${isMuted ? ` ${styles.calDayMuted}` : ""}`
                      }
                      onClick={() => setSelectedDay(d.ymd)}
                      disabled={!clickable}
                      aria-label={`Ngày ${d.ymd}`}
                    >
                      <div className={styles.calDayTop}>
                        <div className={`${styles.calDayNum} ${styles[`calDayNum_${tone}`]}`}>{d.dayNum}</div>
                        {items.length ? (
                          <div className={styles.calBadges}>
                            <span className={`${styles.calBadge} ${styles.badgeTotal}`} title="Tổng nhân sự trong ngày">
                              <TeamOutlined /> {stats.total}
                            </span>
                            {stats.pending ? (
                              <span className={`${styles.calBadge} ${styles.badgePending}`} title="Chờ duyệt">
                                <ClockCircleOutlined /> {stats.pending}
                              </span>
                            ) : null}
                            {stats.approved ? (
                              <span className={`${styles.calBadge} ${styles.badgeApproved}`} title="Đã duyệt">
                                <CheckCircleOutlined /> {stats.approved}
                              </span>
                            ) : null}
                            {stats.rejected ? (
                              <span className={`${styles.calBadge} ${styles.badgeRejected}`} title="Từ chối">
                                <CloseCircleOutlined /> {stats.rejected}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      {top.length ? (
                        <div className={styles.calMiniList}>
                          {top.map(([sid, cnt]) => {
                            const s = scheduleById.get(sid);
                            const name = s ? s.name : `Ca #${sid}`;
                            return (
                              <div key={sid} className={styles.calMiniItem} title={name}>
                                <span className={styles.calMiniName}>{name}</span>
                                <span className={styles.calMiniCount}>{cnt}</span>
                              </div>
                            );
                          })}
                          {scheduleCounts.size > top.length ? <div className={styles.calMiniMore}>+ {scheduleCounts.size - top.length} ca khác</div> : null}
                        </div>
                      ) : (
                        <div className={styles.calEmptyHint}>{canApprove ? "Chọn để xem / duyệt" : ""}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        ) : null}

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
                {canManage ? (
                  <button className={styles.primaryBtn} type="button" onClick={openCreateSchedule}>
                    <PlusOutlined /> Thêm ca
                  </button>
                ) : null}
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
                <div className={styles.searchWrap}>
                  <input
                    className={styles.searchInput}
                    value={reqQuery}
                    onChange={(e) => setReqQuery(e.target.value)}
                    placeholder="Tìm nhân viên theo tên / mã…"
                    aria-label="Tìm nhân viên trong yêu cầu"
                  />
                </div>
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
        ) : null}
      </div>

      <Modal
        open={selectedDay != null}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? `Chi tiết ${formatDateVi(selectedDay)}` : "Chi tiết"}
        modalClassName={styles.dayDetailModalShell}
      >
        {selectedDay ? (
          <div className={styles.dayModal}>
            <div className={styles.dayModalHeader}>
              <div className={styles.dayMeta}>
                <div className={styles.dayMetaLead}>
                  <span className={styles.dayMetaIcon}>
                    <CalendarOutlined />
                  </span>
                  <div>
                    <div className={styles.dayMetaTitle}>{formatDateVi(selectedDay)}</div>
                    <div className={styles.dayMetaSub}>
                      <span>{daySummary.total} nhân sự</span>
                      <span>·</span>
                      <span>{dayGroups.length} ca</span>
                      <span>·</span>
                      <span>{daySummary.pending} chờ duyệt</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.dayActions}>
                {canApprove ? (
                  <button type="button" className={styles.dayApproveAll} onClick={dayApproveAllPending} disabled={dayActionLoading}>
                    <CheckOutlined /> Duyệt tất cả chờ duyệt
                  </button>
                ) : null}
              </div>
            </div>

            <div className={styles.daySummaryBar}>
              <span className={`${styles.daySummaryPill} ${styles.daySummaryNeutral}`}>
                <TeamOutlined /> {daySummary.total} nhân sự
              </span>
              <span className={`${styles.daySummaryPill} ${styles.daySummaryNeutral}`}>
                <CalendarOutlined /> {dayGroups.length} ca
              </span>
              {daySummary.pending ? (
                <span className={`${styles.daySummaryPill} ${styles.daySummaryPending}`}>
                  <ClockCircleOutlined /> {daySummary.pending} chờ duyệt
                </span>
              ) : null}
              {daySummary.approved ? (
                <span className={`${styles.daySummaryPill} ${styles.daySummaryApproved}`}>
                  <CheckCircleOutlined /> {daySummary.approved} đã duyệt
                </span>
              ) : null}
              {daySummary.rejected ? (
                <span className={`${styles.daySummaryPill} ${styles.daySummaryRejected}`}>
                  <CloseCircleOutlined /> {daySummary.rejected} từ chối
                </span>
              ) : null}
            </div>

            {dayGroups.length ? (
              <div className={styles.dayGroups}>
                {dayGroups.map(([sid, items]) => {
                  const s = scheduleById.get(sid);
                  const stats = dayStats(items);
                  const max = Number(s?.max_registrations ?? 0);
                  const capText = max > 0 ? `${stats.approved}/${max} đã duyệt` : `${stats.approved} đã duyệt`;
                  const shortage = max > 0 ? Math.max(0, max - stats.approved) : 0;
                  return (
                    <div key={sid} className={styles.dayGroup}>
                      <div className={styles.dayGroupHead}>
                        <div className={styles.dayGroupHeadMain}>
                          <span
                            className={
                              s && scheduleIconKind(s) === "morning"
                                ? `${styles.dayShiftIcon} ${styles.dayShiftMorning}`
                                : s && scheduleIconKind(s) === "night"
                                  ? `${styles.dayShiftIcon} ${styles.dayShiftNight}`
                                  : `${styles.dayShiftIcon} ${styles.dayShiftDay}`
                            }
                          >
                            {scheduleHeaderIcon(s)}
                          </span>
                          <div className={styles.dayGroupInfo}>
                            <div className={styles.dayGroupTitleRow}>
                              <div className={styles.dayGroupTitle}>{s ? s.name : `Ca #${sid}`}</div>
                              {s ? <span className={styles.dayTimePill}>{s.shift_start}–{s.shift_end}</span> : null}
                              <span className={styles.dayInlineMeta}>
                                <TeamOutlined />
                                {stats.total}
                              </span>
                              <span className={styles.dayInlineMeta}>
                                <CheckCircleOutlined />
                                {capText}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className={styles.dayGroupAssistRow}>
                          {shortage > 0 ? <span className={styles.dayShortagePill}>Thiếu {shortage}</span> : null}
                          {stats.pending ? (
                            <span className={`${styles.statChip} ${styles.chipPending}`} title="Chờ duyệt">
                              Chờ {stats.pending}
                            </span>
                          ) : null}
                          {stats.rejected ? (
                            <span className={`${styles.statChip} ${styles.chipRejected}`} title="Từ chối">
                              Từ chối {stats.rejected}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className={styles.dayTableHead}>
                        <span>Nhân sự</span>
                        <span>Thông tin</span>
                        <span>Trạng thái</span>
                        <span>Thao tác</span>
                      </div>
                      <div className={styles.dayList}>
                        {items.map((r) => {
                          const tone = statusTone(r.status);
                          return (
                            <div key={r.id} className={`${styles.dayRow} ${styles[`dayRow_${tone}`]}`}>
                              <div className={styles.dayRowIdentity}>
                                <span className={`${styles.dayAvatar} ${styles[`dayAvatar_${tone}`]}`}>{getInitials(r.user_name)}</span>
                                <div>
                                  <div className={styles.dayEmpName}>{r.user_name}</div>
                                  <div className={styles.dayEmpMeta}>{r.user_code ? r.user_code : `#${r.user_id}`}</div>
                                </div>
                              </div>
                              <div className={styles.dayRowInfo}>
                                <span className={styles.dayInfoItem}>#{r.id}</span>
                                {r.note ? <span className={styles.dayInfoItem}>{r.note}</span> : <span className={styles.dayInfoItem}>Không có ghi chú</span>}
                              </div>
                              <div className={styles.dayRowStatus}>
                                <span
                                  className={
                                    tone === "approved"
                                      ? `${styles.statusPill} ${styles.pillApproved}`
                                      : tone === "rejected"
                                        ? `${styles.statusPill} ${styles.pillRejected}`
                                        : `${styles.statusPill} ${styles.pillPending}`
                                  }
                                >
                                  {viStatusLabel(r.status)}
                                </span>
                              </div>
                              <div className={styles.dayRowActions}>
                                {canApprove && r.status === "pending" ? (
                                  <div className={styles.dayRowBtns}>
                                    <button
                                      type="button"
                                      className={styles.dayBtnApprove}
                                      onClick={() => dayApproveOne(r.id)}
                                      disabled={dayActionLoading}
                                    >
                                      <CheckCircleOutlined /> Duyệt
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.dayBtnReject}
                                      onClick={() => dayRejectOne(r.id)}
                                      disabled={dayActionLoading}
                                    >
                                      <CloseOutlined /> Từ chối
                                    </button>
                                  </div>
                                ) : (
                                  <span className={styles.dayActionPlaceholder}>-</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.dayEmpty}>Không có đăng ký nào trong ngày này (theo bộ lọc hiện tại).</div>
            )}
          </div>
        ) : null}
      </Modal>

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

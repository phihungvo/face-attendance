import { api, type ApiResponse } from "../lib/apiClient";

export type CheckResult = { user_name: string; confidence: number; time: string };
export type ScanResult = { user_name: string; confidence: number; time: string; action: "checkin" | "checkout" };
export type AttendanceLog = {
  id: number;
  user_id: number;
  user_name?: string | null;
  type: "checkin" | "checkout";
  confidence: number;
  latitude?: number | null;
  longitude?: number | null;
  distance_meters?: number | null;
  geo_ok?: boolean | null;
  timestamp: string;
};

export type AttendanceStats = {
  from_date: string; // YYYY-MM-DD
  to_date: string; // YYYY-MM-DD
  total_users: number;
  total_checkins: number;
  total_checkouts: number;
  late_count: number;
};

export type ManagerDashboardTodaySummary = {
  day: string;
  total_users: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  checked_out_count: number;
  working_count: number;
  attendance_rate: number;
};

export type ManagerDashboardTrendPoint = {
  day: string;
  label: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  attendance_rate: number;
};

export type ManagerDashboardDepartmentRow = {
  department_id?: number | null;
  department_name: string;
  total_users: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  attendance_rate: number;
};

export type ManagerDashboardLeaveSummary = {
  pending_count: number;
  approved_count: number;
  rejected_count: number;
};

export type ManagerDashboardPendingLeaveItem = {
  id: number;
  user_id: number;
  user_name: string;
  user_code?: string | null;
  department_name?: string | null;
  type: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
};

export type ManagerDashboardRecentLogItem = {
  id: number;
  user_id: number;
  user_name: string;
  user_code?: string | null;
  type: "checkin" | "checkout";
  confidence: number;
  timestamp: string;
};

export type ManagerDashboardSummary = {
  generated_at: string;
  today: ManagerDashboardTodaySummary;
  trend: ManagerDashboardTrendPoint[];
  departments: ManagerDashboardDepartmentRow[];
  leave_summary: ManagerDashboardLeaveSummary;
  pending_leaves: ManagerDashboardPendingLeaveItem[];
  recent_logs: ManagerDashboardRecentLogItem[];
};

export type TimelogRow = {
  user_id: number;
  user_name: string;
  user_code?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  date: string; // YYYY-MM-DD
  checkin_time?: string | null;
  checkout_time?: string | null;
  work_hours: number;
  late: boolean;
  absent: boolean;
  method: string;
};

function fileFromBlob(blob: Blob, filename: string) {
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

export async function checkInFromImage(blob: Blob) {
  return checkInFromImageWithGeo(blob);
}

export async function checkInFromImageWithGeo(blob: Blob, geo?: { latitude?: number | null; longitude?: number | null }) {
  const form = new FormData();
  form.append("image", fileFromBlob(blob, "checkin.jpg"));
  if (geo?.latitude != null) form.append("latitude", String(geo.latitude));
  if (geo?.longitude != null) form.append("longitude", String(geo.longitude));
  // Let Axios set multipart boundary automatically (manual Content-Type can break FastAPI parsing).
  const res = await api.post<ApiResponse<CheckResult>>("/attendance/checkin", form);
  if (!res.data.result) throw new Error("Check-in thất bại");
  return res.data.result;
}

export async function checkOutFromImage(blob: Blob) {
  return checkOutFromImageWithGeo(blob);
}

export async function checkOutFromImageWithGeo(blob: Blob, geo?: { latitude?: number | null; longitude?: number | null }) {
  const form = new FormData();
  form.append("image", fileFromBlob(blob, "checkout.jpg"));
  if (geo?.latitude != null) form.append("latitude", String(geo.latitude));
  if (geo?.longitude != null) form.append("longitude", String(geo.longitude));
  // Let Axios set multipart boundary automatically (manual Content-Type can break FastAPI parsing).
  const res = await api.post<ApiResponse<CheckResult>>("/attendance/checkout", form);
  if (!res.data.result) throw new Error("Check-out thất bại");
  return res.data.result;
}

export async function scanAttendanceFromImage(blob: Blob) {
  return scanAttendanceFromImageWithGeo(blob);
}

export async function scanAttendanceFromImageWithGeo(blob: Blob, geo?: { latitude?: number | null; longitude?: number | null }) {
  const form = new FormData();
  form.append("image", fileFromBlob(blob, "scan.jpg"));
  if (geo?.latitude != null) form.append("latitude", String(geo.latitude));
  if (geo?.longitude != null) form.append("longitude", String(geo.longitude));
  // Let Axios set multipart boundary automatically (manual Content-Type can break FastAPI parsing).
  const res = await api.post<ApiResponse<ScanResult>>("/attendance/scan", form);
  if (!res.data.result) throw new Error("Quét chấm công thất bại");
  return res.data.result;
}

export async function scanMyAttendanceFromImage(blob: Blob) {
  return scanMyAttendanceFromImageWithGeo(blob);
}

export async function scanMyAttendanceFromImageWithGeo(blob: Blob, geo?: { latitude?: number | null; longitude?: number | null }) {
  const form = new FormData();
  form.append("image", fileFromBlob(blob, "scan.jpg"));
  if (geo?.latitude != null) form.append("latitude", String(geo.latitude));
  if (geo?.longitude != null) form.append("longitude", String(geo.longitude));
  // Let Axios set multipart boundary automatically (manual Content-Type can break FastAPI parsing).
  const res = await api.post<ApiResponse<ScanResult>>("/attendance/me/scan", form);
  if (!res.data.result) throw new Error("Quét chấm công thất bại");
  return res.data.result;
}

export async function listMyAttendanceLogs(params?: { limit?: number; offset?: number }) {
  const res = await api.get<ApiResponse<AttendanceLog[]>>("/attendance/me/logs", { params });
  return res.data.result ?? [];
}

export async function listMyTimelog(params: { from_date: string; to_date: string }) {
  const res = await api.get<ApiResponse<TimelogRow[]>>("/attendance/me/timelog", { params });
  return res.data.result ?? [];
}

export async function listAttendanceLogs() {
  const res = await api.get<ApiResponse<AttendanceLog[]>>("/attendance/logs");
  return res.data.result ?? [];
}

export async function getAttendanceStats(params: { from_date: string; to_date: string }) {
  const res = await api.get<ApiResponse<AttendanceStats>>("/attendance/stats", { params });
  if (!res.data.result) throw new Error("Không lấy được thống kê chấm công");
  return res.data.result;
}

export async function getManagerDashboardSummary() {
  const res = await api.get<ApiResponse<ManagerDashboardSummary>>("/attendance/dashboard/summary");
  if (!res.data.result) throw new Error("Không lấy được dữ liệu dashboard");
  return res.data.result;
}

export type DailyAttendanceRow = {
  user_id: number;
  user_name: string;
  date: string;
  checkin_time: string | null;
  checkout_time: string | null;
  work_hours: number;
  late: boolean;
  absent: boolean;
};

export async function getDailyAttendanceReport(params: { day: string }) {
  const res = await api.get<ApiResponse<DailyAttendanceRow[]>>("/attendance/reports/daily", { params });
  return res.data.result ?? [];
}

export async function listTimelog(params: {
  from_date: string; // YYYY-MM-DD
  to_date: string; // YYYY-MM-DD
  department_id?: number | null;
  status?: "on-time" | "late" | "absent" | null;
  include_absent?: boolean;
  limit?: number;
  offset?: number;
}) {
  const res = await api.get<ApiResponse<TimelogRow[]>>("/attendance/timelog", { params });
  return res.data.result ?? [];
}

export async function upsertTimelogDay(payload: {
  user_id: number;
  day: string; // YYYY-MM-DD
  checkin_time?: string | null; // ISO datetime
  checkout_time?: string | null; // ISO datetime
}) {
  const { user_id, day, ...body } = payload;
  const res = await api.put<ApiResponse<TimelogRow>>(`/attendance/timelog/${user_id}/${day}`, body);
  if (!res.data.result) throw new Error("Không cập nhật được giờ công");
  return res.data.result;
}

export async function deleteTimelogDay(payload: { user_id: number; day: string }) {
  const res = await api.delete<ApiResponse<{ deleted: boolean }>>(`/attendance/timelog/${payload.user_id}/${payload.day}`);
  return res.data.result?.deleted ?? true;
}

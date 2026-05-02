import { api, type ApiResponse } from "../lib/apiClient";

export type CheckResult = { user_name: string; confidence: number; time: string };
export type AttendanceLog = {
  id: number;
  user_id: number;
  user_name?: string | null;
  type: "checkin" | "checkout";
  confidence: number;
  timestamp: string;
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
  const form = new FormData();
  form.append("image", fileFromBlob(blob, "checkin.jpg"));
  const res = await api.post<ApiResponse<CheckResult>>("/attendance/checkin", form, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  if (!res.data.result) throw new Error("Check-in thất bại");
  return res.data.result;
}

export async function checkOutFromImage(blob: Blob) {
  const form = new FormData();
  form.append("image", fileFromBlob(blob, "checkout.jpg"));
  const res = await api.post<ApiResponse<CheckResult>>("/attendance/checkout", form, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  if (!res.data.result) throw new Error("Check-out thất bại");
  return res.data.result;
}

export async function listAttendanceLogs() {
  const res = await api.get<ApiResponse<AttendanceLog[]>>("/attendance/logs");
  return res.data.result ?? [];
}

export async function listTimelog(params: {
  from_date: string; // YYYY-MM-DD
  to_date: string; // YYYY-MM-DD
  department_id?: number | null;
  status?: "on-time" | "late" | "absent" | null;
  include_absent?: boolean;
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

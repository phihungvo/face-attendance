import { api, type ApiResponse } from "../lib/apiClient";

export type AttendancePolicy = {
  timezone: string;
  face_match_threshold: number;
  shift_start: string; // HH:MM
  shift_end: string; // HH:MM
  late_grace_minutes: number;
  early_leave_grace_minutes: number;
  checkin_from: string; // HH:MM
  checkin_to: string; // HH:MM
  checkout_from: string; // HH:MM
  checkout_to: string; // HH:MM
  min_minutes_between_same_type: number;
};

export async function getAttendancePolicy() {
  const res = await api.get<ApiResponse<AttendancePolicy>>("/settings/attendance");
  if (!res.data.result) throw new Error("Không lấy được attendance policy");
  return res.data.result;
}

export async function updateAttendancePolicy(payload: AttendancePolicy) {
  const res = await api.put<ApiResponse<AttendancePolicy>>("/settings/attendance", payload);
  if (!res.data.result) throw new Error("Không cập nhật được attendance policy");
  return res.data.result;
}

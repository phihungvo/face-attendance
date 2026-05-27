import { api, type ApiResponse } from "../lib/apiClient";

export type AttendancePolicy = {
  timezone: string;
  face_match_threshold: number;
  shift_start: string; // HH:MM
  shift_end: string; // HH:MM
  late_grace_minutes: number;
  early_leave_grace_minutes: number;
  break_start: string; // HH:MM
  break_end: string; // HH:MM
  break_duration_minutes: number;
  break_threshold_hours: number;
  auto_checkout_time: string; // HH:MM
  checkin_from: string; // HH:MM
  checkin_to: string; // HH:MM
  checkout_from: string; // HH:MM
  checkout_to: string; // HH:MM
  min_minutes_between_same_type: number;
};

export type AttendanceEvidenceSettings = {
  enable_evidence_image: boolean;
  image_quality: number;
  image_max_width: number;
  image_format: "webp" | "jpeg";
  image_retention_days: number;
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

export async function getAttendanceEvidenceSettings() {
  const res = await api.get<ApiResponse<AttendanceEvidenceSettings>>("/settings/attendance-evidence");
  if (!res.data.result) throw new Error("Không lấy được attendance evidence settings");
  return res.data.result;
}

export async function updateAttendanceEvidenceSettings(payload: AttendanceEvidenceSettings) {
  const res = await api.put<ApiResponse<AttendanceEvidenceSettings>>("/settings/attendance-evidence", payload);
  if (!res.data.result) throw new Error("Không cập nhật được attendance evidence settings");
  return res.data.result;
}

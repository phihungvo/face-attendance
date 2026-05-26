import { api, type ApiResponse } from "../lib/apiClient";

export type Company = {
  id: number;
  code: string;
  name: string;
  status: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geo_radius_meters?: number | null;
  require_gps_on_attendance?: boolean;
  logo_data_url?: string | null;
  attendance_success_sound_source?: "default" | "sample" | "upload" | "url" | "tts";
  attendance_success_sound_sample_id?: string | null;
  attendance_success_sound_url?: string | null;
  attendance_success_sound_text?: string | null;
  attendance_success_sound_data_url?: string | null;
  attendance_failure_sound_source?: "default" | "sample" | "upload" | "url" | "tts";
  attendance_failure_sound_sample_id?: string | null;
  attendance_failure_sound_url?: string | null;
  attendance_failure_sound_text?: string | null;
  attendance_failure_sound_data_url?: string | null;
  created_at: string;
};

export async function listCompanies(params?: { q?: string; limit?: number; offset?: number }) {
  const res = await api.get<ApiResponse<Company[]>>("/companies", { params });
  return res.data.result ?? [];
}

export async function createCompany(payload: { code: string; name: string; status?: string }) {
  const res = await api.post<ApiResponse<Company>>("/companies", payload);
  return res.data.result!;
}

export async function getCompany(id: number) {
  const res = await api.get<ApiResponse<Company>>(`/companies/${id}`);
  return res.data.result!;
}

export async function updateCompany(
  id: number,
  payload: {
    code?: string | null;
    name?: string | null;
    status?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    geo_radius_meters?: number | null;
    require_gps_on_attendance?: boolean | null;
    attendance_success_sound_source?: "default" | "sample" | "upload" | "url" | "tts" | null;
    attendance_success_sound_sample_id?: string | null;
    attendance_success_sound_url?: string | null;
    attendance_success_sound_text?: string | null;
    attendance_failure_sound_source?: "default" | "sample" | "upload" | "url" | "tts" | null;
    attendance_failure_sound_sample_id?: string | null;
    attendance_failure_sound_url?: string | null;
    attendance_failure_sound_text?: string | null;
  }
) {
  const res = await api.put<ApiResponse<Company>>(`/companies/${id}`, payload);
  return res.data.result!;
}

export async function uploadCompanyLogo(id: number, file: File) {
  const form = new FormData();
  form.append("logo", file);
  const res = await api.put<ApiResponse<Company>>(`/companies/${id}/logo`, form);
  return res.data.result!;
}

export async function uploadCompanyAttendanceSound(id: number, kind: "success" | "failure", file: File) {
  const form = new FormData();
  form.append("sound", file);
  const res = await api.put<ApiResponse<Company>>(`/companies/${id}/attendance-audio/${kind}`, form);
  return res.data.result!;
}

export async function deleteCompany(id: number) {
  const res = await api.delete<ApiResponse<{ deleted: boolean }>>(`/companies/${id}`);
  return res.data.result?.deleted ?? false;
}

export async function getMyCompany() {
  const res = await api.get<ApiResponse<Company>>("/companies/me");
  return res.data.result!;
}

export async function updateMyCompany(payload: {
  code?: string | null;
  name?: string | null;
  status?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geo_radius_meters?: number | null;
  require_gps_on_attendance?: boolean | null;
  attendance_success_sound_source?: "default" | "sample" | "upload" | "url" | "tts" | null;
  attendance_success_sound_sample_id?: string | null;
  attendance_success_sound_url?: string | null;
  attendance_success_sound_text?: string | null;
  attendance_failure_sound_source?: "default" | "sample" | "upload" | "url" | "tts" | null;
  attendance_failure_sound_sample_id?: string | null;
  attendance_failure_sound_url?: string | null;
  attendance_failure_sound_text?: string | null;
}) {
  const res = await api.put<ApiResponse<Company>>("/companies/me", payload);
  return res.data.result!;
}

export async function uploadMyCompanyLogo(file: File) {
  const form = new FormData();
  form.append("logo", file);
  const res = await api.put<ApiResponse<Company>>("/companies/me/logo", form);
  return res.data.result!;
}

export async function uploadMyCompanyAttendanceSound(kind: "success" | "failure", file: File) {
  const form = new FormData();
  form.append("sound", file);
  const res = await api.put<ApiResponse<Company>>(`/companies/me/attendance-audio/${kind}`, form);
  return res.data.result!;
}

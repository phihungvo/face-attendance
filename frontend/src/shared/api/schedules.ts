import { api, type ApiResponse } from "../lib/apiClient";

export type WorkSchedule = {
  id: number;
  company_id: number;
  code: string;
  name: string;
  status: string;
  shift_start: string;
  shift_end: string;
  late_grace_minutes: number;
  early_leave_grace_minutes: number;
  break_start: string;
  break_end: string;
  break_duration_minutes: number;
  break_threshold_hours: number;
  auto_checkout_time: string;
  department_id?: number | null;
  max_registrations?: number;
  days_of_week?: number[]; // 0=Mon..6=Sun
  date_start?: string | null; // YYYY-MM-DD
  date_end?: string | null; // YYYY-MM-DD
  note?: string | null;
  created_at: string;
  updated_at: string;
};

export async function listSchedules(params?: { q?: string; status?: string; limit?: number; offset?: number }) {
  const res = await api.get<ApiResponse<WorkSchedule[]>>("/schedules", { params });
  return res.data.result ?? [];
}

export async function createSchedule(payload: Partial<WorkSchedule> & { code: string; name: string; shift_start: string; shift_end: string }) {
  const res = await api.post<ApiResponse<WorkSchedule>>("/schedules", payload);
  return res.data.result!;
}

export async function updateSchedule(id: number, payload: Partial<WorkSchedule>) {
  const res = await api.put<ApiResponse<WorkSchedule>>(`/schedules/${id}`, payload);
  return res.data.result!;
}

export async function deleteSchedule(id: number) {
  const res = await api.delete<ApiResponse<{ deleted: boolean }>>(`/schedules/${id}`);
  return res.data.result?.deleted ?? false;
}

export type WorkScheduleRegistration = {
  id: number;
  company_id: number;
  user_id: number;
  schedule_id: number;
  day: string; // YYYY-MM-DD
  status: string;
  note?: string | null;
  response_note?: string | null;
  approved_by_user_id?: number | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
};

export async function listMyScheduleRegistrations(params?: { from_date?: string; to_date?: string; status?: string; limit?: number; offset?: number }) {
  const res = await api.get<ApiResponse<WorkScheduleRegistration[]>>("/schedules/me/registrations", { params });
  return res.data.result ?? [];
}

export async function listAllMyScheduleRegistrations(params?: {
  from_date?: string;
  to_date?: string;
  status?: string;
  maxItems?: number;
}) {
  const pageLimit = 500;
  const maxItems = Math.max(1, Number(params?.maxItems ?? 5000));
  const all: WorkScheduleRegistration[] = [];
  let offset = 0;

  for (let i = 0; i < 50 && all.length < maxItems; i += 1) {
    const page = await listMyScheduleRegistrations({
      from_date: params?.from_date,
      to_date: params?.to_date,
      status: params?.status,
      limit: pageLimit,
      offset
    });
    all.push(...page);
    offset += page.length;
    if (page.length < pageLimit) break;
  }

  return all.slice(0, maxItems);
}

export async function registerMySchedule(payload: { schedule_id: number; day: string; note?: string | null }) {
  const res = await api.post<ApiResponse<WorkScheduleRegistration>>("/schedules/me/registrations", payload);
  return res.data.result!;
}

export async function registerMySchedulesBulk(payload: { schedule_id: number; days: string[]; note?: string | null }) {
  const res = await api.post<ApiResponse<WorkScheduleRegistration[]>>("/schedules/me/registrations/bulk", payload);
  return res.data.result ?? [];
}

export async function cancelMyScheduleRegistration(id: number) {
  const res = await api.delete<ApiResponse<{ cancelled: boolean }>>(`/schedules/me/registrations/${id}`);
  return res.data.result?.cancelled ?? true;
}

export type WorkScheduleRegistrationRequest = {
  id: number;
  company_id: number;
  user_id: number;
  schedule_id: number;
  date_from: string; // YYYY-MM-DD
  date_to: string; // YYYY-MM-DD
  days_of_week_mask: number;
  status: string;
  note?: string | null;
  response_note?: string | null;
  approved_by_user_id?: number | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkScheduleRegistrationRequestListItem = {
  id: number;
  date_from: string;
  date_to: string;
  days_of_week_mask: number;
  status: string;
  note?: string | null;
  response_note?: string | null;
  user_id: number;
  user_name: string;
  user_code?: string | null;
  schedule_id: number;
  schedule_code: string;
  schedule_name: string;
  approved_by_user_id?: number | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkScheduleRegistrationRequestListResponse = { items: WorkScheduleRegistrationRequestListItem[]; total: number };

export async function createMyScheduleRegistrationRequest(payload: { schedule_id: number; days: string[]; note?: string | null }) {
  const res = await api.post<ApiResponse<WorkScheduleRegistrationRequest>>("/schedules/me/registration-requests", payload);
  return res.data.result!;
}

export async function listRegistrationRequests(params?: { status?: string; q?: string; limit?: number; offset?: number }) {
  const res = await api.get<ApiResponse<WorkScheduleRegistrationRequestListResponse>>("/schedules/registration-requests", { params });
  return res.data.result ?? { items: [], total: 0 };
}

export async function approveRegistrationRequest(id: number) {
  const res = await api.post<ApiResponse<WorkScheduleRegistrationRequest>>(`/schedules/registration-requests/${id}/approve`);
  return res.data.result!;
}

export async function rejectRegistrationRequest(id: number, note?: string) {
  const res = await api.post<ApiResponse<WorkScheduleRegistrationRequest>>(`/schedules/registration-requests/${id}/reject`, null, { params: { note } });
  return res.data.result!;
}

export type WorkScheduleRegistrationListItem = {
  id: number;
  day: string;
  status: string;
  note?: string | null;
  response_note?: string | null;
  user_id: number;
  user_name: string;
  user_code?: string | null;
  department_id?: number | null;
  schedule_id: number;
  schedule_code: string;
  schedule_name: string;
  approved_by_user_id?: number | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkScheduleRegistrationListResponse = { items: WorkScheduleRegistrationListItem[]; total: number };

export async function listScheduleRegistrations(params?: {
  from_date?: string;
  to_date?: string;
  status?: string;
  user_id?: number;
  q?: string;
  department_id?: number;
  limit?: number;
  offset?: number;
}) {
  const res = await api.get<ApiResponse<WorkScheduleRegistrationListResponse>>("/schedules/registrations", { params });
  return res.data.result ?? { items: [], total: 0 };
}

export async function approveScheduleRegistration(id: number) {
  const res = await api.post<ApiResponse<WorkScheduleRegistration>>(`/schedules/registrations/${id}/approve`);
  return res.data.result!;
}

export async function rejectScheduleRegistration(id: number, note?: string) {
  const res = await api.post<ApiResponse<WorkScheduleRegistration>>(`/schedules/registrations/${id}/reject`, null, { params: { note } });
  return res.data.result!;
}

export async function deleteScheduleRegistration(id: number) {
  const res = await api.delete<ApiResponse<{ deleted: boolean }>>(`/schedules/registrations/${id}`);
  return res.data.result?.deleted ?? true;
}

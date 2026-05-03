import { api, type ApiResponse } from "../lib/apiClient";
import type { LeaveListResponse, LeaveRequest, LeaveStatus } from "../types/leave";

export async function listLeaves(params?: {
  q?: string;
  status?: LeaveStatus;
  user_id?: number;
  department_id?: number;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}) {
  const res = await api.get<ApiResponse<LeaveListResponse>>("/leaves", { params });
  return res.data.result ?? { items: [], total: 0 };
}

export async function createLeave(payload: {
  user_id: number;
  type: string;
  start_date: string;
  end_date: string;
  reason?: string | null;
}) {
  const res = await api.post<ApiResponse<LeaveRequest>>("/leaves", payload);
  if (!res.data.result) throw new Error("Không tạo được đơn nghỉ phép");
  return res.data.result;
}

export async function updateLeave(
  leaveId: number,
  payload: {
    user_id: number;
    type: string;
    start_date: string;
    end_date: string;
    reason?: string | null;
    status?: LeaveStatus | null;
  }
) {
  const res = await api.put<ApiResponse<LeaveRequest>>(`/leaves/${leaveId}`, payload);
  if (!res.data.result) throw new Error("Không cập nhật được đơn nghỉ phép");
  return res.data.result;
}

export async function deleteLeave(leaveId: number) {
  await api.delete(`/leaves/${leaveId}`);
}

export async function approveLeave(leaveId: number) {
  const res = await api.post<ApiResponse<LeaveRequest>>(`/leaves/${leaveId}/approve`);
  if (!res.data.result) throw new Error("Không duyệt được đơn");
  return res.data.result;
}

export async function rejectLeave(leaveId: number) {
  const res = await api.post<ApiResponse<LeaveRequest>>(`/leaves/${leaveId}/reject`);
  if (!res.data.result) throw new Error("Không từ chối được đơn");
  return res.data.result;
}

export async function listMyLeaves(params?: { status?: LeaveStatus; from_date?: string; to_date?: string; limit?: number; offset?: number }) {
  const res = await api.get<ApiResponse<LeaveListResponse>>("/leaves/me", { params });
  return res.data.result ?? { items: [], total: 0 };
}

export async function createMyLeave(payload: { type: string; start_date: string; end_date: string; reason?: string | null }) {
  const res = await api.post<ApiResponse<LeaveRequest>>("/leaves/me", payload);
  if (!res.data.result) throw new Error("Không tạo được đơn nghỉ phép");
  return res.data.result;
}

export type LeaveBalanceType = { type: string; allowance_days: number; used_days: number; remaining_days: number };
export type LeaveBalance = { year: number; items: LeaveBalanceType[] };

export async function getMyLeaveBalance(params?: { year?: number }) {
  const res = await api.get<ApiResponse<LeaveBalance>>("/leaves/me/balance", { params });
  if (!res.data.result) throw new Error("Không lấy được số ngày phép");
  return res.data.result;
}

import { api, type ApiResponse } from "../lib/apiClient";
import type { User } from "../types/user";

export type UserDeletedFilter = "active" | "deleted" | "all";

export async function listUsers(params?: { q?: string; limit?: number; offset?: number; deleted?: UserDeletedFilter }) {
  const res = await api.get<ApiResponse<User[]>>("/users", { params });
  return res.data.result ?? [];
}

export async function createUser(payload: {
  name: string;
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  citizen_id?: string | null;
  citizen_id_place?: string | null;
  hire_date?: string | null;
  role?: string | null;
  status?: string | null;
  department_id?: number | null;
  create_login?: boolean;
  portal_role_key?: "employee" | "manager" | null;
}) {
  const res = await api.post<ApiResponse<User>>("/users", payload);
  if (!res.data.result) throw new Error("Không tạo được nhân viên");
  return res.data.result;
}

export async function updateUser(
  userId: number,
  payload: {
    name: string;
    code?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    citizen_id?: string | null;
    citizen_id_place?: string | null;
    hire_date?: string | null;
    role?: string | null;
    status?: string | null;
    department_id?: number | null;
  }
) {
  const res = await api.put<ApiResponse<User>>(`/users/${userId}`, payload);
  if (!res.data.result) throw new Error("Không cập nhật được nhân viên");
  return res.data.result;
}

export async function deleteUser(userId: number) {
  await api.delete(`/users/${userId}`);
}

export async function restoreUser(userId: number) {
  await api.post(`/users/${userId}/restore`);
}

export async function hardDeleteUser(userId: number) {
  await api.delete(`/users/${userId}/hard`);
}

export async function getMyProfile() {
  const res = await api.get<ApiResponse<User & { department_name?: string | null }>>("/users/me");
  if (!res.data.result) throw new Error("Không lấy được thông tin nhân viên");
  return res.data.result;
}

export async function updateMyProfile(payload: {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  citizen_id?: string | null;
  citizen_id_place?: string | null;
}) {
  const res = await api.put<ApiResponse<User & { department_name?: string | null }>>("/users/me", payload);
  if (!res.data.result) throw new Error("Không cập nhật được hồ sơ");
  return res.data.result;
}

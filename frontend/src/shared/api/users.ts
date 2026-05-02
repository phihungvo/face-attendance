import { api, type ApiResponse } from "../lib/apiClient";
import type { User } from "../types/user";

export async function listUsers(params?: { q?: string; limit?: number; offset?: number }) {
  const res = await api.get<ApiResponse<User[]>>("/users", { params });
  return res.data.result ?? [];
}

export async function createUser(payload: {
  name: string;
  code?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  department_id?: number | null;
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


import { api, type ApiResponse } from "../lib/apiClient";
import type { Department } from "../types/department";

export async function listDepartments(params?: { q?: string; limit?: number; offset?: number }) {
  const res = await api.get<ApiResponse<Department[]>>("/departments", { params });
  return res.data.result ?? [];
}

export async function createDepartment(payload: { code: string; name: string; location?: string | null }) {
  const res = await api.post<ApiResponse<Department>>("/departments", payload);
  if (!res.data.result) throw new Error("Không tạo được phòng ban");
  return res.data.result;
}

export async function updateDepartment(deptId: number, payload: { code: string; name: string; location?: string | null }) {
  const res = await api.put<ApiResponse<Department>>(`/departments/${deptId}`, payload);
  if (!res.data.result) throw new Error("Không cập nhật được phòng ban");
  return res.data.result;
}

export async function deleteDepartment(deptId: number) {
  await api.delete(`/departments/${deptId}`);
}


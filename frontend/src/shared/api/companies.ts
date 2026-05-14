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
  }
) {
  const res = await api.put<ApiResponse<Company>>(`/companies/${id}`, payload);
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
}) {
  const res = await api.put<ApiResponse<Company>>("/companies/me", payload);
  return res.data.result!;
}

import axios from "axios";

export type ApiResponse<T> = { result?: T; message?: string };

export const api = axios.create({
  // Default: same-origin `/api/v1` (works with docker nginx + vite proxy).
  // Override with `VITE_API_BASE_URL` when running frontend separately.
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  timeout: 30_000
});

const TOKEN_KEY = "fa_token";
const COMPANY_KEY = "fa_company_id";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (!token) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function getCompanyId() {
  try {
    const v = localStorage.getItem(COMPANY_KEY);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function setCompanyId(companyId: number | null) {
  try {
    if (!companyId) localStorage.removeItem(COMPANY_KEY);
    else localStorage.setItem(COMPANY_KEY, String(companyId));
  } catch {
    // ignore
  }
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const companyId = getCompanyId();
  if (companyId) config.headers["X-Company-Id"] = String(companyId);
  return config;
});

export function getApiErrorMessage(e: any): string {
  if (e?.response?.data?.message) return String(e.response.data.message);
  if (e?.message) return String(e.message);
  return "Có lỗi xảy ra";
}

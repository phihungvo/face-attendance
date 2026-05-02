import axios, { AxiosError } from "axios";

export type ApiResponse<T> = { code: number; message: string; result?: T };

export function getToken() {
  return localStorage.getItem("access_token");
}

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem("access_token");
  else localStorage.setItem("access_token", token);
}

export function getApiErrorMessage(error: unknown): string {
  const err = error as AxiosError<any>;
  const data = err?.response?.data;

  if (data?.message && typeof data.message === "string") return data.message;
  if (data?.detail && typeof data.detail === "string") return data.detail;

  // Backend chuẩn hoá: { code, message, result }
  if (data?.message && typeof data.message === "string") return data.message;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;

  return err?.message || "Có lỗi xảy ra, vui lòng thử lại";
}

export const api = axios.create({
  baseURL: "/api/v1",
  timeout: 60_000
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    // Nếu token sai/hết hạn thì logout để user đăng nhập lại.
    if (error?.response?.status === 401) setToken(null);
    return Promise.reject(error);
  }
);


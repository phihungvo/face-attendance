import { api, type ApiResponse } from "../lib/apiClient";

export async function changeMyPassword(payload: { current_password: string; new_password: string }) {
  const res = await api.post<ApiResponse<{ changed: boolean }>>("/auth/change-password", payload);
  return res.data.result ?? { changed: false };
}


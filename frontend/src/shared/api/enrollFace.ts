import { api, type ApiResponse } from "../lib/apiClient";

export async function enrollFaceForUser(userId: number, blob: Blob) {
  const form = new FormData();
  form.append("image", new File([blob], "enroll.jpg", { type: blob.type || "image/jpeg" }));
  const res = await api.post<ApiResponse<{ enrolled: boolean }>>(`/users/${userId}/enroll-face`, form, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return !!res.data.result?.enrolled;
}


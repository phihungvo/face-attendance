import { api, type ApiResponse } from "../lib/apiClient";

export async function enrollFaceForUser(userId: number, blob: Blob) {
  const form = new FormData();
  form.append("image", new File([blob], "enroll.jpg", { type: blob.type || "image/jpeg" }));
  const res = await api.post<ApiResponse<{ enrolled: boolean }>>(`/users/${userId}/enroll-face`, form, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return !!res.data.result?.enrolled;
}

export type MyFaceStatus = {
  last_enrolled_at: string | null;
  next_allowed_at: string | null;
};

export async function getMyFaceStatus() {
  const res = await api.get<ApiResponse<MyFaceStatus>>("/users/me/face-status");
  if (!res.data.result) throw new Error("Không lấy được trạng thái khuôn mặt");
  return res.data.result;
}

export async function enrollMyFace(blob: Blob) {
  const form = new FormData();
  form.append("image", new File([blob], "enroll.jpg", { type: blob.type || "image/jpeg" }));
  const res = await api.post<ApiResponse<{ enrolled: boolean; face_enrolled_at?: string }>>("/users/me/enroll-face", form, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  if (!res.data.result) throw new Error("Không đăng ký được khuôn mặt");
  return res.data.result;
}

const STATUS_VI: Record<string, string> = {
  active: "Đang hoạt động",
  inactive: "Tạm tắt",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã huỷ",
  ok: "OK",
  degraded: "Suy giảm",
  OK: "OK",
  DEGRADED: "Suy giảm"
};

export function viStatusLabel(status: unknown): string {
  if (status == null) return "";
  const s = String(status);
  return STATUS_VI[s] ?? s;
}


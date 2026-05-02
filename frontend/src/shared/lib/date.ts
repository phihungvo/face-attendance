export function formatDateTimeVi(d: Date, opts?: { dateOnly?: boolean }) {
  if (opts?.dateOnly) {
    return d.toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "2-digit", day: "2-digit" });
  }
  return d.toLocaleString("vi-VN");
}

export function formatDateVi(d: Date) {
  return d.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}


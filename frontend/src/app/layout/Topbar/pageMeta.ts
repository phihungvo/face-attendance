export type PageMeta = { title: string; sub: string; actionLabel?: string; actionTo?: string };

export const pageMetaByPath: Record<string, PageMeta> = {
  "/": { title: "Dashboard", sub: "Chào mừng trở lại, Admin!", actionLabel: "➕ Thêm nhân viên", actionTo: "/employees" },
  "/companies": { title: "Công Ty", sub: "Quản lý nhiều công ty" },
  "/schedules": { title: "Ca Làm", sub: "Thiết lập ca + duyệt đăng ký" },
  "/checkin": { title: "Chấm Công", sub: "Nhận diện khuôn mặt realtime", actionLabel: "📷 Bật camera", actionTo: "/checkin" },
  "/timelog": { title: "Bảng Giờ Công", sub: "Tổng hợp giờ làm theo tháng", actionLabel: "⬇️ Xuất file", actionTo: "/timelog" },
  "/employees": { title: "Nhân Viên", sub: "Danh sách & hồ sơ nhân viên" },
  "/departments": { title: "Phòng Ban", sub: "Cấu trúc tổ chức" },
  "/leave": { title: "Nghỉ Phép", sub: "Duyệt & lịch sử" },
  "/reports": { title: "Báo Cáo", sub: "Phân tích & KPI" },
  "/overtime": { title: "Tăng Ca", sub: "Theo dõi OT" },
  "/payroll": { title: "Bảng Lương", sub: "Tổng hợp chấm công" },
  "/notifications": { title: "Thông Báo", sub: "Thông báo hệ thống" },
  "/settings": { title: "Cài Đặt", sub: "Tùy chỉnh hệ thống" }
};

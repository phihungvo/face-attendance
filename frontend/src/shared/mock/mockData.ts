export const mockDashboard = {
  stats: [
    { icon: "👥", label: "Tổng nhân viên", value: 128, variant: "blue" as const, delta: { label: "↑ +8 tháng này", tone: "green" as const } },
    { icon: "✅", label: "Đang làm việc hôm nay", value: 112, variant: "green" as const, delta: { label: "↑ 87.5% tỉ lệ", tone: "neutral" as const } },
    { icon: "⏰", label: "Đến muộn hôm nay", value: 6, variant: "orange" as const, delta: { label: "↓ giảm 2 so với tuần trước", tone: "red" as const } },
    { icon: "❌", label: "Vắng mặt hôm nay", value: 10, variant: "red" as const, delta: { label: "↑ tăng 2", tone: "green" as const } }
  ],
  attendance7d: [
    { label: "T2", value: 78 },
    { label: "T3", value: 84 },
    { label: "T4", value: 81 },
    { label: "T5", value: 88 },
    { label: "T6", value: 90 },
    { label: "T7", value: 62 },
    { label: "CN", value: 55 }
  ],
  activity: [
    { id: "a1", icon: "✅", title: "NV012 chấm công vào", sub: "Cổng chính", time: "2 phút trước" },
    { id: "a2", icon: "📷", title: "Camera #2 hoạt động", sub: "Khu sản xuất", time: "18 phút trước" },
    { id: "a3", icon: "⚠️", title: "NV003 đi trễ", sub: "Ca sáng", time: "1 giờ trước" },
    { id: "a4", icon: "📝", title: "Cập nhật ca làm việc", sub: "Shift A", time: "Hôm qua" }
  ],
  pendingLeaves: [
    { id: "l1", initials: "NA", name: "Nguyễn Văn An", type: "Nghỉ phép", range: "03–04/05", status: "Chờ duyệt" },
    { id: "l2", initials: "TB", name: "Trần Thị Bình", type: "Nghỉ ốm", range: "02/05", status: "Chờ duyệt" },
    { id: "l3", initials: "HL", name: "Hoàng Linh", type: "Nghỉ phép", range: "06–07/05", status: "Chờ duyệt" }
  ],
  miniCalendar: [
    { label: "T2", muted: true },
    { label: "T3", muted: true },
    { label: "T4", muted: true },
    { label: "T5", muted: true },
    { label: "T6", muted: true },
    { label: "T7", muted: true },
    { label: "CN", muted: true },
    ...Array.from({ length: 28 }, (_, i) => ({ label: String(i + 1), muted: false }))
  ],
  recentCheckins: [
    { id: "r1", initials: "NA", name: "Nguyễn Văn An", code: "NV001", dept: "Kỹ thuật", shift: "Sáng", inTime: "08:01", status: "Đúng giờ", statusTone: "good" as const, device: "iPad Gate" },
    { id: "r2", initials: "TB", name: "Trần Thị Bình", code: "NV002", dept: "Kế toán", shift: "Sáng", inTime: "08:12", status: "Trễ 12p", statusTone: "warn" as const, device: "Cam Lobby" },
    { id: "r3", initials: "HL", name: "Hoàng Linh", code: "NV003", dept: "Nhân sự", shift: "Sáng", inTime: "07:55", status: "Sớm", statusTone: "good" as const, device: "Web Kiosk" },
    { id: "r4", initials: "QH", name: "Quang Huy", code: "NV004", dept: "Sản xuất", shift: "Sáng", inTime: "08:05", status: "Đúng giờ", statusTone: "good" as const, device: "Cam Line 1" }
  ]
};

export const mockAttendance = {
  employees: [
    { code: "NV001", name: "Nguyễn Văn An" },
    { code: "NV002", name: "Trần Thị Bình" },
    { code: "NV003", name: "Hoàng Linh" },
    { code: "NV004", name: "Quang Huy" }
  ],
  todayLogs: [
    { id: "t1", time: "08:01", initials: "NA", name: "Nguyễn Văn An", code: "NV001", type: "Vào ca", typeTone: "good" as const, confidence: "0.982", device: "iPad Gate" },
    { id: "t2", time: "08:12", initials: "TB", name: "Trần Thị Bình", code: "NV002", type: "Vào ca", typeTone: "bad" as const, confidence: "0.911", device: "Cam Lobby" },
    { id: "t3", time: "12:03", initials: "HL", name: "Hoàng Linh", code: "NV003", type: "Nghỉ", typeTone: "good" as const, confidence: "0.973", device: "Web Kiosk" },
    { id: "t4", time: "17:05", initials: "QH", name: "Quang Huy", code: "NV004", type: "Ra ca", typeTone: "good" as const, confidence: "0.988", device: "Cam Line 1" }
  ]
};

export const mockTimesheet = {
  defaultMonth: "2026-05",
  summaryByMonth: {
    "2026-05": { totalEmployees: 128, totalHours: 19876, lateDays: 34, absentDays: 12 }
  } as Record<string, { totalEmployees: number; totalHours: number; lateDays: number; absentDays: number }>,
  rows: [
    { initials: "NA", name: "Nguyễn Văn An", code: "NV001", dept: "Kỹ thuật", hours: "176.5", lateDays: 1, absentDays: 0, note: "—" },
    { initials: "TB", name: "Trần Thị Bình", code: "NV002", dept: "Kế toán", hours: "168.0", lateDays: 3, absentDays: 0, note: "Đi trễ do kẹt xe" },
    { initials: "HL", name: "Hoàng Linh", code: "NV003", dept: "Nhân sự", hours: "172.0", lateDays: 0, absentDays: 1, note: "Nghỉ ốm 1 ngày" },
    { initials: "QH", name: "Quang Huy", code: "NV004", dept: "Sản xuất", hours: "160.0", lateDays: 2, absentDays: 1, note: "—" }
  ]
};

export const mockEmployees = {
  departments: ["Kỹ thuật", "Kế toán", "Nhân sự", "Sản xuất"],
  stats: [
    { icon: "👥", label: "Tổng nhân viên", value: 128, variant: "blue" as const, delta: { label: "↑ +8", tone: "green" as const } },
    { icon: "✅", label: "Đang hoạt động", value: 120, variant: "green" as const, delta: { label: "↑ 93.8%", tone: "neutral" as const } },
    { icon: "🆕", label: "Mới tháng này", value: 5, variant: "orange" as const, delta: { label: "↑ +2 tuần này", tone: "green" as const } },
    { icon: "⛔", label: "Tạm nghỉ", value: 8, variant: "red" as const, delta: { label: "↓ -1", tone: "red" as const } }
  ],
  rows: [
    { initials: "NA", name: "Nguyễn Văn An", code: "NV001", dept: "Kỹ thuật", role: "Engineer", email: "an.nguyen@company.vn", shift: "Ca sáng", status: "Đang hoạt động", statusTone: "active" as const },
    { initials: "TB", name: "Trần Thị Bình", code: "NV002", dept: "Kế toán", role: "Accountant", email: "binh.tran@company.vn", shift: "Ca sáng", status: "Đang hoạt động", statusTone: "active" as const },
    { initials: "HL", name: "Hoàng Linh", code: "NV003", dept: "Nhân sự", role: "HR", email: "linh.hoang@company.vn", shift: "Ca sáng", status: "Đang hoạt động", statusTone: "active" as const },
    { initials: "QH", name: "Quang Huy", code: "NV004", dept: "Sản xuất", role: "Operator", email: "huy.quang@company.vn", shift: "Ca sáng", status: "Tạm tắt", statusTone: "inactive" as const }
  ]
};

export const mockDepartments = {
  kpis: [
    { label: "Phòng ban", value: 8 },
    { label: "Quản lý", value: 8 },
    { label: "Nhân sự", value: 128 }
  ],
  rows: [
    { icon: "🧑‍💻", name: "Kỹ thuật", manager: "Nguyễn Văn An", headcount: 22, location: "Tầng 5" },
    { icon: "🧾", name: "Kế toán", manager: "Trần Thị Bình", headcount: 12, location: "Tầng 3" },
    { icon: "🧑‍🤝‍🧑", name: "Nhân sự", manager: "Hoàng Linh", headcount: 8, location: "Tầng 2" },
    { icon: "🏭", name: "Sản xuất", manager: "Quang Huy", headcount: 64, location: "Nhà máy A" }
  ]
};

export const mockLeave = {
  kpis: [
    { label: "Chờ duyệt", value: 3 },
    { label: "Đã duyệt", value: 18 },
    { label: "Từ chối", value: 2 }
  ],
  rows: [
    { id: "lv1", initials: "NA", name: "Nguyễn Văn An", code: "NV001", type: "Nghỉ phép", range: "03–04/05", reason: "Việc gia đình", status: "Chờ duyệt", statusKey: "pending" as const, tone: "warn" as const },
    { id: "lv2", initials: "TB", name: "Trần Thị Bình", code: "NV002", type: "Nghỉ ốm", range: "02/05", reason: "Khám bệnh", status: "Chờ duyệt", statusKey: "pending" as const, tone: "warn" as const },
    { id: "lv3", initials: "HL", name: "Hoàng Linh", code: "NV003", type: "Nghỉ phép", range: "06–07/05", reason: "Du lịch", status: "Đã duyệt", statusKey: "approved" as const, tone: "good" as const },
    { id: "lv4", initials: "QH", name: "Quang Huy", code: "NV004", type: "Nghỉ phép", range: "10/05", reason: "Cá nhân", status: "Từ chối", statusKey: "rejected" as const, tone: "bad" as const }
  ]
};

export const mockReports = {
  stats: [
    { icon: "📌", label: "Tỉ lệ đúng giờ", value: "87.5%", variant: "blue" as const, delta: { label: "↑ +1.2%", tone: "green" as const } },
    { icon: "🕐", label: "Đi trễ (7 ngày)", value: 34, variant: "orange" as const, delta: { label: "↓ +6", tone: "red" as const } },
    { icon: "🔴", label: "Vắng (tháng)", value: 12, variant: "red" as const, delta: { label: "↑ -2", tone: "green" as const } },
    { icon: "⏱", label: "Giờ công", value: "19,876", variant: "green" as const, delta: { label: "↑ +3.1%", tone: "green" as const } }
  ],
  lateTrend7d: [
    { label: "T2", value: 30 },
    { label: "T3", value: 45 },
    { label: "T4", value: 25 },
    { label: "T5", value: 55 },
    { label: "T6", value: 40 },
    { label: "T7", value: 20 },
    { label: "CN", value: 15 }
  ],
  insights: [
    { id: "i1", icon: "🟡", title: "Tăng đi trễ", sub: "Kỹ thuật tăng 8% so với tuần trước" },
    { id: "i2", icon: "🟢", title: "Ổn định", sub: "Nhân sự giữ tỉ lệ đúng giờ cao nhất" },
    { id: "i3", icon: "🔴", title: "Vắng rải rác", sub: "Tập trung vào cuối tuần" }
  ],
  deptTable: [
    { icon: "🧑‍💻", dept: "Kỹ thuật", headcount: 22, ontime: 84, late: 12, absent: 4 },
    { icon: "🧾", dept: "Kế toán", headcount: 12, ontime: 92, late: 6, absent: 2 },
    { icon: "🧑‍🤝‍🧑", dept: "Nhân sự", headcount: 8, ontime: 95, late: 3, absent: 2 },
    { icon: "🏭", dept: "Sản xuất", headcount: 64, ontime: 86, late: 9, absent: 5 }
  ]
};

export const mockOvertime = {
  kpis: [
    { label: "Yêu cầu", value: 18 },
    { label: "Đã duyệt", value: 14 },
    { label: "Tổng giờ", value: "126.5" }
  ],
  rows: [
    { id: "ot1", initials: "NA", name: "Nguyễn Văn An", dept: "Kỹ thuật", date: "2026-05-01", hours: "2.0", reason: "Fix production", status: "Đã duyệt", tone: "good" as const },
    { id: "ot2", initials: "TB", name: "Trần Thị Bình", dept: "Kế toán", date: "2026-05-01", hours: "1.5", reason: "Chốt sổ", status: "Chờ duyệt", tone: "warn" as const },
    { id: "ot3", initials: "QH", name: "Quang Huy", dept: "Sản xuất", date: "2026-05-02", hours: "3.0", reason: "Tăng chuyền", status: "Đã duyệt", tone: "good" as const }
  ]
};

export const mockPayroll = {
  month: "2026-05",
  totalEmployees: 128,
  totalPayroll: "3.2 tỷ",
  rows: [
    { initials: "NA", name: "Nguyễn Văn An", code: "NV001", base: "25,000,000", hours: "176.5", ot: "2.0", deduct: "0", net: "26,100,000" },
    { initials: "TB", name: "Trần Thị Bình", code: "NV002", base: "18,000,000", hours: "168.0", ot: "1.5", deduct: "200,000", net: "18,900,000" },
    { initials: "HL", name: "Hoàng Linh", code: "NV003", base: "20,000,000", hours: "172.0", ot: "0.0", deduct: "0", net: "20,000,000" }
  ]
};

export const mockNotifications = {
  items: [
    { id: "n1", icon: "⚠️", title: "Camera #2 bị mất kết nối", sub: "Khu sản xuất", time: "5 phút trước", unread: true },
    { id: "n2", icon: "✅", title: "Duyệt OT thành công", sub: "NV001 • 2 giờ", time: "35 phút trước", unread: true },
    { id: "n3", icon: "📝", title: "Cập nhật chính sách chấm công", sub: "Áp dụng từ 01/06", time: "Hôm qua", unread: false }
  ]
};

export const mockSettings = {
  timezones: ["Asia/Ho_Chi_Minh", "Asia/Bangkok", "Asia/Singapore"],
  values: { company: "FaceTime HR", timezone: "Asia/Ho_Chi_Minh", confidence: "0.90", audit: true },
  services: [
    { name: "Backend API", status: "OK", tone: "ok" as const },
    { name: "MySQL", status: "OK", tone: "ok" as const },
    { name: "ML Service", status: "DEGRADED", tone: "warn" as const }
  ]
};

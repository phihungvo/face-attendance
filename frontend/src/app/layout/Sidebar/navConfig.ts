export type NavItem = {
  key: string;
  label: string;
  icon: string;
  to: string;
  badge?: { text: string; tone?: "default" | "green" };
};

export type NavSection = { label: string; items: NavItem[] };

export const navSections: NavSection[] = [
  {
    label: "Tổng quan",
    items: [
      { key: "dashboard", label: "Dashboard", icon: "📊", to: "/" },
      { key: "checkin", label: "Chấm Công", icon: "📷", to: "/checkin", badge: { text: "LIVE", tone: "green" } },
      { key: "timelog", label: "Bảng Giờ Công", icon: "🕐", to: "/timelog" }
    ]
  },
  {
    label: "Nhân sự",
    items: [
      { key: "employees", label: "Nhân Viên", icon: "👥", to: "/employees" },
      { key: "departments", label: "Phòng Ban", icon: "🏢", to: "/departments" },
      { key: "leave", label: "Nghỉ Phép", icon: "🌴", to: "/leave", badge: { text: "3" } }
    ]
  },
  {
    label: "Phân tích",
    items: [
      { key: "reports", label: "Báo Cáo", icon: "📈", to: "/reports" },
      { key: "overtime", label: "Tăng Ca", icon: "⏰", to: "/overtime" },
      { key: "payroll", label: "Bảng Lương", icon: "💰", to: "/payroll" }
    ]
  },
  {
    label: "Hệ thống",
    items: [
      { key: "notifications", label: "Thông Báo", icon: "🔔", to: "/notifications", badge: { text: "5" } },
      { key: "settings", label: "Cài Đặt", icon: "⚙️", to: "/settings" },
      { key: "iam_users", label: "IAM Users", icon: "🛡️", to: "/iam/users" },
      { key: "iam_roles", label: "IAM Roles", icon: "🔑", to: "/iam/roles" },
      { key: "iam_perms", label: "IAM Perms", icon: "🧩", to: "/iam/permissions" }
    ]
  }
];

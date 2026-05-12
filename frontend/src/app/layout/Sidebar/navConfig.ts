export type NavItem = {
  key: string;
  label: string;
  icon: string;
  to: string;
  badge?: { text: string; tone?: "default" | "green" };
};

export type NavSection = { label: string; items: NavItem[] };

export function getNavSections(roleKeys: string[]): NavSection[] {
  const isAdmin = roleKeys.includes("admin");

  if (isAdmin) {
    return [
      {
        label: "Tổng quan",
        items: [{ key: "dashboard", label: "Dashboard", icon: "📊", to: "/" }]
      },
      {
        label: "Tổ chức",
        items: [{ key: "companies", label: "Công Ty", icon: "🏢", to: "/companies" }]
      },
      {
        label: "Nhân sự",
        items: [
          { key: "checkin", label: "Chấm Công", icon: "📷", to: "/checkin", badge: { text: "LIVE", tone: "green" } },
          { key: "timelog", label: "Bảng Giờ Công", icon: "🕐", to: "/timelog" },
          { key: "schedules", label: "Ca Làm", icon: "🗓️", to: "/schedules" },
          { key: "employees", label: "Nhân Viên", icon: "👥", to: "/employees" },
          { key: "departments", label: "Phòng Ban", icon: "🏢", to: "/departments" },
          { key: "leave", label: "Nghỉ Phép", icon: "🌴", to: "/leave" }
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
          { key: "notifications", label: "Thông Báo", icon: "🔔", to: "/notifications" },
          { key: "iam_users", label: "IAM Users", icon: "🛡️", to: "/iam/users" },
          { key: "iam_roles", label: "IAM Roles", icon: "🔑", to: "/iam/roles" },
          { key: "iam_perms", label: "IAM Perms", icon: "🧩", to: "/iam/permissions" },
          { key: "settings", label: "Cài Đặt", icon: "⚙️", to: "/settings" }
        ]
      }
    ];
  }

  // Manager / other operational UI
  return [
    {
      label: "Tổng quan",
      items: [
        { key: "dashboard", label: "Dashboard", icon: "📊", to: "/" },
        { key: "checkin", label: "Chấm Công", icon: "📷", to: "/checkin", badge: { text: "LIVE", tone: "green" } },
        { key: "timelog", label: "Bảng Giờ Công", icon: "🕐", to: "/timelog" },
        { key: "schedules", label: "Ca Làm", icon: "🗓️", to: "/schedules" }
      ]
    },
    {
      label: "Nhân sự",
      items: [
        { key: "employees", label: "Nhân Viên", icon: "👥", to: "/employees" },
        { key: "departments", label: "Phòng Ban", icon: "🏢", to: "/departments" },
        { key: "leave", label: "Nghỉ Phép", icon: "🌴", to: "/leave" }
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
        { key: "notifications", label: "Thông Báo", icon: "🔔", to: "/notifications" },
        { key: "settings", label: "Cài Đặt", icon: "⚙️", to: "/settings" }
      ]
    }
  ];
}

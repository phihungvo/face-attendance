import { createElement, type ComponentType, type ReactNode } from "react";
import {
  ApartmentOutlined,
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
  BellOutlined,
  CalendarOutlined,
  CameraOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  FieldTimeOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  WalletOutlined
} from "@ant-design/icons";

export type NavItem = {
  key: string;
  label: string;
  icon: ReactNode;
  iconColor: string;
  to: string;
  badge?: { text: string; tone?: "default" | "green" };
};

export type NavSection = { label: string; items: NavItem[] };

function iconOf(Icon: ComponentType) {
  return createElement(Icon);
}

export function getNavSections(roleKeys: string[]): NavSection[] {
  const isAdmin = roleKeys.includes("admin");

  if (isAdmin) {
    return [
      {
        label: "Tổng quan",
        items: [{ key: "dashboard", label: "Bảng điều hành", icon: iconOf(DashboardOutlined), iconColor: "#1677ff", to: "/" }]
      },
      {
        label: "Tổ chức",
        items: [{ key: "companies", label: "Công ty", icon: iconOf(BankOutlined), iconColor: "#7a5af8", to: "/companies" }]
      },
      {
        label: "Nhân sự",
        items: [
          { key: "checkin", label: "Chấm công", icon: iconOf(CameraOutlined), iconColor: "#13ae52", to: "/checkin", badge: { text: "LIVE", tone: "green" } },
          { key: "timelog", label: "Bảng giờ công", icon: iconOf(FieldTimeOutlined), iconColor: "#fa8c16", to: "/timelog" },
          { key: "schedules", label: "Ca làm", icon: iconOf(CalendarOutlined), iconColor: "#eb2f96", to: "/schedules" },
          { key: "employees", label: "Nhân viên", icon: iconOf(TeamOutlined), iconColor: "#1677ff", to: "/employees" },
          { key: "departments", label: "Phòng ban", icon: iconOf(ApartmentOutlined), iconColor: "#2f54eb", to: "/departments" },
          { key: "leave", label: "Nghỉ phép", icon: iconOf(AuditOutlined), iconColor: "#f5222d", to: "/leave" }
        ]
      },
      {
        label: "Phân tích",
        items: [
          { key: "reports", label: "Báo cáo", icon: iconOf(BarChartOutlined), iconColor: "#0f9d8a", to: "/reports" },
          { key: "overtime", label: "Tăng ca", icon: iconOf(ClockCircleOutlined), iconColor: "#fa541c", to: "/overtime" },
          { key: "payroll", label: "Bảng lương", icon: iconOf(WalletOutlined), iconColor: "#52c41a", to: "/payroll" }
        ]
      },
      {
        label: "Hệ thống",
        items: [
          { key: "notifications", label: "Thông báo", icon: iconOf(BellOutlined), iconColor: "#722ed1", to: "/notifications" },
          { key: "iam_users", label: "IAM Users", icon: iconOf(SafetyCertificateOutlined), iconColor: "#13c2c2", to: "/iam/users" },
          { key: "iam_roles", label: "IAM Roles", icon: iconOf(KeyOutlined), iconColor: "#d46b08", to: "/iam/roles" },
          { key: "iam_perms", label: "IAM Perms", icon: iconOf(DeploymentUnitOutlined), iconColor: "#0958d9", to: "/iam/permissions" },
          { key: "settings", label: "Cài đặt", icon: iconOf(SettingOutlined), iconColor: "#595959", to: "/settings" }
        ]
      }
    ];
  }

  return [
    {
      label: "Tổng quan",
      items: [
        { key: "dashboard", label: "Bảng điều hành", icon: iconOf(DashboardOutlined), iconColor: "#1677ff", to: "/" },
        { key: "checkin", label: "Chấm công", icon: iconOf(CameraOutlined), iconColor: "#13ae52", to: "/checkin", badge: { text: "LIVE", tone: "green" } },
        { key: "timelog", label: "Bảng giờ công", icon: iconOf(FieldTimeOutlined), iconColor: "#fa8c16", to: "/timelog" },
        { key: "schedules", label: "Ca làm", icon: iconOf(CalendarOutlined), iconColor: "#eb2f96", to: "/schedules" }
      ]
    },
    {
      label: "Nhân sự",
      items: [
        { key: "employees", label: "Nhân viên", icon: iconOf(TeamOutlined), iconColor: "#1677ff", to: "/employees" },
        { key: "departments", label: "Phòng ban", icon: iconOf(ApartmentOutlined), iconColor: "#2f54eb", to: "/departments" },
        { key: "leave", label: "Nghỉ phép", icon: iconOf(AuditOutlined), iconColor: "#f5222d", to: "/leave" }
      ]
    },
    {
      label: "Phân tích",
      items: [
        { key: "reports", label: "Báo cáo", icon: iconOf(BarChartOutlined), iconColor: "#0f9d8a", to: "/reports" },
        { key: "overtime", label: "Tăng ca", icon: iconOf(ClockCircleOutlined), iconColor: "#fa541c", to: "/overtime" },
        { key: "payroll", label: "Bảng lương", icon: iconOf(WalletOutlined), iconColor: "#52c41a", to: "/payroll" }
      ]
    },
    {
      label: "Hệ thống",
      items: [
        { key: "notifications", label: "Thông báo", icon: iconOf(BellOutlined), iconColor: "#722ed1", to: "/notifications" },
        { key: "settings", label: "Cài đặt", icon: iconOf(SettingOutlined), iconColor: "#595959", to: "/settings" }
      ]
    }
  ];
}

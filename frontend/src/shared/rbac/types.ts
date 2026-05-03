export type PermissionKey =
  | "dashboard.read"
  | "attendance.read"
  | "attendance.manage"
  | "timesheet.read"
  | "employees.read"
  | "departments.read"
  | "leave.read"
  | "leave.approve"
  | "reports.read"
  | "overtime.read"
  | "overtime.approve"
  | "payroll.read"
  | "notifications.read"
  | "settings.read"
  | "iam.manage"
  | "employee.portal";

export type RoleKey = "manager" | "employee" | "admin";

export type Permission = {
  id: string;
  key: PermissionKey;
  label: string;
  description?: string;
};

export type Role = {
  id: string;
  key: RoleKey;
  label: string;
  description?: string;
  permissionKeys: PermissionKey[];
};

export type User = {
  id: string;
  username: string;
  displayName: string;
  roleIds: string[];
  directPermissionKeys: PermissionKey[];
  active: boolean;
};


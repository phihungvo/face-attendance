import type { Permission, PermissionKey, Role, RoleKey, User } from "./types";

type RbacState = {
  permissions: Permission[];
  roles: Role[];
  users: User[];
};

const STORAGE_KEY = "rbac-state-v1";
const EVENT = "rbac:change";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function seedState(): RbacState {
  const permissions: Permission[] = [
    { id: "p_dashboard.read", key: "dashboard.read", label: "Xem dashboard" },
    { id: "p_attendance.read", key: "attendance.read", label: "Xem chấm công" },
    { id: "p_attendance.manage", key: "attendance.manage", label: "Quản lý chấm công" },
    { id: "p_timesheet.read", key: "timesheet.read", label: "Xem bảng giờ công" },
    { id: "p_employees.read", key: "employees.read", label: "Xem nhân viên" },
    { id: "p_departments.read", key: "departments.read", label: "Xem phòng ban" },
    { id: "p_leave.read", key: "leave.read", label: "Xem nghỉ phép" },
    { id: "p_leave.approve", key: "leave.approve", label: "Duyệt nghỉ phép" },
    { id: "p_reports.read", key: "reports.read", label: "Xem báo cáo" },
    { id: "p_overtime.read", key: "overtime.read", label: "Xem tăng ca" },
    { id: "p_overtime.approve", key: "overtime.approve", label: "Duyệt tăng ca" },
    { id: "p_payroll.read", key: "payroll.read", label: "Xem bảng lương" },
    { id: "p_notifications.read", key: "notifications.read", label: "Xem thông báo" },
    { id: "p_settings.read", key: "settings.read", label: "Xem cài đặt" },
    { id: "p_iam.manage", key: "iam.manage", label: "Quản lý phân quyền (IAM)" },
    { id: "p_employee.portal", key: "employee.portal", label: "Truy cập cổng nhân viên" }
  ];

  const managerRole: Role = {
    id: "r_manager",
    key: "manager",
    label: "Quản lý",
    description: "Quyền quản lý hệ thống (tạm thời chưa có admin)",
    permissionKeys: permissions
      .map((p) => p.key)
      .filter((k) => k !== "employee.portal")
  };

  const employeeRole: Role = {
    id: "r_employee",
    key: "employee",
    label: "Nhân viên",
    description: "Cổng nhân viên (index3)",
    permissionKeys: ["employee.portal", "notifications.read", "settings.read"]
  };

  const roles: Role[] = [managerRole, employeeRole];

  const users: User[] = [
    {
      id: "u_manager",
      username: "admin",
      displayName: "Admin Trưởng",
      roleIds: ["r_manager"],
      directPermissionKeys: [],
      active: true
    },
    {
      id: "u_employee",
      username: "employee",
      displayName: "Nguyễn Văn An",
      roleIds: ["r_employee"],
      directPermissionKeys: [],
      active: true
    }
  ];

  return { permissions, roles, users };
}

function readState(): RbacState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as RbacState;
    if (!parsed?.permissions?.length || !parsed?.roles?.length || !parsed?.users?.length) return seedState();
    return parsed;
  } catch {
    return seedState();
  }
}

function writeState(next: RbacState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

export function getRbacState(): RbacState {
  if (typeof window === "undefined") return seedState();
  return readState();
}

export function resetRbacState() {
  if (typeof window === "undefined") return;
  writeState(seedState());
}

export function listPermissions() {
  return getRbacState().permissions;
}

export function listRoles() {
  return getRbacState().roles;
}

export function listUsers() {
  return getRbacState().users;
}

export function findUserByUsername(username: string) {
  return listUsers().find((u) => u.username === username) ?? null;
}

export function ensureUser(username: string) {
  const st = getRbacState();
  const found = st.users.find((u) => u.username === username);
  if (found) return found;

  const next: User = {
    id: uid("u"),
    username,
    displayName: username,
    roleIds: [],
    directPermissionKeys: [],
    active: true
  };
  const updated: RbacState = { ...st, users: [next, ...st.users] };
  writeState(updated);
  return next;
}

export function upsertRole(input: { id?: string; key: RoleKey; label: string; description?: string; permissionKeys: PermissionKey[] }) {
  const st = getRbacState();
  const id = input.id ?? uid("r");
  const role: Role = { id, key: input.key, label: input.label, description: input.description, permissionKeys: input.permissionKeys };
  const roles = st.roles.some((r) => r.id === id) ? st.roles.map((r) => (r.id === id ? role : r)) : [role, ...st.roles];
  writeState({ ...st, roles });
  return role;
}

export function deleteRole(roleId: string) {
  const st = getRbacState();
  writeState({
    ...st,
    roles: st.roles.filter((r) => r.id !== roleId),
    users: st.users.map((u) => ({ ...u, roleIds: u.roleIds.filter((id) => id !== roleId) }))
  });
}

export function upsertUser(input: {
  id?: string;
  username: string;
  displayName: string;
  roleIds: string[];
  directPermissionKeys: PermissionKey[];
  active: boolean;
}) {
  const st = getRbacState();
  const id = input.id ?? uid("u");
  const user: User = { ...input, id };
  const users = st.users.some((u) => u.id === id) ? st.users.map((u) => (u.id === id ? user : u)) : [user, ...st.users];
  writeState({ ...st, users });
  return user;
}

export function deleteUser(userId: string) {
  const st = getRbacState();
  writeState({ ...st, users: st.users.filter((u) => u.id !== userId) });
}

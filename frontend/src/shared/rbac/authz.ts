import type { PermissionKey, Role, User } from "./types";
import { listRoles } from "./store";

export function getUserRoles(user: User): Role[] {
  const roles = listRoles();
  return roles.filter((r) => user.roleIds.includes(r.id));
}

export function getUserPermissionKeys(user: User): Set<PermissionKey> {
  const keys = new Set<PermissionKey>();
  for (const k of user.directPermissionKeys) keys.add(k);
  for (const role of getUserRoles(user)) {
    for (const k of role.permissionKeys) keys.add(k);
  }
  return keys;
}

export function hasPermission(user: User, permission: PermissionKey) {
  return getUserPermissionKeys(user).has(permission);
}

export function hasAnyPermission(user: User, permissions: PermissionKey[]) {
  const set = getUserPermissionKeys(user);
  return permissions.some((p) => set.has(p));
}


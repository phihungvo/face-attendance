import type { ReactNode } from "react";
import { useAuth } from "../auth/auth";
import type { PermissionKey } from "./types";

export default function RequirePermission({ permission, fallback, children }: { permission: PermissionKey; fallback?: ReactNode; children: ReactNode }) {
  const auth = useAuth();
  if (!auth.token) return fallback ?? null;
  if (!auth.permissionKeys.includes(permission)) return fallback ?? null;
  return <>{children}</>;
}

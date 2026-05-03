import { useCallback, useSyncExternalStore } from "react";
import type { PermissionKey, User } from "./types";
import { getRbacState } from "./store";
import { getUserPermissionKeys } from "./authz";

const EVENT = "rbac:change";

export function emitRbacChange() {
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

function snapshot() {
  return getRbacState();
}

export function useRbacState() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function usePermissionSet(user: User | null) {
  const st = useRbacState();
  return useCallback(
    (p: PermissionKey) => {
      if (!user) return false;
      // st referenced to re-render when RBAC changes
      void st;
      return getUserPermissionKeys(user).has(p);
    },
    [st, user]
  );
}


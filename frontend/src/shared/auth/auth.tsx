import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { api, type ApiResponse, getApiErrorMessage, getToken, setToken } from "../lib/apiClient";
import { useEffect } from "react";

type AuthContextValue = {
  token: string | null;
  username: string | null;
  roleKeys: string[];
  permissionKeys: string[];
  meLoading: boolean;
  login(username: string, password: string): Promise<void>;
  register(username: string, password: string, role: "employee" | "manager"): Promise<void>;
  refreshMe(): Promise<void>;
  logout(): void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [username, setUsername] = useState<string | null>(null);
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [meLoading, setMeLoading] = useState(false);

  async function refreshMe() {
    const t = getToken();
    if (!t) return;
    setMeLoading(true);
    try {
      const res = await api.get<ApiResponse<{ username: string; role_keys: string[]; permission_keys: string[] }>>("/auth/me");
      const me = res.data.result;
      if (!me) throw new Error("Không thể lấy thông tin user");
      setUsername(me.username);
      setRoleKeys(me.role_keys ?? []);
      setPermissionKeys(me.permission_keys ?? []);
    } finally {
      setMeLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    refreshMe().catch(() => {
      // token invalid or server down -> logout state
      setToken(null);
      setTokenState(null);
      setUsername(null);
      setRoleKeys([]);
      setPermissionKeys([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      username,
      roleKeys,
      permissionKeys,
      meLoading,
      async login(username, password) {
        const res = await api.post<ApiResponse<{ access_token: string }>>("/auth/login", { username, password });
        const t = res.data.result?.access_token;
        if (!t) throw new Error("Không nhận được token từ server");
        setToken(t);
        setTokenState(t);
        await refreshMe();
      },
      async register(username, password, role) {
        const res = await api.post<ApiResponse<{ access_token: string }>>("/auth/register", { username, password, role });
        const t = res.data.result?.access_token;
        if (!t) throw new Error("Không nhận được token từ server");
        setToken(t);
        setTokenState(t);
        await refreshMe();
      },
      refreshMe,
      logout() {
        setToken(null);
        setTokenState(null);
        setUsername(null);
        setRoleKeys([]);
        setPermissionKeys([]);
      }
    }),
    [meLoading, permissionKeys, roleKeys, token, username]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function formatAuthError(e: unknown) {
  return getApiErrorMessage(e);
}

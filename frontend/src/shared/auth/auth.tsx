import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { api, type ApiResponse, getApiErrorMessage, getCompanyId, getToken, setCompanyId, setToken } from "../lib/apiClient";
import { useEffect } from "react";

type AuthContextValue = {
  token: string | null;
  username: string | null;
  companyId: number | null;
  companyName: string | null;
  selectedCompanyId: number | null;
  setSelectedCompanyId(companyId: number | null): void;
  roleKeys: string[];
  permissionKeys: string[];
  meLoading: boolean;
  login(identifier: string, password: string): Promise<void>;
  register(username: string, password: string, role: "employee" | "manager"): Promise<void>;
  acceptInvite(token: string, password: string): Promise<void>;
  refreshMe(): Promise<void>;
  logout(): void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [username, setUsername] = useState<string | null>(null);
  const [companyId, setCompanyIdState] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<number | null>(() => getCompanyId());
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [meLoading, setMeLoading] = useState(false);

  async function refreshMe() {
    const t = getToken();
    if (!t) return;
    setMeLoading(true);
    try {
      const res = await api.get<ApiResponse<{ username: string; company_id?: number | null; company_name?: string | null; role_keys: string[]; permission_keys: string[] }>>("/auth/me");
      const me = res.data.result;
      if (!me) throw new Error("Không thể lấy thông tin user");
      setUsername(me.username);
      const cid = (me.company_id ?? null) as number | null;
      setCompanyIdState(cid);
      setCompanyName((me.company_name ?? null) as string | null);
      // Default selected company to user's company on first login.
      if (!getCompanyId() && cid) {
        setCompanyId(cid);
        setSelectedCompanyIdState(cid);
      }
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
      async login(identifier, password) {
        const res = await api.post<ApiResponse<{ access_token: string }>>("/auth/login", { identifier, password });
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
      async acceptInvite(token, password) {
        const res = await api.post<ApiResponse<{ access_token: string }>>("/auth/activate", { token, password });
        const t = res.data.result?.access_token;
        if (!t) throw new Error("Không nhận được token từ server");
        setToken(t);
        setTokenState(t);
        await refreshMe();
      },
      refreshMe,
      companyId,
      companyName,
      selectedCompanyId,
      setSelectedCompanyId(companyId) {
        setCompanyId(companyId);
        setSelectedCompanyIdState(companyId);
      },
      logout() {
        setToken(null);
        setCompanyId(null);
        setTokenState(null);
        setUsername(null);
        setCompanyIdState(null);
        setCompanyName(null);
        setSelectedCompanyIdState(null);
        setRoleKeys([]);
        setPermissionKeys([]);
      }
    }),
    [companyId, companyName, meLoading, permissionKeys, roleKeys, selectedCompanyId, token, username]
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

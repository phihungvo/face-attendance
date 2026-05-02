import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { api, type ApiResponse, getApiErrorMessage, getToken, setToken } from "./apiClient";

type AuthContextValue = {
  token: string | null;
  login(username: string, password: string): Promise<void>;
  register(username: string, password: string): Promise<void>;
  logout(): void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      async login(username, password) {
        const res = await api.post<ApiResponse<{ access_token: string }>>("/auth/login", { username, password });
        const t = res.data.result?.access_token;
        if (!t) throw new Error("Không nhận được token từ server");
        setToken(t);
        setTokenState(t);
      },
      async register(username, password) {
        const res = await api.post<ApiResponse<{ access_token: string }>>("/auth/register", { username, password });
        const t = res.data.result?.access_token;
        if (!t) throw new Error("Không nhận được token từ server");
        setToken(t);
        setTokenState(t);
      },
      logout() {
        setToken(null);
        setTokenState(null);
      }
    }),
    [token]
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

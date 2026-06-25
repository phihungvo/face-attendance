import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';

import { configureApiClientAuth } from '@/services/http/api-client';

import { changeMyPassword, getMe, login as loginRequest } from '../api/auth-service';
import {
  clearAuthStorage,
  getStoredCompanyId,
  getStoredToken,
  setStoredCompanyId,
  setStoredToken,
} from '../storage/token-storage';
import type { AuthMe, AuthSession, ChangePasswordPayload, LoginPayload } from '../types';

type AuthContextValue = {
  changePassword: (payload: ChangePasswordPayload) => Promise<void>;
  companyId: number | null;
  companyLogoDataUrl: string | null;
  companyName: string | null;
  errorMessage: string | null;
  hasPermission: (permissionKey: string) => boolean;
  hasRole: (roleKey: string) => boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  permissionKeys: string[];
  refreshMe: () => Promise<void>;
  roleKeys: string[];
  selectedCompanyId: number | null;
  session: AuthSession | null;
  setSelectedCompanyId: (companyId: number | null) => Promise<void>;
  token: string | null;
  username: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function createSession(token: string, me: AuthMe): AuthSession {
  return {
    ...me,
    roles: me.role_keys,
    token,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const selectedCompanyIdRef = useRef<number | null>(null);
  const clearingPromiseRef = useRef<Promise<void> | null>(null);
  const sessionVersionRef = useRef(0);

  const clearSessionState = useCallback(async () => {
    if (clearingPromiseRef.current) {
      return clearingPromiseRef.current;
    }

    clearingPromiseRef.current = (async () => {
      sessionVersionRef.current += 1;
      tokenRef.current = null;
      selectedCompanyIdRef.current = null;
      setToken(null);
      setSession(null);
      setSelectedCompanyIdState(null);
      await clearAuthStorage();
    })().finally(() => {
      clearingPromiseRef.current = null;
    });

    return clearingPromiseRef.current;
  }, []);

  useEffect(() => {
    configureApiClientAuth({
      getAuthToken: () => tokenRef.current,
      getCompanyId: () => selectedCompanyIdRef.current,
      onUnauthorized: async ({ token: requestToken }) => {
        if (!requestToken || requestToken === tokenRef.current) {
          await clearSessionState();
        }
      },
    });
  }, [clearSessionState]);

  const hydrateSession = useCallback(async (nextToken: string, preferredCompanyId?: number | null) => {
    const expectedSessionVersion = sessionVersionRef.current;
    const me = await getMe(nextToken);
    if (sessionVersionRef.current !== expectedSessionVersion) {
      return;
    }

    const companyId = preferredCompanyId ?? me.company_id ?? null;
    const tokenChanged = tokenRef.current !== nextToken;
    tokenRef.current = nextToken;
    selectedCompanyIdRef.current = companyId;
    setToken(nextToken);
    setSession(createSession(nextToken, me));
    setSelectedCompanyIdState(companyId);
    await setStoredToken(nextToken, { rotateScope: tokenChanged });
    await setStoredCompanyId(companyId);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const [storedToken, storedCompanyId] = await Promise.all([getStoredToken(), getStoredCompanyId()]);
        if (!mounted) {
          return;
        }

        selectedCompanyIdRef.current = storedCompanyId;
        setSelectedCompanyIdState(storedCompanyId);

        if (!storedToken) {
          return;
        }

        await hydrateSession(storedToken, storedCompanyId);
      } catch {
        await clearSessionState();
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [clearSessionState, hydrateSession]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        await clearSessionState();
        const tokenResponse = await loginRequest(payload);
        const nextToken = tokenResponse.access_token;
        if (!nextToken) {
          throw new Error('Không nhận được token từ server');
        }
        await hydrateSession(nextToken, null);
      } catch (error) {
        const message = getErrorMessage(error, 'Đăng nhập thất bại');
        setErrorMessage(message);
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    [clearSessionState, hydrateSession]
  );

  const logout = useCallback(async () => {
    setErrorMessage(null);
    await clearSessionState();
  }, [clearSessionState]);

  const refreshMe = useCallback(async () => {
    const currentToken = tokenRef.current;
    if (!currentToken) {
      return;
    }

    try {
      await hydrateSession(currentToken, selectedCompanyIdRef.current);
    } catch (error) {
      await clearSessionState();
      throw error;
    }
  }, [clearSessionState, hydrateSession]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && tokenRef.current) {
        refreshMe().catch(() => {
          // refreshMe clears invalid sessions.
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshMe]);

  const setSelectedCompanyId = useCallback(async (companyId: number | null) => {
    selectedCompanyIdRef.current = companyId;
    setSelectedCompanyIdState(companyId);
    await setStoredCompanyId(companyId);
  }, []);

  const changePassword = useCallback(
    async (payload: ChangePasswordPayload) => {
      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        await changeMyPassword(tokenRef.current ?? undefined, payload);
      } catch (error) {
        const message = getErrorMessage(error, 'Không thể đổi mật khẩu');
        setErrorMessage(message);
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const roleKeys = useMemo(() => session?.role_keys ?? [], [session?.role_keys]);
  const permissionKeys = useMemo(() => session?.permission_keys ?? [], [session?.permission_keys]);

  const value = useMemo<AuthContextValue>(
    () => ({
      changePassword,
      companyId: session?.company_id ?? null,
      companyLogoDataUrl: session?.company_logo_data_url ?? null,
      companyName: session?.company_name ?? null,
      errorMessage,
      hasPermission: (permissionKey: string) => permissionKeys.includes(permissionKey),
      hasRole: (roleKey: string) => roleKeys.includes(roleKey),
      isLoading,
      isSubmitting,
      login,
      logout,
      permissionKeys,
      refreshMe,
      roleKeys,
      selectedCompanyId,
      session,
      setSelectedCompanyId,
      token,
      username: session?.username ?? null,
    }),
    [
      changePassword,
      errorMessage,
      isLoading,
      isSubmitting,
      login,
      logout,
      permissionKeys,
      refreshMe,
      roleKeys,
      selectedCompanyId,
      session,
      setSelectedCompanyId,
      token,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}

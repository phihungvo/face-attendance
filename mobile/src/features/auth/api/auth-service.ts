import { apiClient } from '@/services/http/api-client';

import type { AuthMe, ChangePasswordPayload, LoginPayload, TokenResponse } from '../types';

export function login(payload: LoginPayload) {
  return apiClient.post<TokenResponse>('/auth/login', payload, {
    skipUnauthorizedHandler: true,
  });
}

export function getMe(authToken?: string) {
  return apiClient.get<AuthMe>('/auth/me', { authToken });
}

export function changeMyPassword(authToken: string | undefined, payload: ChangePasswordPayload) {
  return apiClient.post<{ changed: boolean }>('/auth/change-password', payload, { authToken });
}

import { env } from '@/config/env';
import type { ApiResponse } from '@/shared/types/api';

import { HttpError } from './http-error';

type QueryParams = Record<string, string | number | boolean | null | undefined>;

type RequestOptions = Omit<RequestInit, 'body'> & {
  authToken?: string;
  body?: unknown;
  skipUnauthorizedHandler?: boolean;
  query?: QueryParams;
};

type ApiClientAuthConfig = {
  getAuthToken?: () => string | null;
  getCompanyId?: () => number | null;
  onUnauthorized?: (context: { path: string; status: number; token: string | null }) => void | Promise<void>;
};

const API_SUCCESS_CODE = 1000;
const REQUEST_TIMEOUT_MS = 30_000;

let authConfig: ApiClientAuthConfig = {};
let unauthorizedHandlerPromise: Promise<void> | null = null;

export function configureApiClientAuth(config: ApiClientAuthConfig) {
  authConfig = config;
}

function buildUrl(path: string, query?: QueryParams) {
  const url = new URL(`${env.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function handleUnauthorized(context: { path: string; status: number; token: string | null }) {
  if (!authConfig.onUnauthorized) {
    return;
  }

  unauthorizedHandlerPromise ??= Promise.resolve(authConfig.onUnauthorized(context)).finally(() => {
    unauthorizedHandlerPromise = null;
  });

  await unauthorizedHandlerPromise;
}

async function request<T>(path: string, options: RequestOptions = {}) {
  const { authToken, body, headers, query, signal, skipUnauthorizedHandler, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const token = authToken ?? authConfig.getAuthToken?.() ?? null;
  const companyId = authConfig.getCompanyId?.() ?? null;

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response: Response;

  try {
    response = await fetch(buildUrl(path, query), {
      ...fetchOptions,
      headers: {
        Accept: 'application/json',
        ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(companyId ? { 'X-Company-Id': String(companyId) } : {}),
        ...headers,
      },
      signal: controller.signal,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'Kết nối quá thời gian chờ. Vui lòng thử lại.'
        : 'Không thể kết nối đến máy chủ';
    throw new HttpError(message, 0, error);
  } finally {
    clearTimeout(timeout);
  }

  const payload = await parseJson(response);

  if (!response.ok) {
    const message =
      typeof payload?.message === 'string' ? payload.message : 'Không thể kết nối đến máy chủ';
    if (response.status === 401 && !skipUnauthorizedHandler) {
      await handleUnauthorized({ path, status: response.status, token });
    }
    throw new HttpError(message, response.status, payload);
  }

  if (payload && typeof payload === 'object' && 'code' in payload && payload.code !== API_SUCCESS_CODE) {
    const message = typeof payload.message === 'string' ? payload.message : 'Có lỗi xảy ra';
    throw new HttpError(message, 200, payload);
  }

  if (payload && typeof payload === 'object' && 'result' in payload) {
    return (payload as ApiResponse<T>).result;
  }

  return payload as T;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, body, method: 'POST' }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, body, method: 'PUT' }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

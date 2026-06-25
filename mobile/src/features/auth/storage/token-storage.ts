import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'face_attendance.mobile_token.v1';
const COMPANY_ID_KEY = 'face_attendance.company_id.v1';
const SESSION_SCOPE_KEY = 'face_attendance.session_scope.v1';

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

function newSessionScope() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getWebStorage() {
  return globalThis.sessionStorage ?? null;
}

async function readValue(key: string) {
  if (Platform.OS === 'web') {
    return getWebStorage()?.getItem(key) ?? null;
  }

  return SecureStore.getItemAsync(key, secureStoreOptions);
}

async function writeValue(key: string, value: string) {
  if (Platform.OS === 'web') {
    getWebStorage()?.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value, secureStoreOptions);
}

async function deleteValue(key: string) {
  if (Platform.OS === 'web') {
    getWebStorage()?.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

export async function getStoredToken() {
  return readValue(TOKEN_KEY);
}

export async function setStoredToken(token: string, options: { rotateScope?: boolean } = {}) {
  await writeValue(TOKEN_KEY, token);
  if (options.rotateScope ?? true) {
    await writeValue(SESSION_SCOPE_KEY, newSessionScope());
  }
}

export async function clearStoredToken() {
  await deleteValue(TOKEN_KEY);
  await deleteValue(SESSION_SCOPE_KEY);
}

export async function getStoredCompanyId() {
  const rawValue = await readValue(COMPANY_ID_KEY);
  if (!rawValue) {
    return null;
  }

  const companyId = Number(rawValue);
  return Number.isFinite(companyId) && companyId > 0 ? companyId : null;
}

export async function setStoredCompanyId(companyId: number | null) {
  if (!companyId) {
    await deleteValue(COMPANY_ID_KEY);
    return;
  }

  await writeValue(COMPANY_ID_KEY, String(companyId));
}

export async function getStoredAuthCacheScope() {
  const existingScope = await readValue(SESSION_SCOPE_KEY);
  if (existingScope) {
    return existingScope;
  }

  const token = await getStoredToken();
  if (!token) {
    return 'guest';
  }

  const nextScope = newSessionScope();
  await writeValue(SESSION_SCOPE_KEY, nextScope);
  return nextScope;
}

export async function clearAuthStorage() {
  await clearStoredToken();
  await setStoredCompanyId(null);
}

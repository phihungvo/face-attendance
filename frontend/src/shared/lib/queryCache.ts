type CacheKey = string;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<CacheKey, CacheEntry<unknown>>();
const inflight = new Map<CacheKey, Promise<unknown>>();

export function makeKey(parts: Array<string | number | boolean | null | undefined>) {
  return parts.map((p) => (p == null ? "null" : String(p))).join("|");
}

export function getCached<T>(key: CacheKey): T | undefined {
  const e = store.get(key);
  if (!e) return undefined;
  if (Date.now() > e.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return e.value as T;
}

export function setCached<T>(key: CacheKey, value: T, ttlMs: number) {
  store.set(key, { value, expiresAt: Date.now() + Math.max(0, ttlMs) });
}

export function invalidateKey(key: CacheKey) {
  store.delete(key);
}

export function invalidatePrefix(prefix: string) {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

export async function cached<T>(key: CacheKey, fetcher: () => Promise<T>, ttlMs: number): Promise<T> {
  const hit = getCached<T>(key);
  if (hit !== undefined) return hit;

  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const p = (async () => {
    try {
      const v = await fetcher();
      setCached(key, v, ttlMs);
      return v;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}


import { useEffect, useMemo, useState } from "react";
import { cached, getCached, makeKey } from "../lib/queryCache";

export type CachedQueryState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh(): void;
};

export function useCachedQuery<T>(opts: {
  key?: string;
  keyParts?: Array<string | number | boolean | null | undefined>;
  fetcher: () => Promise<T>;
  ttlMs: number;
  enabled?: boolean;
  initialData?: T | null;
}) {
  const enabled = opts.enabled !== false;
  const key = useMemo(() => opts.key ?? makeKey(opts.keyParts ?? []), [opts.key, opts.keyParts]);
  const [data, setData] = useState<T | null>(() => (opts.initialData ?? null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setData(opts.initialData ?? null);
      setError(null);
      setLoading(false);
      return;
    }
    const hit = getCached<T>(key);
    if (hit !== undefined) {
      setData(hit);
      setError(null);
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        setData(opts.initialData ?? null);
        const v = await cached<T>(key, opts.fetcher, opts.ttlMs);
        if (!alive) return;
        setData(v);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Không tải được dữ liệu");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [enabled, key, nonce, opts.fetcher, opts.initialData, opts.ttlMs]);

  return {
    data,
    loading,
    error,
    refresh: () => setNonce((n) => n + 1)
  } satisfies CachedQueryState<T>;
}

import { useEffect, useRef } from "react";

type AutoScanOptions<T> = {
  enabled: boolean;
  intervalMs?: number;
  capture: () => Promise<Blob>;
  scan: (blob: Blob) => Promise<T>;
  onResult: (res: T) => void | Promise<void>;
  onError?: (err: unknown) => void;
};

export function useAutoScan<T>({
  enabled,
  intervalMs = 1200,
  capture,
  scan,
  onResult,
  onError
}: AutoScanOptions<T>) {
  const inFlightRef = useRef(false);
  const lastTickRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    let alive = true;
    const tick = async () => {
      if (!alive) return;
      if (document.visibilityState !== "visible") return;
      if (inFlightRef.current) return;

      const now = Date.now();
      if (now - lastTickRef.current < intervalMs) return;
      lastTickRef.current = now;

      inFlightRef.current = true;
      try {
        const blob = await capture();
        const res = await scan(blob);
        await onResult(res);
      } catch (e) {
        onError?.(e);
      } finally {
        inFlightRef.current = false;
      }
    };

    const timer = window.setInterval(() => {
      tick().catch(() => {});
    }, Math.max(300, Math.floor(intervalMs / 2)));

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [capture, enabled, intervalMs, onError, onResult, scan]);
}


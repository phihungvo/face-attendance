import { useCallback, useEffect, useState } from "react";

export type GeoState = {
  supported: boolean;
  enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  loading: boolean;
  error: string | null;
  refresh(): void;
};

export function useGeoPosition(options?: { watch?: boolean; auto?: boolean; timeoutMs?: number; maximumAgeMs?: number }) {
  const supported = typeof navigator !== "undefined" && !!navigator.geolocation;
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracyMeters, setAccuracy] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!supported) return;
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setAccuracy(Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null);
        setLoading(false);
      },
      (e) => {
        setError(e?.message || "Không lấy được vị trí");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: options?.timeoutMs ?? 8000, maximumAge: options?.maximumAgeMs ?? 10_000 }
    );
  }, [options?.maximumAgeMs, options?.timeoutMs, supported]);

  useEffect(() => {
    if (!supported) return;
    if (options?.auto === false) return;
    refresh();
  }, [options?.auto, refresh, supported]);

  useEffect(() => {
    if (!supported) return;
    if (!options?.watch) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setAccuracy(Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null);
        setError(null);
        setLoading(false);
      },
      (e) => setError(e?.message || "Không lấy được vị trí"),
      { enableHighAccuracy: true, maximumAge: options?.maximumAgeMs ?? 10_000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [options?.maximumAgeMs, options?.watch, supported]);

  return {
    supported,
    enabled: supported && latitude != null && longitude != null,
    latitude,
    longitude,
    accuracyMeters,
    loading,
    error,
    refresh
  } satisfies GeoState;
}

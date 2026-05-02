import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type CameraState = {
  ready: boolean;
  activeDeviceId: string | null;
  devices: MediaDeviceInfo[];
  error: string | null;
};

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === "videoinput"));
    } catch (e: any) {
      setError(e?.message || "Không thể liệt kê camera");
    }
  }, []);

  const stop = useCallback(() => {
    setReady(false);
    const s = streamRef.current;
    streamRef.current = null;
    if (s) s.getTracks().forEach((t) => t.stop());
    const v = videoRef.current;
    if (v) v.srcObject = null;
  }, []);

  const start = useCallback(
    async (opts?: { deviceId?: string }) => {
      try {
        setError(null);
        stop();
        const constraints: MediaStreamConstraints = {
          video: opts?.deviceId ? { deviceId: { exact: opts.deviceId } } : { facingMode: "user" },
          audio: false
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const settings = track?.getSettings?.();
        setActiveDeviceId((settings as any)?.deviceId ?? opts?.deviceId ?? null);

        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();
        setReady(true);
        await refreshDevices();
      } catch (e: any) {
        setError(e?.message || "Không thể bật camera");
      }
    },
    [refreshDevices, stop]
  );

  const switchCamera = useCallback(async () => {
    const cams = devices;
    if (cams.length <= 1) return;
    const currentIndex = Math.max(
      0,
      cams.findIndex((d) => d.deviceId === activeDeviceId)
    );
    const next = cams[(currentIndex + 1) % cams.length];
    await start({ deviceId: next.deviceId });
  }, [activeDeviceId, devices, start]);

  const capture = useCallback(async (opts?: { quality?: number; type?: string }) => {
    const v = videoRef.current;
    if (!v) throw new Error("Camera chưa sẵn sàng");
    const w = v.videoWidth || 1280;
    const h = v.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Không thể capture");
    ctx.drawImage(v, 0, 0, w, h);
    const type = opts?.type || "image/jpeg";
    const quality = opts?.quality ?? 0.9;
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, quality);
    });
    return blob;
  }, []);

  useEffect(() => {
    const handler = () => refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", handler as any);
    refreshDevices();
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", handler as any);
  }, [refreshDevices]);

  const state: CameraState = useMemo(
    () => ({ ready, devices, activeDeviceId, error }),
    [activeDeviceId, devices, error, ready]
  );

  return { videoRef, state, start, stop, switchCamera, capture };
}


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
  const desiredOnRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const startRequestRef = useRef(0);
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
    desiredOnRef.current = false;
    setReady(false);
    const s = streamRef.current;
    streamRef.current = null;
    if (s) s.getTracks().forEach((t) => t.stop());
    const v = videoRef.current;
    if (v) v.srcObject = null;
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const start = useCallback(
    async (opts?: { deviceId?: string }) => {
      const requestId = startRequestRef.current + 1;
      startRequestRef.current = requestId;
      try {
        setError(null);
        stop();
        desiredOnRef.current = true;
        if (!window.isSecureContext) {
          const proto = typeof window !== "undefined" ? window.location.protocol : "";
          const host = typeof window !== "undefined" ? window.location.host : "";
          throw new Error(
            `Camera bị chặn do trang chưa chạy ở secure context (HTTPS hoặc localhost). Hiện tại: ${proto}//${host}`
          );
        }
        if (!navigator.mediaDevices) {
          throw new Error("Trình duyệt không hỗ trợ camera (navigator.mediaDevices không tồn tại)");
        }
        if (!navigator.mediaDevices.getUserMedia) {
          throw new Error("Trình duyệt không hỗ trợ camera (getUserMedia)");
        }
        const constraints: MediaStreamConstraints = {
          video: opts?.deviceId
            ? { deviceId: { exact: opts.deviceId } }
            : {
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 720 }
              },
          audio: false
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (requestId !== startRequestRef.current || !desiredOnRef.current) {
          stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const settings = track?.getSettings?.();
        setActiveDeviceId((settings as any)?.deviceId ?? opts?.deviceId ?? null);

        // iOS Safari may stop the camera stream during viewport/zoom/orientation changes.
        // If the user still intends the camera to be on, attempt a lightweight restart.
        if (track) {
          track.onended = () => {
            if (!desiredOnRef.current) return;
            if (document.visibilityState !== "visible") return;
            if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
            restartTimerRef.current = window.setTimeout(() => {
              if (!desiredOnRef.current) return;
              start({ deviceId: (settings as any)?.deviceId ?? opts?.deviceId });
            }, 250);
          };
        }

        const v = videoRef.current;
        if (!v) {
          stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
          streamRef.current = null;
          return;
        }
        v.srcObject = stream;
        try {
          await v.play();
        } catch (e: any) {
          const name = String(e?.name || "");
          const message = String(e?.message || "");
          if (name === "AbortError" || message.includes("The play() request was interrupted by a new load request.")) {
            return;
          }
          if (requestId !== startRequestRef.current || !desiredOnRef.current) {
            return;
          }
          throw e;
        }
        if (requestId !== startRequestRef.current || !desiredOnRef.current) return;
        setReady(true);
        await refreshDevices();
      } catch (e: any) {
        const name = String(e?.name || "");
        const message = String(e?.message || "");
        if (name === "AbortError" || message.includes("The play() request was interrupted by a new load request.")) {
          return;
        }
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setError("Permission denied: vui lòng cấp quyền camera cho website trong trình duyệt và thử lại.");
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setError("Không tìm thấy camera. Hãy kiểm tra thiết bị hoặc kết nối camera ngoài.");
        } else if (name === "NotReadableError" || name === "TrackStartError") {
          setError("Không thể mở camera (đang bị ứng dụng khác sử dụng hoặc bị OS chặn).");
        } else {
          setError(e?.message || "Không thể bật camera");
        }
      }
    },
    [refreshDevices, stop]
  );

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (!desiredOnRef.current) return;
      // If browser killed the stream while hidden, restore when returning.
      if (!streamRef.current || streamRef.current.getTracks().every((t) => t.readyState !== "live")) {
        start({ deviceId: activeDeviceId ?? undefined }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [activeDeviceId, start]);

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

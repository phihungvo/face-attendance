import { useEffect, useMemo, useRef, useState } from "react";

type FaceDetectorBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type FaceDetectorLike = {
  detect(input: CanvasImageSource): Promise<Array<{ boundingBox: FaceDetectorBox }>>;
};

type FaceDetectorCtor = new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;

export type TrackedFace = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
};

export function useFaceTracking(videoEl: HTMLVideoElement | null, options?: { enabled?: boolean; maxFaces?: number; intervalMs?: number }) {
  const enabled = options?.enabled ?? true;
  const maxFaces = options?.maxFaces ?? 6;
  const intervalMs = options?.intervalMs ?? 180;

  const detectorRef = useRef<FaceDetectorLike | null>(null);
  const nextIdRef = useRef(1);
  const primaryIdRef = useRef<number | null>(null);
  const prevFacesRef = useRef<TrackedFace[]>([]);
  const [supported, setSupported] = useState(false);
  const [faces, setFaces] = useState<TrackedFace[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = (window as Window & { FaceDetector?: FaceDetectorCtor }).FaceDetector;
    if (!Ctor) {
      setSupported(false);
      detectorRef.current = null;
      return;
    }
    detectorRef.current = new Ctor({ fastMode: true, maxDetectedFaces: maxFaces });
    setSupported(true);
  }, [maxFaces]);

  useEffect(() => {
    if (!enabled || !supported || !videoEl || !detectorRef.current) {
      setFaces([]);
      prevFacesRef.current = [];
      primaryIdRef.current = null;
      return;
    }

    let alive = true;
    let inFlight = false;

    const distance = (a: TrackedFace, b: TrackedFace) => {
      const ax = a.x + a.width / 2;
      const ay = a.y + a.height / 2;
      const bx = b.x + b.width / 2;
      const by = b.y + b.height / 2;
      return Math.hypot(ax - bx, ay - by);
    };

    const tick = async () => {
      if (!alive || inFlight || !videoEl || videoEl.readyState < 2 || videoEl.videoWidth <= 0 || videoEl.videoHeight <= 0) return;
      inFlight = true;
      try {
        const detected = await detectorRef.current!.detect(videoEl);
        if (!alive) return;

        const normalized = detected
          .map((item) => ({
            x: Math.max(0, item.boundingBox.x),
            y: Math.max(0, item.boundingBox.y),
            width: Math.max(1, item.boundingBox.width),
            height: Math.max(1, item.boundingBox.height)
          }))
          .sort((a, b) => b.width * b.height - a.width * a.height)
          .slice(0, maxFaces);

        const prev = prevFacesRef.current;
        const remainingPrev = new Set(prev.map((face) => face.id));
        const next: TrackedFace[] = [];

        for (const box of normalized) {
          let matched: TrackedFace | null = null;
          let matchedDistance = Number.POSITIVE_INFINITY;

          for (const candidate of prev) {
            if (!remainingPrev.has(candidate.id)) continue;
            const dist = distance(candidate, { ...candidate, ...box, score: candidate.score });
            const threshold = Math.max(box.width, box.height) * 0.75;
            if (dist <= threshold && dist < matchedDistance) {
              matched = candidate;
              matchedDistance = dist;
            }
          }

          const id = matched?.id ?? nextIdRef.current++;
          if (matched) remainingPrev.delete(matched.id);

          const x = matched ? matched.x * 0.4 + box.x * 0.6 : box.x;
          const y = matched ? matched.y * 0.4 + box.y * 0.6 : box.y;
          const width = matched ? matched.width * 0.4 + box.width * 0.6 : box.width;
          const height = matched ? matched.height * 0.4 + box.height * 0.6 : box.height;
          const area = width * height;
          const centerBias =
            1 -
            Math.min(
              1,
              Math.hypot(x + width / 2 - videoEl.videoWidth / 2, y + height / 2 - videoEl.videoHeight / 2) /
                Math.max(videoEl.videoWidth, videoEl.videoHeight)
            );
          const persistenceBias = primaryIdRef.current === id ? area * 0.08 : 0;
          const score = area + centerBias * area * 0.35 + persistenceBias;

          next.push({ id, x, y, width, height, score });
        }

        next.sort((a, b) => b.score - a.score);
        primaryIdRef.current = next[0]?.id ?? null;
        prevFacesRef.current = next;
        setFaces(next);
      } catch {
        if (!alive) return;
        setFaces([]);
        prevFacesRef.current = [];
        primaryIdRef.current = null;
      } finally {
        inFlight = false;
      }
    };

    const timer = window.setInterval(() => {
      tick().catch(() => {});
    }, intervalMs);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [enabled, intervalMs, maxFaces, supported, videoEl]);

  return useMemo(() => {
    const primaryFace = faces[0] ?? null;
    return { supported, faces, primaryFace };
  }, [faces, supported]);
}

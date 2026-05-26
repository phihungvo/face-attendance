import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "../../components/Card/Card";
import Table from "../../components/Table/Table";
import { useClock } from "../../../shared/hooks/useClock";
import { formatDateTimeVi } from "../../../shared/lib/date";
import { listAttendanceLogs, scanAttendanceFromImageWithGeo, type AttendanceLog } from "../../../shared/api/attendance";
import { getCompany, getMyCompany, type Company } from "../../../shared/api/companies";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import { useCamera } from "../../../shared/hooks/useCamera";
import { useAutoScan } from "../../../shared/hooks/useAutoScan";
import { useGeoPosition } from "../../../shared/hooks/useGeoPosition";
import { useFaceTracking } from "../../../shared/hooks/useFaceTracking";
import { useAuth } from "../../../shared/auth/auth";
import { playAttendanceFeedback, primeAttendanceAudioPlayback } from "../../../shared/audio/attendanceAudio";
import {
  CameraOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  RetweetOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  ThunderboltOutlined
} from "@ant-design/icons";
import styles from "./AttendancePage.module.scss";

export default function AttendancePage() {
  const auth = useAuth();
  const { now } = useClock(1000);
  const cameraBoxRef = useRef<HTMLDivElement | null>(null);
  const lastFailureSoundAtRef = useRef(0);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ user: string; confidence: number; time: string; action: "checkin" | "checkout" } | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [requireGps, setRequireGps] = useState<boolean>(false);
  const [scopeCompany, setScopeCompany] = useState<Company | null>(null);
  const cam = useCamera();
  const geo = useGeoPosition({ watch: requireGps, auto: requireGps });
  const tracker = useFaceTracking(cam.videoRef.current, { enabled: cam.state.ready, maxFaces: 6, intervalMs: 180 });
  const isAdmin = auth.roleKeys.includes("admin");
  const effectiveCompanyId = isAdmin ? auth.selectedCompanyId ?? auth.companyId ?? null : auth.companyId ?? null;
  const scopeReady = effectiveCompanyId != null;
  const liveClock = useMemo(() => now.toLocaleTimeString("vi-VN"), [now]);
  const liveDate = useMemo(() => formatDateTimeVi(now, { dateOnly: true }), [now]);
  const overlayFaces = useMemo(() => {
    const container = cameraBoxRef.current;
    const video = cam.videoRef.current;
    if (!container || !video || video.videoWidth <= 0 || video.videoHeight <= 0) return [];

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const scale = Math.max(containerWidth / video.videoWidth, containerHeight / video.videoHeight);
    const displayWidth = video.videoWidth * scale;
    const displayHeight = video.videoHeight * scale;
    const offsetX = (containerWidth - displayWidth) / 2;
    const offsetY = (containerHeight - displayHeight) / 2;

    return tracker.faces.map((face) => {
      const left = offsetX + face.x * scale;
      const top = offsetY + face.y * scale;
      const width = face.width * scale;
      const height = face.height * scale;
      return {
        id: face.id,
        left,
        top,
        width,
        height,
        active: tracker.primaryFace?.id === face.id
      };
    });
  }, [cam.videoRef, tracker.faces, tracker.primaryFace?.id]);

  async function refreshLogs() {
    if (!scopeReady) {
      setLogs([]);
      return;
    }
    try {
      const data = await listAttendanceLogs({ limit: 8, offset: 0 });
      setLogs(data.slice(0, 8));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void refreshLogs();
  }, [scopeReady, effectiveCompanyId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!scopeReady) {
        if (!mounted) return;
        setScopeCompany(null);
        setRequireGps(false);
        return;
      }
      try {
        const c = isAdmin && effectiveCompanyId ? await getCompany(effectiveCompanyId) : await getMyCompany();
        if (!mounted) return;
        setScopeCompany(c);
        setRequireGps(Boolean((c as any).require_gps_on_attendance ?? false));
      } catch {
        if (!mounted) return;
        setScopeCompany(null);
        // If cannot load company settings, keep GPS optional by default.
        setRequireGps(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [scopeReady, effectiveCompanyId, isAdmin]);

  useEffect(() => {
    setError(null);
    setResult(null);
  }, [effectiveCompanyId]);

  useEffect(() => {
    return () => cam.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captureOnce = useCallback(async () => {
    const video = cam.videoRef.current;
    const primary = tracker.primaryFace;
    if (!video || !primary) return cam.capture({ quality: 0.9, type: "image/jpeg" });

    const pad = Math.max(primary.width, primary.height) * 0.3;
    const sx = Math.max(0, Math.floor(primary.x - pad));
    const sy = Math.max(0, Math.floor(primary.y - pad));
    const sw = Math.min(video.videoWidth - sx, Math.ceil(primary.width + pad * 2));
    const sh = Math.min(video.videoHeight - sy, Math.ceil(primary.height + pad * 2));
    if (sw < 32 || sh < 32) return cam.capture({ quality: 0.9, type: "image/jpeg" });

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return cam.capture({ quality: 0.9, type: "image/jpeg" });
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Không thể crop khuôn mặt"))), "image/jpeg", 0.92);
    });
  }, [cam, tracker.primaryFace]);
  const scanOnce = useCallback(
    (b: Blob) => scanAttendanceFromImageWithGeo(b, { latitude: geo.latitude, longitude: geo.longitude }),
    [geo.latitude, geo.longitude]
  );

  useAutoScan({
    enabled: cam.state.ready && auto && !busy && scopeReady && (!requireGps || geo.enabled),
    intervalMs: 1200,
    capture: captureOnce,
    scan: scanOnce,
    onResult: async (res) => {
      setResult({ user: res.user_name, confidence: res.confidence, time: res.time, action: res.action });
      setError(null);
      await playAttendanceFeedback("success", scopeCompany);
      await refreshLogs();
    },
    onError: (e) => {
      const msg = getApiErrorMessage(e);
      // Don't block the whole kiosk if a specific employee already completed the day.
      if (msg.includes("Đã check-in và check-out rồi")) return;
      if (msg.includes("Thiếu vị trí GPS") || msg.includes("bật định vị")) {
        // Avoid spamming failed scans while browser permission is blocked/denied.
        setAuto(false);
      }
      setError(msg);
      const now = Date.now();
      if (now - lastFailureSoundAtRef.current >= 2500) {
        lastFailureSoundAtRef.current = now;
        void playAttendanceFeedback("failure", scopeCompany);
      }
    }
  });

  return (
    <div className={styles.page}>
      <div className={styles.checkinArea}>
        <div>
          <div className={styles.cameraContainer} ref={cameraBoxRef}>
            {!cam.state.ready ? (
              <div className={styles.cameraPlaceholder}>
                <div className={styles.camIcon}>
                  <CameraOutlined />
                </div>
                <p className={styles.camTitle}>Camera chưa khởi động</p>
                <p className={styles.camSub}>Nhấn nút bên dưới để bắt đầu</p>
              </div>
            ) : null}
            <video ref={cam.videoRef} className={styles.video} playsInline muted />
            {cam.state.ready ? (
              <div className={styles.overlay}>
                {overlayFaces.length ? (
                  <>
                    {overlayFaces.map((face) => (
                      <div
                        key={face.id}
                        className={face.active ? `${styles.faceTrackBox} ${styles.faceTrackBoxActive}` : styles.faceTrackBox}
                        style={{
                          left: `${face.left}px`,
                          top: `${face.top}px`,
                          width: `${face.width}px`,
                          height: `${face.height}px`
                        }}
                      >
                        {face.active ? <div className={styles.scanLine} /> : null}
                      </div>
                    ))}
                    <div className={styles.overlayHint}>
                      {overlayFaces.length > 1
                        ? `Đang theo dõi ${overlayFaces.length} khuôn mặt • Ưu tiên khuôn mặt đang focus`
                        : "Đang theo dõi khuôn mặt • Hệ thống tự quét"}
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.faceFrame}>
                      <div className={styles.scanLine} />
                    </div>
                    <div className={styles.overlayHint}>
                      {tracker.supported ? "Đưa khuôn mặt vào vùng camera • Hệ thống tự quét" : "Đặt khuôn mặt vào khung • Hệ thống tự quét"}
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
          <div className={styles.cameraActions}>
            {!cam.state.ready ? (
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                type="button"
                onClick={() => {
                  void primeAttendanceAudioPlayback();
                  cam.start();
                }}
                disabled={busy}
              >
                <CameraOutlined /> Bật Camera
              </button>
            ) : (
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                type="button"
                onClick={() => {
                  void primeAttendanceAudioPlayback();
                  setAuto((v) => !v);
                }}
                disabled={busy}
              >
                {auto ? "⏸ Tạm dừng auto" : "▶︎ Bật auto"}
              </button>
            )}
            <button
              className={`${styles.btn} ${styles.btnGhost}`}
              type="button"
              onClick={() => {
                void primeAttendanceAudioPlayback();
                cam.switchCamera();
              }}
              disabled={!cam.state.ready || busy}
            >
              <RetweetOutlined /> Đổi camera
            </button>
            <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={() => cam.stop()} disabled={!cam.state.ready || busy}>
              <StopOutlined /> Tắt Camera
            </button>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.timeDisplay}>
            <div className={styles.clock}>{liveClock}</div>
            <div className={styles.dateStr}>{liveDate}</div>
          </div>

          <div className={styles.infoBox}>
            <SafetyCertificateOutlined /> Công ty đang chấm công: <b>{scopeCompany?.name || (scopeReady ? `#${effectiveCompanyId}` : "Chưa chọn công ty")}</b>
          </div>

          {!scopeReady ? (
            <div className={styles.warningBox}>Cần chọn công ty trước khi chấm công ở màn quản lý.</div>
          ) : null}

          {cam.state.error ? <div className={styles.warningBox}>{cam.state.error}</div> : null}
          {requireGps && geo.supported && !geo.enabled ? (
            <div className={styles.warningBox}>
              ⚠️ Chưa lấy được GPS. Nếu công ty bật giới hạn vị trí, bạn cần cho phép định vị để chấm công.
              {geo.error ? <div style={{ marginTop: 6, opacity: 0.9 }}>{geo.error}</div> : null}
              <div style={{ marginTop: 8 }}>
                <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={() => geo.refresh()} disabled={geo.loading}>
                  <EnvironmentOutlined /> Lấy GPS lại
                </button>
                {!auto ? <span style={{ marginLeft: 10, opacity: 0.9 }}>Auto đang tắt do thiếu GPS.</span> : null}
              </div>
            </div>
          ) : null}
          {error ? <div className={styles.errorBox}>{error}</div> : null}
          {result ? (
            <div className={styles.infoBox}>
              <CheckCircleOutlined /> <b>{result.user}</b> • {result.action === "checkout" ? "Ra ca" : "Vào ca"} • conf={result.confidence.toFixed(3)} •{" "}
              {new Date(result.time).toLocaleString("vi-VN")}
            </div>
          ) : (
            <div className={styles.infoBox}>Bật camera → đứng trước camera → hệ thống tự chấm công cho nhân viên của công ty đang thao tác.</div>
          )}
        </div>
      </div>

      <Card
        title={
          <span className={styles.cardTitle}>
            <FileTextOutlined /> Log chấm công
          </span>
        }
        sub="Danh sách gần nhất"
      >
        <Table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Nhân viên</th>
              <th>Loại</th>
              <th>Độ tin cậy</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.timestamp).toLocaleString("vi-VN")}</td>
                <td>
                  <span className={styles.empCell}>
                    <span className={styles.empAvatar}>{(l.user_name || "??").slice(0, 2).toUpperCase()}</span>
                    <span className={styles.empMain}>
                      <span className={styles.empName}>{l.user_name || `#${l.user_id}`}</span>
                      <span className={styles.empSub}>ID: {l.user_id}</span>
                    </span>
                  </span>
                </td>
                <td>
                  <span className={l.type === "checkin" ? `${styles.tag} ${styles.good}` : `${styles.tag} ${styles.bad}`}>{l.type}</span>
                </td>
                <td>{l.confidence.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className={styles.bottomGrid}>
        <Card
          title={
            <span className={styles.cardTitle}>
              <ThunderboltOutlined /> Nhận diện
            </span>
          }
          sub="Trạng thái"
        >
          <div className={styles.scanCard}>
            <div className={styles.scanRow}>
              <div className={styles.scanDot} />
              <div>
                <div className={styles.scanTitle}>{busy ? "Đang nhận diện..." : cam.state.ready ? "Sẵn sàng quét" : "Chưa bật camera"}</div>
                <div className={styles.scanSub}>Cập nhật: {formatDateTimeVi(now)}</div>
              </div>
            </div>
            {cam.state.ready ? (
              <div className={styles.trackingMeta}>
                <span className={styles.trackingPill}>
                  <InfoCircleOutlined />
                  {tracker.supported ? `Tracking ${tracker.faces.length} mặt` : "Tracking không hỗ trợ"}
                </span>
                <span className={styles.trackingPill}>
                  <CheckCircleOutlined />
                  {tracker.primaryFace ? "Crop theo mặt đang focus" : "Đang chờ khóa mặt"}
                </span>
              </div>
            ) : null}
          </div>
        </Card>

        <Card
          title={
            <span className={styles.cardTitle}>
              <SafetyCertificateOutlined /> Gợi ý xử lý
            </span>
          }
          sub="Các trường hợp thường gặp"
        >
          <div className={styles.warningBox}>
            Nếu camera không hoạt động, hãy kiểm tra quyền truy cập trình duyệt hoặc đổi camera trong phần cài đặt.
          </div>
        </Card>
      </div>
    </div>
  );
}

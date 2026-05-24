import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./EmployeeCheckinPage.module.scss";
import { useNavigate } from "react-router-dom";
import { listMyAttendanceLogs, scanMyAttendanceFromImageWithGeo, type AttendanceLog } from "../../../shared/api/attendance";
import { getMyCompany } from "../../../shared/api/companies";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import { useCamera } from "../../../shared/hooks/useCamera";
import { useAutoScan } from "../../../shared/hooks/useAutoScan";
import { useGeoPosition } from "../../../shared/hooks/useGeoPosition";
import { CameraOutlined, CheckCircleOutlined, EnvironmentOutlined, LeftOutlined, PauseCircleOutlined, PlayCircleOutlined, StopOutlined, SwapOutlined } from "@ant-design/icons";
import { cached, invalidateKey } from "../../../shared/lib/queryCache";
import { empKeys } from "../../cacheKeys";

export default function EmployeeCheckinPage() {
  const nav = useNavigate();
  const cam = useCamera();
  const [busy] = useState(false);
  const [auto, setAuto] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ user: string; action: "checkin" | "checkout"; confidence: number; time: string } | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [requireGps, setRequireGps] = useState(false);
  const geo = useGeoPosition({ watch: requireGps, auto: requireGps });

  async function refreshLogs() {
    try {
      const key = empKeys.myAttendanceLogs(20, 0);
      const data = await cached(key, () => listMyAttendanceLogs({ limit: 20, offset: 0 }), 5_000);
      setLogs(data);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refreshLogs();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const company = await getMyCompany();
        if (!mounted) return;
        setRequireGps(Boolean(company.require_gps_on_attendance ?? false));
      } catch {
        if (!mounted) return;
        setRequireGps(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => cam.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusLabel = useMemo(() => {
    const latest = logs[0];
    if (!latest) return "Chưa có log hôm nay";
    return latest.type === "checkin" ? "Đang làm việc" : "Đã ra ca";
  }, [logs]);

  const completedToday = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    let hasIn = false;
    let hasOut = false;
    for (const l of logs) {
      const d = new Date(l.timestamp).toLocaleDateString("en-CA");
      if (d !== today) continue;
      if (l.type === "checkin") hasIn = true;
      if (l.type === "checkout") hasOut = true;
      if (hasIn && hasOut) return true;
    }
    return false;
  }, [logs]);

  useEffect(() => {
    if (completedToday) {
      setCompleted(true);
      setAuto(false);
    }
  }, [completedToday]);

  const captureOnce = useCallback(() => cam.capture({ quality: 0.9, type: "image/jpeg" }), [cam]);
  const scanOnce = useCallback(
    (b: Blob) => scanMyAttendanceFromImageWithGeo(b, { latitude: geo.latitude, longitude: geo.longitude }),
    [geo.latitude, geo.longitude]
  );

  useAutoScan({
    enabled: cam.state.ready && auto && !busy && !completed && (!requireGps || geo.enabled),
    intervalMs: 1400,
    capture: captureOnce,
    scan: scanOnce,
    onResult: async (res) => {
      setResult({ user: res.user_name, action: res.action, confidence: res.confidence, time: res.time });
      setError(null);
      invalidateKey(empKeys.myAttendanceLogs(20, 0));
      await refreshLogs();
    },
    onError: (e) => {
      // Avoid spamming UI on intermittent failures (keep last good state visible).
      const msg = getApiErrorMessage(e);
      if (msg) setError(msg);
      if (msg.includes("Đã check-in và check-out rồi")) {
        setCompleted(true);
        setAuto(false);
      }
      if (msg.includes("Thiếu vị trí GPS") || msg.includes("bật định vị")) {
        setAuto(false);
      }
    }
  });

  return (
    <div className={styles.page}>
      <div className={styles.screenHeader}>
        <button className={styles.backBtn} type="button" onClick={() => nav(-1)}>
          <LeftOutlined />
        </button>
        <div className={styles.screenHeaderTitle}>Chấm công</div>
      </div>

      <div className={styles.content}>
        <div className={styles.statusRow}>
          <div className={`${styles.statusChip} ${statusLabel === "Đang làm việc" ? styles.in : styles.out}`}>{statusLabel}</div>
          {cam.state.ready ? <div className={styles.autoChip}>{auto ? "Auto: ON" : "Auto: OFF"}</div> : null}
        </div>

        <div className={styles.camera}>
          {!cam.state.ready ? (
            <div className={styles.cameraInner}>
              <CameraOutlined /> Camera chưa bật
            </div>
          ) : null}
          <video ref={cam.videoRef} className={styles.video} playsInline muted />
        </div>

        {cam.state.error ? <div className={styles.warnBox}>{cam.state.error}</div> : null}
        {requireGps && geo.supported && !geo.enabled ? (
          <div className={styles.warnBox}>
            ⚠️ Công ty đang bật GPS. Bạn cần cho phép định vị để chấm công.
            {geo.error ? <div style={{ marginTop: 6, opacity: 0.9 }}>{geo.error}</div> : null}
            <div style={{ marginTop: 8 }}>
              <button className={styles.ghost} type="button" onClick={() => geo.refresh()} disabled={geo.loading}>
                <EnvironmentOutlined /> Lấy GPS lại
              </button>
              {!auto ? <span style={{ marginLeft: 10, opacity: 0.9 }}>Auto đang tắt do thiếu GPS.</span> : null}
            </div>
          </div>
        ) : null}
        {error ? <div className={styles.errBox}>{error}</div> : null}
        {result ? (
          <div className={styles.infoBox}>
            <CheckCircleOutlined /> <b>{result.user}</b> • {result.action === "checkout" ? "Ra ca" : "Vào ca"} • conf={result.confidence.toFixed(3)} •{" "}
            {new Date(result.time).toLocaleString("vi-VN")}
          </div>
        ) : null}
        {completed ? (
          <div className={styles.infoBox}>
            <CheckCircleOutlined /> Hôm nay bạn đã check-in và check-out rồi. Không thể chấm công thêm.
          </div>
        ) : null}

        <div className={styles.actions}>
          {!cam.state.ready ? (
            <button className={styles.primary} type="button" disabled={busy} onClick={() => cam.start()}>
              <CameraOutlined /> Bật camera
            </button>
          ) : (
            <button
              className={styles.primary}
              type="button"
              disabled={!cam.state.ready || busy || completed}
              onClick={async () => {
                setAuto((v) => !v);
              }}
            >
              {auto ? (
                <>
                  <PauseCircleOutlined /> Tạm dừng auto
                </>
              ) : (
                <>
                  <PlayCircleOutlined /> Bật auto
                </>
              )}
            </button>
          )}
          <button className={styles.ghost} type="button" disabled={!cam.state.ready || busy} onClick={() => cam.switchCamera()}>
            <SwapOutlined /> Đổi camera
          </button>
          <button className={styles.danger} type="button" disabled={!cam.state.ready || busy} onClick={() => cam.stop()}>
            <StopOutlined /> Tắt camera
          </button>
        </div>

        <div className={styles.sectionTitle}>Lịch sử gần nhất</div>
        <div className={styles.logList}>
          {logs.map((l) => (
            <div key={l.id} className={styles.logRow}>
              <div className={styles.logType}>
                {l.type === "checkin" ? <CheckCircleOutlined /> : <StopOutlined />} {l.type === "checkin" ? "Vào" : "Ra"}
              </div>
              <div className={styles.logTime}>{new Date(l.timestamp).toLocaleString("vi-VN")}</div>
              <div className={styles.logConf}>{l.confidence.toFixed(3)}</div>
            </div>
          ))}
          {logs.length === 0 ? <div className={styles.empty}>Chưa có dữ liệu</div> : null}
        </div>
      </div>
    </div>
  );
}

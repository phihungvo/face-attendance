import { useEffect, useMemo, useState } from "react";
import styles from "./EmployeeCheckinPage.module.scss";
import { useNavigate } from "react-router-dom";
import { listMyAttendanceLogs, scanMyAttendanceFromImage, type AttendanceLog } from "../../../shared/api/attendance";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import { useCamera } from "../../../shared/hooks/useCamera";

export default function EmployeeCheckinPage() {
  const nav = useNavigate();
  const cam = useCamera();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ action: "checkin" | "checkout"; confidence: number; time: string } | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);

  async function refreshLogs() {
    try {
      const data = await listMyAttendanceLogs({ limit: 20, offset: 0 });
      setLogs(data);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refreshLogs();
  }, []);

  const statusLabel = useMemo(() => {
    const latest = logs[0];
    if (!latest) return "Chưa có log hôm nay";
    return latest.type === "checkin" ? "Đang làm việc" : "Đã ra ca";
  }, [logs]);

  return (
    <div className={styles.page}>
      <div className={styles.screenHeader}>
        <button className={styles.backBtn} type="button" onClick={() => nav(-1)}>
          ‹
        </button>
        <div className={styles.screenHeaderTitle}>Chấm công</div>
      </div>

      <div className={styles.content}>
        <div className={styles.statusRow}>
          <div className={`${styles.statusChip} ${statusLabel === "Đang làm việc" ? styles.in : styles.out}`}>{statusLabel}</div>
        </div>

        <div className={styles.camera}>
          {!cam.state.ready ? <div className={styles.cameraInner}>📷 Camera chưa bật</div> : null}
          <video ref={cam.videoRef} className={styles.video} playsInline muted />
        </div>

        {cam.state.error ? <div className={styles.warnBox}>{cam.state.error}</div> : null}
        {error ? <div className={styles.errBox}>{error}</div> : null}
        {result ? (
          <div className={styles.infoBox}>
            ✅ {result.action === "checkout" ? "Ra ca" : "Vào ca"} • conf={result.confidence.toFixed(3)} • {new Date(result.time).toLocaleString("vi-VN")}
          </div>
        ) : null}

        <div className={styles.actions}>
          {!cam.state.ready ? (
            <button className={styles.primary} type="button" disabled={busy} onClick={() => cam.start()}>
              📷 Bật camera
            </button>
          ) : (
            <button
              className={styles.primary}
              type="button"
              disabled={!cam.state.ready || busy}
              onClick={async () => {
                try {
                  setBusy(true);
                  setError(null);
                  const blob = await cam.capture({ quality: 0.9, type: "image/jpeg" });
                  const res = await scanMyAttendanceFromImage(blob);
                  setResult({ action: res.action, confidence: res.confidence, time: res.time });
                  await refreshLogs();
                } catch (e) {
                  setError(getApiErrorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Đang quét..." : "📷 Quét chấm công"}
            </button>
          )}
          <button className={styles.ghost} type="button" disabled={!cam.state.ready || busy} onClick={() => cam.switchCamera()}>
            🔄 Đổi camera
          </button>
          <button className={styles.danger} type="button" disabled={!cam.state.ready || busy} onClick={() => cam.stop()}>
            ⏹ Tắt camera
          </button>
        </div>

        <div className={styles.sectionTitle}>Lịch sử gần nhất</div>
        <div className={styles.logList}>
          {logs.map((l) => (
            <div key={l.id} className={styles.logRow}>
              <div className={styles.logType}>{l.type === "checkin" ? "✅ Vào" : "⛔ Ra"}</div>
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

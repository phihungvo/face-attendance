import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card/Card";
import Table from "../../components/Table/Table";
import { useClock } from "../../../shared/hooks/useClock";
import { formatDateTimeVi } from "../../../shared/lib/date";
import { listAttendanceLogs, scanAttendanceFromImage, type AttendanceLog } from "../../../shared/api/attendance";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import { useCamera } from "../../../shared/hooks/useCamera";
import styles from "./AttendancePage.module.scss";

export default function AttendancePage() {
  const { now } = useClock(1000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ user: string; confidence: number; time: string; action: "checkin" | "checkout" } | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const cam = useCamera();
  const liveClock = useMemo(() => now.toLocaleTimeString("vi-VN"), [now]);
  const liveDate = useMemo(() => formatDateTimeVi(now, { dateOnly: true }), [now]);

  async function refreshLogs() {
    try {
      const data = await listAttendanceLogs();
      setLogs(data.slice(0, 8));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refreshLogs();
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.checkinArea}>
        <div>
          <div className={styles.cameraContainer}>
            {!cam.state.ready ? (
              <div className={styles.cameraPlaceholder}>
                <div className={styles.camIcon}>📷</div>
                <p className={styles.camTitle}>Camera chưa khởi động</p>
                <p className={styles.camSub}>Nhấn nút bên dưới để bắt đầu</p>
              </div>
            ) : null}
            <video ref={cam.videoRef} className={styles.video} playsInline muted />
            {cam.state.ready ? (
              <div className={styles.overlay}>
                <div className={styles.faceFrame}>
                  <div className={styles.scanLine} />
                </div>
                <div className={styles.overlayHint}>Đặt khuôn mặt vào khung • Bấm “Quét”</div>
              </div>
            ) : null}
          </div>
          <div className={styles.cameraActions}>
            {!cam.state.ready ? (
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={() => cam.start()} disabled={busy}>
                📷 Bật Camera
              </button>
            ) : (
              <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={() => cam.stop()} disabled={busy}>
                ⏹ Tắt Camera
              </button>
            )}
            <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={() => cam.switchCamera()} disabled={!cam.state.ready || busy}>
              🔄 Đổi camera
            </button>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.timeDisplay}>
            <div className={styles.clock}>{liveClock}</div>
            <div className={styles.dateStr}>{liveDate}</div>
          </div>

          {cam.state.error ? <div className={styles.warningBox}>{cam.state.error}</div> : null}
          {error ? <div className={styles.errorBox}>{error}</div> : null}
          {result ? (
            <div className={styles.infoBox}>
              ✅ <b>{result.user}</b> • {result.action === "checkout" ? "Checkout" : "Checkin"} • conf={result.confidence.toFixed(3)} •{" "}
              {new Date(result.time).toLocaleString("vi-VN")}
            </div>
          ) : (
            <div className={styles.infoBox}>Bật camera → đứng trước camera → bấm “Quét” để hệ thống tự check-in/check-out.</div>
          )}

          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            type="button"
            disabled={!cam.state.ready || busy}
            onClick={async () => {
              try {
                setBusy(true);
                setError(null);
                const blob = await cam.capture({ quality: 0.9, type: "image/jpeg" });
                const res = await scanAttendanceFromImage(blob);
                setResult({ user: res.user_name, confidence: res.confidence, time: res.time, action: res.action });
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
        </div>
      </div>

      <Card title="📋 Log chấm công" sub="Danh sách gần nhất">
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
        <Card title="⚡ Nhận diện" sub="Trạng thái">
          <div className={styles.scanCard}>
            <div className={styles.scanRow}>
              <div className={styles.scanDot} />
              <div>
                <div className={styles.scanTitle}>{busy ? "Đang nhận diện..." : cam.state.ready ? "Sẵn sàng quét" : "Chưa bật camera"}</div>
                <div className={styles.scanSub}>Cập nhật: {formatDateTimeVi(now)}</div>
              </div>
            </div>
          </div>
        </Card>

        <Card title="🧾 Gợi ý xử lý" sub="Các trường hợp thường gặp">
          <div className={styles.warningBox}>
            Nếu camera không hoạt động, hãy kiểm tra quyền truy cập trình duyệt hoặc đổi camera trong phần cài đặt.
          </div>
        </Card>
      </div>
    </div>
  );
}

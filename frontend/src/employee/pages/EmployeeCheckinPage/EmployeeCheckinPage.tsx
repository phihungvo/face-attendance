import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./EmployeeCheckinPage.module.scss";
import { useNavigate } from "react-router-dom";
import { listMyAttendanceLogs, listMyTimelog, scanMyAttendanceFromImageWithGeo, type AttendanceLog, type TimelogRow } from "../../../shared/api/attendance";
import { getMyCompany } from "../../../shared/api/companies";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import { useCamera } from "../../../shared/hooks/useCamera";
import { useGeoPosition } from "../../../shared/hooks/useGeoPosition";
import {
  CameraOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  LeftOutlined,
  LoadingOutlined,
  StopOutlined,
  SwapOutlined
} from "@ant-design/icons";
import { cached, getCached, invalidateKey, setCached } from "../../../shared/lib/queryCache";
import { empKeys } from "../../cacheKeys";

function toYmd(dateLike: string | Date) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toMonthKey(dateLike: string | Date) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(monthKey: string) {
  const [year, month] = monthKey.split("-").map((x) => Number(x));
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${monthKey}-01`,
    to: `${monthKey}-${String(lastDay).padStart(2, "0")}`
  };
}

function formatHm(value?: string | null) {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatDayTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

type TodayAttendanceMode = "checkin" | "checkout" | "done";

export default function EmployeeCheckinPage() {
  const nav = useNavigate();
  const { videoRef, state: cameraState, start: startCamera, stop: stopCamera, switchCamera, capture } = useCamera();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ user: string; action: "checkin" | "checkout"; confidence: number; time: string } | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [requireGps, setRequireGps] = useState(false);
  const geo = useGeoPosition({ watch: requireGps, auto: requireGps });

  const refreshLogs = useCallback(async () => {
    try {
      const key = empKeys.myAttendanceLogs(20, 0);
      const data = await cached(key, () => listMyAttendanceLogs({ limit: 20, offset: 0 }), 5_000);
      setLogs(data);
    } catch {
      // Ignore refresh failure and keep the current UI state.
    }
  }, []);

  const refreshMonthTimelog = useCallback(async (isoTime: string) => {
    const monthKey = toMonthKey(isoTime);
    const { from, to } = monthRange(monthKey);
    const rows = await listMyTimelog({ from_date: from, to_date: to });
    setCached(empKeys.myTimelogMonth(monthKey), rows, 60_000);
    return rows;
  }, []);

  const patchMonthTimelogCache = useCallback((isoTime: string, action: "checkin" | "checkout") => {
    const monthKey = toMonthKey(isoTime);
    const key = empKeys.myTimelogMonth(monthKey);
    const existing = getCached<TimelogRow[]>(key);
    if (!existing) return;

    const dayKey = toYmd(isoTime);
    let found = false;
    const next = existing.map((row) => {
      if (row.date !== dayKey) return row;
      found = true;
      return {
        ...row,
        absent: false,
        checkin_time: action === "checkin" ? isoTime : row.checkin_time ?? isoTime,
        checkout_time: action === "checkout" ? isoTime : row.checkout_time ?? null
      };
    });

    if (!found) {
      next.unshift({
        user_id: 0,
        user_name: "",
        date: dayKey,
        checkin_time: action === "checkin" ? isoTime : null,
        checkout_time: action === "checkout" ? isoTime : null,
        work_hours: 0,
        late: false,
        absent: false,
        method: "face"
      });
    }

    setCached(key, next, 60_000);
  }, []);

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

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
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const todayAttendance = useMemo(() => {
    const todayKey = new Date().toLocaleDateString("en-CA");
    const orderedTodayLogs = logs
      .filter((log) => new Date(log.timestamp).toLocaleDateString("en-CA") === todayKey)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const firstCheckin = orderedTodayLogs.find((log) => log.type === "checkin") ?? null;
    const lastCheckout = [...orderedTodayLogs].reverse().find((log) => log.type === "checkout") ?? null;
    const mode: TodayAttendanceMode = firstCheckin ? (lastCheckout ? "done" : "checkout") : "checkin";

    return {
      mode,
      firstCheckin,
      lastCheckout,
      todayCount: Number(Boolean(firstCheckin)) + Number(Boolean(lastCheckout)),
      orderedTodayLogs
    };
  }, [logs]);

  const primaryAction = useMemo(() => {
    if (todayAttendance.mode === "done") {
      return {
        label: "Đã hoàn tất hôm nay",
        hint: "Bạn đã vào ca và ra ca đủ cho hôm nay.",
        tone: "done" as const,
        disabled: true
      };
    }
    if (todayAttendance.mode === "checkout") {
      return {
        label: "Ra ca",
        hint: "Xác thực khuôn mặt để kết thúc ca làm việc.",
        tone: "checkout" as const,
        disabled: false
      };
    }
    return {
      label: "Vào ca",
      hint: "Đặt khuôn mặt vào khung để bắt đầu ca làm việc.",
      tone: "checkin" as const,
      disabled: false
    };
  }, [todayAttendance.mode]);

  const statusCopy = useMemo(() => {
    if (todayAttendance.mode === "done") {
      return {
        badge: "Đã hoàn tất",
        title: "Hôm nay đã chấm công xong",
        subtitle: "Bạn không cần thao tác thêm trừ khi quản lý điều chỉnh dữ liệu.",
        toneClass: styles.statusDone
      };
    }
    if (todayAttendance.mode === "checkout") {
      return {
        badge: "Đang trong ca",
        title: "Bạn đang làm việc",
        subtitle: "Khi kết thúc ca, bấm Ra ca để ghi nhận thời gian rời ca.",
        toneClass: styles.statusWorking
      };
    }
    return {
      badge: "Sẵn sàng",
      title: "Chuẩn bị vào ca",
      subtitle: "Bật camera, đứng gọn trong khung và bấm Vào ca một lần.",
      toneClass: styles.statusReady
    };
  }, [todayAttendance.mode]);

  const primaryDisabled =
    busy || primaryAction.disabled || !cameraState.ready || (requireGps && !geo.enabled);

  const primaryDisabledReason = useMemo(() => {
    if (busy) return "Đang xử lý chấm công...";
    if (primaryAction.disabled) return primaryAction.hint;
    if (!cameraState.ready) return "Cần bật camera để xác thực khuôn mặt.";
    if (requireGps && !geo.enabled) return "Công ty yêu cầu GPS, hãy bật định vị trước khi chấm công.";
    return primaryAction.hint;
  }, [busy, cameraState.ready, primaryAction.disabled, primaryAction.hint, requireGps, geo.enabled]);

  const handlePrimaryAction = useCallback(async () => {
    if (primaryDisabled) {
      if (!cameraState.ready) startCamera();
      if (requireGps && !geo.enabled) geo.refresh();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const blob = await capture({ quality: 0.9, type: "image/jpeg" });
      const res = await scanMyAttendanceFromImageWithGeo(blob, {
        latitude: geo.latitude,
        longitude: geo.longitude
      });
      setResult({ user: res.user_name, action: res.action, confidence: res.confidence, time: res.time });
      patchMonthTimelogCache(res.time, res.action);
      invalidateKey(empKeys.myAttendanceLogs(20, 0));
      await Promise.allSettled([refreshLogs(), refreshMonthTimelog(res.time)]);
    } catch (e) {
      const msg = getApiErrorMessage(e) || "Chấm công thất bại";
      setError(msg);
      if (msg.includes("Thiếu vị trí GPS") || msg.includes("bật định vị")) {
        geo.refresh();
      }
      await refreshLogs();
    } finally {
      setBusy(false);
    }
  }, [
    cameraState.ready,
    capture,
    geo,
    patchMonthTimelogCache,
    primaryDisabled,
    refreshLogs,
    refreshMonthTimelog,
    requireGps,
    startCamera
  ]);

  const latestLogs = useMemo(() => logs.slice(0, 6), [logs]);
  const cameraDevicesLabel = cameraState.devices.length > 1 ? `${cameraState.devices.length} camera` : "1 camera";

  return (
    <div className={styles.page}>
      <div className={styles.screenHeader}>
        <button className={styles.backBtn} type="button" onClick={() => nav(-1)} aria-label="Quay lại">
          <LeftOutlined />
        </button>
        <div>
          <div className={styles.screenHeaderEyebrow}>Nhân viên</div>
          <div className={styles.screenHeaderTitle}>Chấm công</div>
        </div>
      </div>

      <div className={styles.content}>
        <section className={styles.heroCard}>
          <div className={styles.heroTop}>
            <div>
              <div className={`${styles.statusBadge} ${statusCopy.toneClass}`}>{statusCopy.badge}</div>
              <h1 className={styles.heroTitle}>{statusCopy.title}</h1>
              <p className={styles.heroSubtitle}>{statusCopy.subtitle}</p>
            </div>
            <div className={styles.heroProgress}>
              <span>Tiến độ hôm nay</span>
              <strong>{todayAttendance.todayCount}/2</strong>
            </div>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span>Vào ca</span>
              <strong>{formatHm(todayAttendance.firstCheckin?.timestamp)}</strong>
            </div>
            <div className={styles.statCard}>
              <span>Ra ca</span>
              <strong>{formatHm(todayAttendance.lastCheckout?.timestamp)}</strong>
            </div>
            <div className={styles.statCard}>
              <span>GPS</span>
              <strong>{requireGps ? (geo.enabled ? "Sẵn sàng" : "Cần bật") : "Không bắt buộc"}</strong>
            </div>
          </div>
        </section>

        <section className={styles.cameraCard}>
          <div className={styles.cameraTopRow}>
            <div className={styles.cameraTitleWrap}>
              <div className={styles.cameraTitle}>Camera nhận diện</div>
              <div className={styles.cameraHint}>
                {cameraState.ready ? "Giữ mặt trong khung, nhìn thẳng camera." : "Cho phép camera để bắt đầu chấm công."}
              </div>
            </div>
            <div className={styles.cameraMeta}>{cameraDevicesLabel}</div>
          </div>

          <div className={styles.cameraStage}>
            <video ref={videoRef} className={styles.video} playsInline muted />
            {!cameraState.ready ? (
              <div className={styles.cameraPlaceholder}>
                <CameraOutlined />
                <span>Camera chưa sẵn sàng</span>
              </div>
            ) : (
              <div className={styles.scanGuide} aria-hidden="true">
                <div className={styles.scanGuideFrame} />
                <div className={styles.scanGuideText}>Đưa khuôn mặt vào giữa khung</div>
              </div>
            )}
          </div>

          <div className={styles.cameraTools}>
            <button
              className={`${styles.toolBtn} ${cameraState.ready ? styles.toolBtnActive : styles.toolBtnPrimary}`}
              type="button"
              onClick={() => (cameraState.ready ? stopCamera() : startCamera())}
            >
              <CameraOutlined />
              {cameraState.ready ? "Tắt camera" : "Bật camera"}
            </button>
            <button className={styles.toolBtn} type="button" disabled={!cameraState.ready || busy} onClick={() => switchCamera()}>
              <SwapOutlined />
              Đổi camera
            </button>
            <button className={styles.toolBtn} type="button" disabled={geo.loading} onClick={() => geo.refresh()}>
              <EnvironmentOutlined />
              {geo.loading ? "Đang lấy GPS" : "Lấy GPS"}
            </button>
          </div>
        </section>

        {cameraState.error ? <div className={styles.warnBox}>{cameraState.error}</div> : null}
        {requireGps && !geo.enabled ? (
          <div className={styles.warnBox}>
            Công ty yêu cầu GPS khi chấm công. Hãy bật định vị rồi bấm <b>Lấy GPS</b>.
            {geo.error ? <div className={styles.inlineMeta}>{geo.error}</div> : null}
          </div>
        ) : null}
        {error ? <div className={styles.errBox}>{error}</div> : null}
        {result ? (
          <div className={styles.infoBox}>
            <CheckCircleOutlined /> <b>{result.user}</b> đã {result.action === "checkout" ? "ra ca" : "vào ca"} lúc{" "}
            {formatDayTime(result.time)} • conf {result.confidence.toFixed(2)}
          </div>
        ) : null}

        <section className={styles.primaryPanel}>
          <button
            className={`${styles.primaryAction} ${
              primaryAction.tone === "checkout" ? styles.primaryCheckout : primaryAction.tone === "done" ? styles.primaryDone : styles.primaryCheckin
            }`}
            type="button"
            disabled={primaryDisabled}
            onClick={handlePrimaryAction}
          >
            {busy ? (
              <>
                <LoadingOutlined /> Đang xác thực
              </>
            ) : primaryAction.tone === "checkout" ? (
              <>
                <StopOutlined /> {primaryAction.label}
              </>
            ) : (
              <>
                <CheckCircleOutlined /> {primaryAction.label}
              </>
            )}
          </button>
          <div className={styles.primaryHint}>
            <ClockCircleOutlined /> {primaryDisabledReason}
          </div>
        </section>

        <section className={styles.logSection}>
          <div className={styles.sectionTitle}>Lịch sử gần nhất</div>
          <div className={styles.logList}>
            {latestLogs.map((log) => (
              <div key={log.id} className={styles.logRow}>
                <div className={`${styles.logIcon} ${log.type === "checkin" ? styles.logIconIn : styles.logIconOut}`}>
                  {log.type === "checkin" ? <CheckCircleOutlined /> : <StopOutlined />}
                </div>
                <div className={styles.logBody}>
                  <div className={styles.logType}>{log.type === "checkin" ? "Vào ca" : "Ra ca"}</div>
                  <div className={styles.logTime}>{formatDayTime(log.timestamp)}</div>
                </div>
                <div className={styles.logConf}>{log.confidence.toFixed(2)}</div>
              </div>
            ))}
            {latestLogs.length === 0 ? <div className={styles.empty}>Chưa có dữ liệu chấm công.</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

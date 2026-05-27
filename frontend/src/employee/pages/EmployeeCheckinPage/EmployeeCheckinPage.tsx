import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import styles from "./EmployeeCheckinPage.module.scss";
import {useNavigate} from "react-router-dom";
import {
    listMyAttendanceLogs,
    listMyTimelog,
    scanMyAttendanceFromImageWithGeo,
    type AttendanceLog,
    type TimelogRow
} from "../../../shared/api/attendance";
import {getMyCompany, type Company} from "../../../shared/api/companies";
import {getApiErrorMessage} from "../../../shared/lib/apiClient";
import {useCamera} from "../../../shared/hooks/useCamera";
import {useGeoPosition} from "../../../shared/hooks/useGeoPosition";
import {playAttendanceFeedback, primeAttendanceAudioPlayback} from "../../../shared/audio/attendanceAudio";
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
import {notification, Tooltip} from "antd";
import {cached, getCached, invalidateKey, setCached} from "../../../shared/lib/queryCache";
import {empKeys} from "../../cacheKeys";

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
    return new Date(value).toLocaleTimeString("vi-VN", {hour: "2-digit", minute: "2-digit"});
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
    const {videoRef, state: cameraState, start: startCamera, stop: stopCamera, switchCamera, capture} = useCamera();
    const [toastApi, toastContextHolder] = notification.useNotification();
    const [busy, setBusy] = useState(false);
    const [logs, setLogs] = useState<AttendanceLog[]>([]);
    const [requireGps, setRequireGps] = useState(false);
    const [companyConfig, setCompanyConfig] = useState<Company | null>(null);
    const geo = useGeoPosition({watch: requireGps, auto: requireGps});
    const lastCameraErrorRef = useRef<string | null>(null);
    const lastGeoErrorRef = useRef<string | null>(null);

    const refreshLogs = useCallback(async () => {
        try {
            const key = empKeys.myAttendanceLogs(20, 0);
            const data = await cached(key, () => listMyAttendanceLogs({limit: 20, offset: 0}), 5_000);
            setLogs(data);
        } catch {
            // Ignore refresh failure and keep the current UI state.
        }
    }, []);

    const refreshMonthTimelog = useCallback(async (isoTime: string) => {
        const monthKey = toMonthKey(isoTime);
        const {from, to} = monthRange(monthKey);
        const rows = await listMyTimelog({from_date: from, to_date: to});
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
                setCompanyConfig(company);
                setRequireGps(Boolean(company.require_gps_on_attendance ?? false));
            } catch {
                if (!mounted) return;
                setCompanyConfig(null);
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
            if (primaryAction.disabled) {
                toastApi.info({
                    key: "attendance-done",
                    placement: window.innerWidth <= 640 ? "top" : "topRight",
                    message: "Hôm nay đã hoàn tất",
                    description: primaryAction.hint,
                    duration: 3
                });
                return;
            }
            if (!cameraState.ready) {
                toastApi.warning({
                    key: "camera-required",
                    placement: window.innerWidth <= 640 ? "top" : "topRight",
                    message: "Cần bật camera",
                    description: "Hãy bật camera trước khi chấm công.",
                    duration: 3
                });
                startCamera();
            }
            if (requireGps && !geo.enabled) {
                toastApi.warning({
                    key: "gps-required",
                    placement: window.innerWidth <= 640 ? "top" : "topRight",
                    message: "Cần GPS",
                    description: "Công ty yêu cầu bật định vị trước khi chấm công.",
                    duration: 3
                });
                geo.refresh();
            }
            return;
        }

        setBusy(true);
        try {
            const blob = await capture({quality: 0.9, type: "image/jpeg"});
            const res = await scanMyAttendanceFromImageWithGeo(blob, {
                latitude: geo.latitude,
                longitude: geo.longitude
            });
            await playAttendanceFeedback("success", companyConfig);
            toastApi.success({
                key: "attendance-success",
                placement: window.innerWidth <= 640 ? "top" : "topRight",
                message: res.action === "checkout" ? "Ra ca thành công" : "Vào ca thành công",
                description: `${res.user_name} • ${formatDayTime(res.time)}`,
                duration: 3
            });
            patchMonthTimelogCache(res.time, res.action);
            invalidateKey(empKeys.myAttendanceLogs(20, 0));
            await Promise.allSettled([refreshLogs(), refreshMonthTimelog(res.time)]);
        } catch (e) {
            const msg = getApiErrorMessage(e) || "Chấm công thất bại";
            await playAttendanceFeedback("failure", companyConfig);
            toastApi.error({
                key: "attendance-error",
                placement: window.innerWidth <= 640 ? "top" : "topRight",
                message: "Chấm công thất bại",
                description: msg,
                duration: 4
            });
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
        primaryAction.disabled,
        primaryAction.hint,
        refreshLogs,
        refreshMonthTimelog,
        requireGps,
        startCamera,
        toastApi
    ]);

    const latestLogs = useMemo(() => logs.slice(0, 6), [logs]);

    useEffect(() => {
        if (!cameraState.error || cameraState.error === lastCameraErrorRef.current) return;
        lastCameraErrorRef.current = cameraState.error;
        toastApi.error({
            key: "camera-error",
            placement: window.innerWidth <= 640 ? "top" : "topRight",
            message: "Không thể bật camera",
            description: cameraState.error,
            duration: 4
        });
    }, [cameraState.error, toastApi]);

    useEffect(() => {
        if (!geo.error || geo.error === lastGeoErrorRef.current) return;
        lastGeoErrorRef.current = geo.error;
        toastApi.warning({
            key: "gps-error",
            placement: window.innerWidth <= 640 ? "top" : "topRight",
            message: "GPS chưa sẵn sàng",
            description: geo.error,
            duration: 4
        });
    }, [geo.error, toastApi]);

    return (
        <>
            {toastContextHolder}
            <div className={styles.page}>
                <div className={styles.screenHeader}>
                    <button className={styles.backBtn} type="button" onClick={() => nav(-1)} aria-label="Quay lại">
                        <LeftOutlined/>
                    </button>
                    <div>
                        <div className={styles.screenHeaderEyebrow}>Nhân viên</div>
                        <div className={styles.screenHeaderTitle}>Chấm công</div>
                    </div>
                </div>

                <div className={styles.content}>
                    <section className={styles.cameraCard}>
                        <div className={styles.cameraStage}>
                            <video ref={videoRef} className={styles.video} playsInline muted/>
                            {!cameraState.ready ? (
                                <div className={styles.cameraPlaceholder}>
                                    <CameraOutlined/>
                                    <span>Camera chưa sẵn sàng</span>
                                </div>
                            ) : (
                                <div className={styles.scanGuide} aria-hidden="true">
                                    <div className={styles.scanGuideFrame}/>
                                    <div className={styles.scanGuideText}>Đưa khuôn mặt vào giữa khung</div>
                                </div>
                            )}
                        </div>

                        <div className={styles.cameraTools}>
                            <Tooltip title={cameraState.ready ? "Tắt camera" : "Bật camera"}>
                                <button
                                    className={`${styles.toolBtn} ${cameraState.ready ? styles.toolBtnCameraOn : styles.toolBtnCameraOff}`}
                                    type="button"
                                    aria-label={cameraState.ready ? "Tắt camera" : "Bật camera"}
                                    onClick={() => {
                                        void primeAttendanceAudioPlayback();
                                        if (cameraState.ready) stopCamera();
                                        else startCamera();
                                    }}
                                >
                                    <CameraOutlined/>
                                    <span className={`${styles.toolDot} ${cameraState.ready ? styles.toolDotActive : styles.toolDotIdle}`}/>
                                </button>
                            </Tooltip>
                            <Tooltip title="Đổi camera">
                                <button
                                    className={styles.toolBtn}
                                    type="button"
                                    aria-label="Đổi camera"
                                    disabled={!cameraState.ready || busy}
                                    onClick={() => {
                                        void primeAttendanceAudioPlayback();
                                        switchCamera();
                                    }}
                                >
                                    <SwapOutlined/>
                                    <span className={styles.toolDot}/>
                                </button>
                            </Tooltip>
                            <Tooltip title={geo.loading ? "Đang lấy GPS" : "Lấy GPS"}>
                                <button
                                    className={`${styles.toolBtn} ${geo.enabled ? styles.toolBtnGpsReady : requireGps ? styles.toolBtnGpsRequired : ""}`}
                                    type="button"
                                    aria-label={geo.loading ? "Đang lấy GPS" : "Lấy GPS"}
                                    disabled={geo.loading}
                                    onClick={() => geo.refresh()}
                                >
                                    {geo.loading ? <LoadingOutlined/> : <EnvironmentOutlined/>}
                                    <span className={`${styles.toolDot} ${geo.enabled ? styles.toolDotActive : requireGps ? styles.toolDotWarn : styles.toolDotIdle}`}/>
                                </button>
                            </Tooltip>
                        </div>
                    </section>

                    <section className={styles.primaryPanel}>
                        <button
                            className={`${styles.primaryAction} ${
                                primaryAction.tone === "checkout" ? styles.primaryCheckout : primaryAction.tone === "done" ? styles.primaryDone : styles.primaryCheckin
                            }`}
                            type="button"
                            disabled={primaryDisabled}
                            onClick={() => {
                                void primeAttendanceAudioPlayback();
                                void handlePrimaryAction();
                            }}
                        >
                            {busy ? (
                                <>
                                    <LoadingOutlined/> Đang xác thực
                                </>
                            ) : primaryAction.tone === "checkout" ? (
                                <>
                                    <StopOutlined/> {primaryAction.label}
                                </>
                            ) : (
                                <>
                                    <CheckCircleOutlined/> {primaryAction.label}
                                </>
                            )}
                        </button>
                        <div className={styles.primaryHint}>
                            <ClockCircleOutlined/> {primaryDisabledReason}
                        </div>
                    </section>

                    <section className={styles.logSection}>
                        <div className={styles.sectionTitle}>Lịch sử gần nhất</div>
                        <div className={styles.logList}>
                            {latestLogs.map((log) => (
                                <div key={log.id} className={styles.logRow}>
                                    <div
                                        className={`${styles.logIcon} ${log.type === "checkin" ? styles.logIconIn : styles.logIconOut}`}>
                                        {log.type === "checkin" ? <CheckCircleOutlined/> : <StopOutlined/>}
                                    </div>
                                    <div className={styles.logBody}>
                                        <div className={styles.logType}>{log.type === "checkin" ? "Vào ca" : "Ra ca"}</div>
                                        <div className={styles.logTime}>{formatDayTime(log.timestamp)}</div>
                                    </div>
                                    <div className={styles.logConf}>{log.confidence.toFixed(2)}</div>
                                </div>
                            ))}
                            {latestLogs.length === 0 ?
                                <div className={styles.empty}>Chưa có dữ liệu chấm công.</div> : null}
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Card from "../../components/Card/Card";
import { mockSettings } from "../../../shared/mock/mockData";
import {
  ApiOutlined,
  BellOutlined,
  CameraOutlined,
  ClockCircleOutlined,
  FileImageOutlined,
  GlobalOutlined,
  KeyOutlined,
  MailOutlined,
  MoonOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  SettingOutlined,
  SoundOutlined,
  UserAddOutlined
} from "@ant-design/icons";
import {
  getAttendanceEvidenceSettings,
  getAttendancePolicy,
  getAuthRegistrationSettings,
  updateAttendanceEvidenceSettings,
  updateAttendancePolicy,
  updateAuthRegistrationSettings
} from "../../../shared/api/settings";
import {
  getCompany,
  getMyCompany,
  updateCompany,
  updateMyCompany,
  uploadCompanyAttendanceSound,
  uploadCompanyLogo,
  uploadMyCompanyAttendanceSound,
  uploadMyCompanyLogo
} from "../../../shared/api/companies";
import { getCompanyNotificationPolicies, updateCompanyNotificationPolicies } from "../../../shared/api/notifications";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import { useTheme } from "../../../shared/theme/theme";
import { useGeoPosition } from "../../../shared/hooks/useGeoPosition";
import { useNavigate } from "react-router-dom";
import styles from "./SettingsPage.module.scss";
import { useAuth } from "../../../shared/auth/auth";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { viStatusLabel } from "../../../shared/i18n/vi";
import { emitCompanyBrandingUpdated } from "../../../shared/companyBranding/companyBranding";
import { ATTENDANCE_SOUND_SAMPLE_OPTIONS, previewAttendanceFeedback, primeAttendanceAudioPlayback } from "../../../shared/audio/attendanceAudio";

type LatLng = { lat: number; lng: number };
type NominatimResult = { display_name: string; lat: string; lon: string };
type AttendanceSoundSource = "default" | "sample" | "upload" | "url" | "tts";

const ATTENDANCE_SOUND_SOURCE_OPTIONS: Array<{ value: AttendanceSoundSource; label: string }> = [
  { value: "default", label: "Mặc định toàn app" },
  { value: "sample", label: "Âm thanh mẫu" },
  { value: "upload", label: "File công ty upload" },
  { value: "url", label: "Nguồn URL ngoài" },
  { value: "tts", label: "Nhập text để đọc" }
];

function isFiniteLatLng(v: LatLng | null): v is LatLng {
  return !!v && Number.isFinite(v.lat) && Number.isFinite(v.lng);
}

function normalizeLatLng(lat: number, lng: number): LatLng {
  const clat = Math.max(-90, Math.min(90, lat));
  let clng = lng;
  while (clng < -180) clng += 360;
  while (clng > 180) clng -= 360;
  return { lat: clat, lng: clng };
}

let leafletIconsFixed = false;
function ensureLeafletDefaultIcon() {
  if (leafletIconsFixed) return;
  leafletIconsFixed = true;
  // Fix broken default marker icon in many bundlers.
  // @ts-ignore
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString(),
    iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString(),
    shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString()
  });
}

function Recenter({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], Math.max(map.getZoom(), 15), { animate: true });
  }, [center.lat, center.lng, map]);
  return null;
}

function MapClickPicker({ onPick }: { onPick(next: LatLng): void }) {
  useMapEvents({
    click(e) {
      onPick(normalizeLatLng(e.latlng.lat, e.latlng.lng));
    }
  });
  return null;
}

function Toggle({
  checked,
  onChange,
  label,
  disabled = false
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={checked ? `${styles.toggle} ${styles.toggleOn}` : styles.toggle}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

function sectionTitle(icon: ReactNode, label: string) {
  return (
    <span className={styles.cardTitle}>
      <span className={styles.cardTitleIcon}>{icon}</span>
      <span>{label}</span>
    </span>
  );
}

export default function SettingsPage() {
  const nav = useNavigate();
  const auth = useAuth();
  const isSystemAdmin = auth.roleKeys.includes("admin");
  const [company, setCompany] = useState<string>("");
  const [companyAddr, setCompanyAddr] = useState<string>("");
  const [companyLat, setCompanyLat] = useState<string>("");
  const [companyLng, setCompanyLng] = useState<string>("");
  const [companyRadius, setCompanyRadius] = useState<number>(250);
  const [companyRequireGps, setCompanyRequireGps] = useState(false);
  const [companyLogoDataUrl, setCompanyLogoDataUrl] = useState<string | null>(null);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyLogoUploading, setCompanyLogoUploading] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [soundSaving, setSoundSaving] = useState(false);
  const [soundUploading, setSoundUploading] = useState<"success" | "failure" | null>(null);
  const [soundError, setSoundError] = useState<string | null>(null);
  const [successSoundSource, setSuccessSoundSource] = useState<AttendanceSoundSource>("default");
  const [successSoundSampleId, setSuccessSoundSampleId] = useState<string>(ATTENDANCE_SOUND_SAMPLE_OPTIONS[0].id);
  const [successSoundUrl, setSuccessSoundUrl] = useState("");
  const [successSoundText, setSuccessSoundText] = useState("Chấm công thành công");
  const [successSoundDataUrl, setSuccessSoundDataUrl] = useState<string | null>(null);
  const [failureSoundSource, setFailureSoundSource] = useState<AttendanceSoundSource>("default");
  const [failureSoundSampleId, setFailureSoundSampleId] = useState<string>("alert-buzz");
  const [failureSoundUrl, setFailureSoundUrl] = useState("");
  const [failureSoundText, setFailureSoundText] = useState("Chấm công thất bại, vui lòng thử lại");
  const [failureSoundDataUrl, setFailureSoundDataUrl] = useState<string | null>(null);
  const companyLogoInputRef = useRef<HTMLInputElement | null>(null);
  const successSoundInputRef = useRef<HTMLInputElement | null>(null);
  const failureSoundInputRef = useRef<HTMLInputElement | null>(null);
  const [mapQuery, setMapQuery] = useState("");
  const [mapSearching, setMapSearching] = useState(false);
  const [mapResults, setMapResults] = useState<NominatimResult[]>([]);
  const [language, setLanguage] = useState<"vi" | "en">("vi");
  const [dailyEmailReport, setDailyEmailReport] = useState(true);
  const [twoFactor, setTwoFactor] = useState(true);
  const { mode, resolvedTheme, setMode } = useTheme();

  const [defaultCamera, setDefaultCamera] = useState<"front" | "back" | "external">("front");
  const [liveness, setLiveness] = useState(true);

  const [policyLoading, setPolicyLoading] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  const [timezone, setTimezone] = useState(() => mockSettings.values.timezone);
  const [faceThresholdPct, setFaceThresholdPct] = useState(95);
  const [shiftStart, setShiftStart] = useState("09:00");
  const [shiftEnd, setShiftEnd] = useState("18:00");
  const [lateGraceMins, setLateGraceMins] = useState(0);
  const [earlyLeaveGraceMins, setEarlyLeaveGraceMins] = useState(0);
  const [breakStart, setBreakStart] = useState("12:00");
  const [breakEnd, setBreakEnd] = useState("13:00");
  const [breakDurationMinutes, setBreakDurationMinutes] = useState(60);
  const [breakThresholdHours, setBreakThresholdHours] = useState(6);
  const [autoCheckoutTime, setAutoCheckoutTime] = useState("23:59");
  const [checkinFrom, setCheckinFrom] = useState("06:00");
  const [checkinTo, setCheckinTo] = useState("12:00");
  const [checkoutFrom, setCheckoutFrom] = useState("12:00");
  const [checkoutTo, setCheckoutTo] = useState("23:00");
  const [minMinutesBetween, setMinMinutesBetween] = useState(2);

  const [policyLoadedOnce, setPolicyLoadedOnce] = useState(false);
  const geo = useGeoPosition({ watch: false });
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceSaving, setEvidenceSaving] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [evidenceEnabled, setEvidenceEnabled] = useState(true);
  const [evidenceQuality, setEvidenceQuality] = useState(82);
  const [evidenceMaxWidth, setEvidenceMaxWidth] = useState(1280);
  const [evidenceFormat, setEvidenceFormat] = useState<"webp" | "jpeg">("webp");
  const [evidenceRetentionDays, setEvidenceRetentionDays] = useState(30);

  const [notifLate, setNotifLate] = useState(true);
  const [notifAbsent, setNotifAbsent] = useState(true);
  const [notifNewLeave, setNotifNewLeave] = useState(true);
  const [notifDailyReport, setNotifDailyReport] = useState(false);
  const [notifOvertime, setNotifOvertime] = useState(true);
  const [notifAttendancePolicy, setNotifAttendancePolicy] = useState(true);
  const [notifGpsPolicy, setNotifGpsPolicy] = useState(true);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [authRegEnabled, setAuthRegEnabled] = useState(false);
  const [authRegLoading, setAuthRegLoading] = useState(false);
  const [authRegSaving, setAuthRegSaving] = useState(false);
  const [authRegError, setAuthRegError] = useState<string | null>(null);

  const languageLabel = useMemo(() => (language === "vi" ? "Tiếng Việt" : "English"), [language]);
  const themeLabel = useMemo(() => {
    if (mode === "system") return resolvedTheme === "dark" ? "Theo hệ thống (đang tối)" : "Theo hệ thống (đang sáng)";
    return mode === "dark" ? "Tối" : "Sáng";
  }, [mode, resolvedTheme]);

  const companyLatLng: LatLng | null = useMemo(() => {
    const lat = companyLat.trim() ? Number(companyLat) : NaN;
    const lng = companyLng.trim() ? Number(companyLng) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return normalizeLatLng(lat, lng);
  }, [companyLat, companyLng]);

  const mapCenter: LatLng = useMemo(() => {
    if (isFiniteLatLng(companyLatLng)) return companyLatLng;
    if (geo.latitude != null && geo.longitude != null) return normalizeLatLng(geo.latitude, geo.longitude);
    return { lat: 10.776889, lng: 106.700806 }; // HCMC fallback
  }, [companyLatLng, geo.latitude, geo.longitude]);

  useEffect(() => {
    (async () => {
      try {
        setPolicyLoading(true);
        setPolicyError(null);
        const p = await getAttendancePolicy();
        setTimezone(p.timezone);
        setFaceThresholdPct(Math.round((p.face_match_threshold ?? 0.5) * 100));
        setShiftStart(p.shift_start);
        setShiftEnd(p.shift_end);
        setLateGraceMins(p.late_grace_minutes);
        setEarlyLeaveGraceMins(p.early_leave_grace_minutes);
        setBreakStart(p.break_start ?? "12:00");
        setBreakEnd(p.break_end ?? "13:00");
        setBreakDurationMinutes(Number(p.break_duration_minutes ?? 60));
        setBreakThresholdHours(Number(p.break_threshold_hours ?? 6));
        setAutoCheckoutTime(p.auto_checkout_time ?? "23:59");
        setCheckinFrom(p.checkin_from);
        setCheckinTo(p.checkin_to);
        setCheckoutFrom(p.checkout_from);
        setCheckoutTo(p.checkout_to);
        setMinMinutesBetween(p.min_minutes_between_same_type);
        setPolicyLoadedOnce(true);
      } catch (e) {
        setPolicyError(getApiErrorMessage(e));
      } finally {
        setPolicyLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const cid = auth.roleKeys.includes("admin") ? (auth.selectedCompanyId ?? null) : null;
        const c = cid ? await getCompany(cid) : await getMyCompany();
        setCompany(c.name ?? "");
        setCompanyAddr((c as any).address ?? "");
        setCompanyLat((c as any).latitude != null ? String((c as any).latitude) : "");
        setCompanyLng((c as any).longitude != null ? String((c as any).longitude) : "");
        setCompanyRadius(Number((c as any).geo_radius_meters ?? 250));
        setCompanyRequireGps(Boolean((c as any).require_gps_on_attendance ?? false));
        setCompanyLogoDataUrl((c as any).logo_data_url ?? null);
        setSuccessSoundSource(((c as any).attendance_success_sound_source ?? "default") as AttendanceSoundSource);
        setSuccessSoundSampleId((c as any).attendance_success_sound_sample_id ?? ATTENDANCE_SOUND_SAMPLE_OPTIONS[0].id);
        setSuccessSoundUrl((c as any).attendance_success_sound_url ?? "");
        setSuccessSoundText((c as any).attendance_success_sound_text ?? "Chấm công thành công");
        setSuccessSoundDataUrl((c as any).attendance_success_sound_data_url ?? null);
        setFailureSoundSource(((c as any).attendance_failure_sound_source ?? "default") as AttendanceSoundSource);
        setFailureSoundSampleId((c as any).attendance_failure_sound_sample_id ?? "alert-buzz");
        setFailureSoundUrl((c as any).attendance_failure_sound_url ?? "");
        setFailureSoundText((c as any).attendance_failure_sound_text ?? "Chấm công thất bại, vui lòng thử lại");
        setFailureSoundDataUrl((c as any).attendance_failure_sound_data_url ?? null);
        setCompanyError(null);
        setSoundError(null);
      } catch (e) {
        setCompanyError(getApiErrorMessage(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.selectedCompanyId, auth.roleKeys.join("|")]);

  useEffect(() => {
    if (!isSystemAdmin) return;
    (async () => {
      try {
        setAuthRegLoading(true);
        setAuthRegError(null);
        const cfg = await getAuthRegistrationSettings();
        setAuthRegEnabled(Boolean(cfg.public_registration_enabled));
      } catch (e) {
        setAuthRegError(getApiErrorMessage(e));
      } finally {
        setAuthRegLoading(false);
      }
    })();
  }, [isSystemAdmin]);

  async function handleAuthRegistrationToggle(nextEnabled: boolean) {
    const previous = authRegEnabled;
    try {
      setAuthRegEnabled(nextEnabled);
      setAuthRegSaving(true);
      setAuthRegError(null);
      const next = await updateAuthRegistrationSettings({ public_registration_enabled: nextEnabled });
      setAuthRegEnabled(Boolean(next.public_registration_enabled));
      return;
    } catch (e) {
      setAuthRegEnabled(previous);
      setAuthRegError(getApiErrorMessage(e));
    } finally {
      setAuthRegSaving(false);
    }
  }

  useEffect(() => {
    ensureLeafletDefaultIcon();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setNotifLoading(true);
        setNotifError(null);
        const policies = await getCompanyNotificationPolicies();
        setNotifLate(Boolean(policies.late_attendance_enabled));
        setNotifAbsent(Boolean(policies.absent_attendance_enabled));
        setNotifNewLeave(Boolean(policies.new_leave_request_enabled));
        setNotifDailyReport(Boolean(policies.daily_report_enabled));
        setNotifOvertime(Boolean(policies.overtime_request_enabled));
        setNotifAttendancePolicy(Boolean(policies.attendance_policy_change_enabled));
        setNotifGpsPolicy(Boolean(policies.gps_policy_change_enabled));
      } catch (e) {
        setNotifError(getApiErrorMessage(e));
      } finally {
        setNotifLoading(false);
      }
    })();
  }, [auth.selectedCompanyId, auth.companyId]);

  useEffect(() => {
    (async () => {
      try {
        setEvidenceLoading(true);
        setEvidenceError(null);
        const settings = await getAttendanceEvidenceSettings();
        setEvidenceEnabled(Boolean(settings.enable_evidence_image));
        setEvidenceQuality(Number(settings.image_quality));
        setEvidenceMaxWidth(Number(settings.image_max_width));
        setEvidenceFormat(settings.image_format);
        setEvidenceRetentionDays(Number(settings.image_retention_days));
      } catch (e) {
        setEvidenceError(getApiErrorMessage(e));
      } finally {
        setEvidenceLoading(false);
      }
    })();
  }, [auth.selectedCompanyId, auth.companyId]);

  async function searchMap() {
    const q = mapQuery.trim();
    if (!q) return;
    try {
      setMapSearching(true);
      setMapResults([]);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`;
      const res = await fetch(url, { headers: { "Accept-Language": "vi" } });
      if (!res.ok) throw new Error("Không tìm được địa điểm");
      const json = (await res.json()) as unknown;
      const rows = Array.isArray(json) ? (json as NominatimResult[]) : [];
      setMapResults(rows);
    } catch (e) {
      setCompanyError(getApiErrorMessage(e));
    } finally {
      setMapSearching(false);
    }
  }

  async function handleLogoPicked(file: File) {
    try {
      setCompanyLogoUploading(true);
      setCompanyError(null);
      const cid = auth.roleKeys.includes("admin") ? (auth.selectedCompanyId ?? null) : null;
      const updated = cid ? await uploadCompanyLogo(cid, file) : await uploadMyCompanyLogo(file);
      setCompanyLogoDataUrl(updated.logo_data_url ?? null);
      emitCompanyBrandingUpdated({
        companyId: updated.id ?? cid ?? auth.companyId ?? null,
        name: updated.name ?? company,
        logoDataUrl: updated.logo_data_url ?? null
      });
      if (!auth.roleKeys.includes("admin")) {
        await auth.refreshMe();
      }
    } catch (e) {
      setCompanyError(getApiErrorMessage(e));
    } finally {
      setCompanyLogoUploading(false);
      if (companyLogoInputRef.current) {
        companyLogoInputRef.current.value = "";
      }
    }
  }

  async function handleAttendanceSoundPicked(kind: "success" | "failure", file: File) {
    try {
      await primeAttendanceAudioPlayback();
      setSoundUploading(kind);
      setSoundError(null);
      const cid = auth.roleKeys.includes("admin") ? (auth.selectedCompanyId ?? null) : null;
      const updated = cid ? await uploadCompanyAttendanceSound(cid, kind, file) : await uploadMyCompanyAttendanceSound(kind, file);
      if (kind === "success") {
        setSuccessSoundDataUrl(updated.attendance_success_sound_data_url ?? null);
      } else {
        setFailureSoundDataUrl(updated.attendance_failure_sound_data_url ?? null);
      }
    } catch (e) {
      setSoundError(getApiErrorMessage(e));
    } finally {
      setSoundUploading(null);
      if (kind === "success" && successSoundInputRef.current) successSoundInputRef.current.value = "";
      if (kind === "failure" && failureSoundInputRef.current) failureSoundInputRef.current.value = "";
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.grid2}>
        <div className={styles.col}>
          <Card title={sectionTitle(<SettingOutlined />, "Cài đặt chung")} sub="Tuỳ chỉnh hệ thống">
            <div className={styles.form}>
              <div className={styles.formRow}>
                <div className={styles.formLabel}>Logo công ty</div>
                <div className={styles.logoUploadBlock}>
                  <div className={styles.logoPreviewCard}>
                    {companyLogoDataUrl ? (
                      <img className={styles.logoPreviewImage} src={companyLogoDataUrl} alt={company || "Company logo"} />
                    ) : (
                      <div className={styles.logoPreviewFallback}>{(company.trim() || "C").slice(0, 1).toUpperCase()}</div>
                    )}
                  </div>
                  <div className={styles.logoUploadMeta}>
                    {/*<div className={styles.logoUploadTitle}>g c?ông Logo hiển thị cho từnty</div>*/}
                    <div className={styles.logoUploadHint}>PNG, JPG hoặc WEBP (Tối đa 2MB).</div>
                    <div className={styles.actions}>
                      <button className={styles.btnGhost} type="button" disabled={companyLogoUploading} onClick={() => companyLogoInputRef.current?.click()}>
                        {companyLogoUploading ? "Đang upload..." : "Tải logo lên"}
                      </button>
                    </div>
                    <input
                      ref={companyLogoInputRef}
                      className={styles.hiddenInput}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          void handleLogoPicked(file);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formLabel}>Tên công ty</div>
                <input className={styles.input} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Tên công ty" />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formLabel}>Địa chỉ</div>
                <input className={styles.input} value={companyAddr} onChange={(e) => setCompanyAddr(e.target.value)} placeholder="Địa chỉ công ty (tuỳ chọn)" />
              </div>
              <div className={`${styles.formRow} ${styles.formRowNoLabelGrid}`}>
                <div className={styles.formLabel}>Vị trí chấm công (GPS)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <input className={styles.input} value={companyLat} onChange={(e) => setCompanyLat(e.target.value)} placeholder="Latitude" />
                  <input className={styles.input} value={companyLng} onChange={(e) => setCompanyLng(e.target.value)} placeholder="Longitude" />
                </div>
                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr", gap: 10, alignItems: "center" }}>
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    value={companyRadius}
                    onChange={(e) => setCompanyRadius(Number(e.target.value))}
                    placeholder="Bán kính (m)"
                  />
                  <div style={{ color: "var(--text3)", fontSize: 12.5, fontWeight: 800 }}>
                    Bán kính hiện tại: {Number.isFinite(companyRadius) ? Math.max(0, Math.round(companyRadius)) : 0}m (0m = tắt giới hạn GPS)
                  </div>
                </div>
                <div className={styles.formGroupRow} style={{ marginTop: 10 }}>
                  <div className={styles.formLabelInline}>Yêu cầu GPS khi chấm công</div>
                  <div className={styles.rowRight}>
                    <Toggle checked={companyRequireGps} onChange={setCompanyRequireGps} label="Yêu cầu GPS khi chấm công" />
                    <div className={styles.hintInline}>{companyRequireGps ? "Bật" : "Tắt"}</div>
                  </div>
                </div>
                {/*<div style={{ color: "var(--text3)", fontSize: 12.5, fontWeight: 800, marginTop: 6 }}>*/}
                {/*  Khi bật: mỗi lần chấm công bắt buộc gửi vị trí GPS. Khi tắt: chấm công bỏ qua GPS và không áp dụng giới hạn bán kính.*/}
                {/*</div>*/}
                <div className={styles.mapWrap} style={{ marginTop: 12 }}>
                  <div className={styles.mapToolbar}>
                    <input
                      className={styles.mapSearchInput}
                      value={mapQuery}
                      onChange={(e) => setMapQuery(e.target.value)}
                      placeholder="Tìm địa điểm (ví dụ: 123 Lê Lợi, Q1)"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") searchMap();
                      }}
                      aria-label="Tìm địa điểm"
                    />
                    <button className={styles.btnGhost} type="button" disabled={mapSearching} onClick={searchMap}>
                      {mapSearching ? "Đang tìm..." : "Tìm"}
                    </button>
                    <button
                      className={styles.btnGhost}
                      type="button"
                      onClick={() => {
                        if (geo.latitude == null || geo.longitude == null) {
                          geo.refresh();
                          return;
                        }
                        const p = normalizeLatLng(geo.latitude, geo.longitude);
                        setCompanyLat(p.lat.toFixed(6));
                        setCompanyLng(p.lng.toFixed(6));
                      }}
                    >
                      Dùng GPS
                    </button>
                  </div>

                  <div className={styles.mapCanvas}>
                    <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={15} style={{ height: "100%", width: "100%" }}>
                      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <MapClickPicker
                        onPick={(p) => {
                          setCompanyLat(p.lat.toFixed(6));
                          setCompanyLng(p.lng.toFixed(6));
                        }}
                      />
                      {isFiniteLatLng(companyLatLng) ? (
                        <>
                          <Recenter center={companyLatLng} />
                          <Marker position={[companyLatLng.lat, companyLatLng.lng]} />
                        </>
                      ) : null}
                    </MapContainer>
                  </div>

                  {mapResults.length ? (
                    <div className={styles.searchResults}>
                      {mapResults.map((r, idx) => {
                        const lat = Number(r.lat);
                        const lng = Number(r.lon);
                        return (
                          <button
                            key={`${idx}-${r.lat}-${r.lon}`}
                            className={styles.searchItem}
                            type="button"
                            onClick={() => {
                              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                              const p = normalizeLatLng(lat, lng);
                              setCompanyLat(p.lat.toFixed(6));
                              setCompanyLng(p.lng.toFixed(6));
                              setMapResults([]);
                            }}
                            title={r.display_name}
                          >
                            {r.display_name}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {/*<div className={styles.mapHint}>*/}
                  {/*  Chạm vào bản đồ để chọn vị trí công ty. Khi đã cấu hình GPS + bán kính, hệ thống chỉ cho chấm công nếu vị trí nhân viên nằm trong bán kính này.*/}
                  {/*</div>*/}
                </div>
              </div>
              <div className={styles.actions} style={{ marginTop: 12 }}>
                <button
                  className={styles.btnPrimary}
                  type="button"
                  disabled={companySaving}
                  onClick={async () => {
                    try {
                      setCompanySaving(true);
                      setCompanyError(null);
                      const lat = companyLat.trim() ? Number(companyLat) : null;
                      const lng = companyLng.trim() ? Number(companyLng) : null;
                      if ((lat == null) !== (lng == null)) throw new Error("Latitude/Longitude phải đi cùng nhau");
                      const payload = {
                        name: company.trim() || null,
                        address: companyAddr.trim() || null,
                        latitude: lat,
                        longitude: lng,
                        geo_radius_meters: Number.isFinite(companyRadius) ? companyRadius : 250,
                        require_gps_on_attendance: companyRequireGps
                      };
                      const cid = auth.roleKeys.includes("admin") ? (auth.selectedCompanyId ?? null) : null;
                      const updated = cid ? await updateCompany(cid, payload) : await updateMyCompany(payload);
                      setCompany(updated.name ?? "");
                      setCompanyAddr(updated.address ?? "");
                      setCompanyLat(updated.latitude != null ? String(updated.latitude) : "");
                      setCompanyLng(updated.longitude != null ? String(updated.longitude) : "");
                      setCompanyRadius(Number(updated.geo_radius_meters ?? 250));
                      setCompanyRequireGps(Boolean(updated.require_gps_on_attendance ?? false));
                      setCompanyLogoDataUrl(updated.logo_data_url ?? null);
                      setSuccessSoundDataUrl(updated.attendance_success_sound_data_url ?? successSoundDataUrl);
                      setFailureSoundDataUrl(updated.attendance_failure_sound_data_url ?? failureSoundDataUrl);
                      emitCompanyBrandingUpdated({
                        companyId: updated.id ?? cid ?? auth.companyId ?? null,
                        name: updated.name ?? null,
                        logoDataUrl: updated.logo_data_url ?? null
                      });
                      if (!auth.roleKeys.includes("admin")) {
                        await auth.refreshMe();
                      }
                    } catch (e) {
                      setCompanyError(getApiErrorMessage(e));
                    } finally {
                      setCompanySaving(false);
                    }
                  }}
                >
                  <SaveOutlined /> Lưu vị trí công ty
                </button>
                {companyError ? <div style={{ marginLeft: 12, color: "var(--danger)", fontWeight: 800 }}>{companyError}</div> : null}
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.settingsList}>
              <div className={styles.settingsItem}>
                <div className={`${styles.settingsIcon} ${styles.iconInfo}`}>
                  <GlobalOutlined />
                </div>
                <div className={styles.settingsInfo}>
                  <div className={styles.settingsLabel}>Ngôn ngữ</div>
                  <div className={styles.settingsDesc}>{languageLabel}</div>
                </div>
                <select className={styles.selectCompact} value={language} onChange={(e) => setLanguage(e.target.value as "vi" | "en")} aria-label="Ngôn ngữ">
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div className={styles.settingsItem}>
                <div className={`${styles.settingsIcon} ${styles.iconPurple}`}>
                  <MoonOutlined />
                </div>
                <div className={styles.settingsInfo}>
                  <div className={styles.settingsLabel}>Giao diện</div>
                  <div className={styles.settingsDesc}>{themeLabel}</div>
                </div>
                <select className={styles.selectCompact} value={mode} onChange={(e) => setMode(e.target.value as "system" | "light" | "dark")} aria-label="Giao diện">
                  <option value="system">Theo hệ thống</option>
                  <option value="light">Sáng</option>
                  <option value="dark">Tối</option>
                </select>
              </div>

              <div className={styles.settingsItem}>
                <div className={`${styles.settingsIcon} ${styles.iconSuccess}`}>
                  <MailOutlined />
                </div>
                <div className={styles.settingsInfo}>
                  <div className={styles.settingsLabel}>Email thông báo</div>
                  <div className={styles.settingsDesc}>Gửi report hàng ngày</div>
                </div>
                <Toggle checked={dailyEmailReport} onChange={setDailyEmailReport} label="Email thông báo" />
              </div>

              <div className={styles.settingsItem}>
                <div className={`${styles.settingsIcon} ${styles.iconDanger}`}>
                  <SafetyCertificateOutlined />
                </div>
                <div className={styles.settingsInfo}>
                  <div className={styles.settingsLabel}>Bảo mật 2 lớp</div>
                  <div className={styles.settingsDesc}>Xác thực 2 yếu tố</div>
                </div>
                <Toggle checked={twoFactor} onChange={setTwoFactor} label="Bảo mật 2 lớp" />
              </div>

              {isSystemAdmin ? (
                <div className={styles.settingsItem}>
                  <div className={`${styles.settingsIcon} ${styles.iconInfo}`}>
                    <UserAddOutlined />
                  </div>
                  <div className={styles.settingsInfo}>
                    <div className={styles.settingsLabel}>Tự đăng ký tài khoản</div>
                    <div className={styles.settingsDesc}>
                      {authRegError
                        ? authRegError
                        : authRegLoading
                          ? "Đang tải cấu hình..."
                          : authRegEnabled
                            ? "Public register đang bật"
                            : "Chỉ tạo tài khoản bằng hồ sơ nhân viên hoặc invite"}
                    </div>
                  </div>
                  <Toggle
                    checked={authRegEnabled}
                    onChange={(next) => void handleAuthRegistrationToggle(next)}
                    label="Tự đăng ký tài khoản"
                    disabled={authRegLoading || authRegSaving}
                  />
                </div>
              ) : null}

              <button className={`${styles.settingsItem} ${styles.settingsClickable}`} type="button" onClick={() => nav("/change-password")}>
                <div className={`${styles.settingsIcon} ${styles.iconDanger}`}>
                  <KeyOutlined />
                </div>
                <div className={styles.settingsInfo}>
                  <div className={styles.settingsLabel}>Đổi mật khẩu</div>
                  <div className={styles.settingsDesc}>Thay đổi mật khẩu đăng nhập</div>
                </div>
                <div className={styles.settingsArrow}>
                  <RightOutlined />
                </div>
              </button>
            </div>
          </Card>

          <Card title={sectionTitle(<CameraOutlined />, "Cài đặt nhận diện khuôn mặt")} sub="Ngưỡng + camera + chống giả mạo">
            <div className={styles.form}>
              <div className={styles.formGroup}>
                <div className={styles.formLabelInline}>Ngưỡng nhận diện (%)</div>
                <input
                  className={styles.range}
                  type="range"
                  min={70}
                  max={99}
                  value={faceThresholdPct}
                  onChange={(e) => setFaceThresholdPct(Number(e.target.value))}
                  aria-label="Ngưỡng nhận diện"
                />
                <div className={styles.rangeValue}>{faceThresholdPct}%</div>
              </div>

              <div className={styles.formGroup}>
                <div className={styles.formLabelInline}>Camera mặc định</div>
                <select
                  className={styles.input}
                  value={defaultCamera}
                  onChange={(e) => setDefaultCamera(e.target.value as "front" | "back" | "external")}
                  aria-label="Camera mặc định"
                >
                  <option value="front">Camera trước</option>
                  <option value="back">Camera sau</option>
                  <option value="external">Camera ngoài</option>
                </select>
              </div>

              <div className={styles.formGroupRow}>
                <div className={styles.formLabelInline}>Chống giả mạo (liveness detection)</div>
                <div className={styles.rowRight}>
                  <Toggle checked={liveness} onChange={setLiveness} label="Chống giả mạo" />
                  <div className={styles.hintInline}>{liveness ? "Bật" : "Tắt"}</div>
                </div>
              </div>

              <div className={styles.actions}>
                <button
                  className={styles.btnPrimary}
                  type="button"
                  disabled={!policyLoadedOnce || policyLoading || policySaving}
                  onClick={async () => {
                    try {
                      setPolicySaving(true);
                      setPolicyError(null);
                      const next = await updateAttendancePolicy({
                        timezone,
                        face_match_threshold: faceThresholdPct / 100,
                        shift_start: shiftStart,
                        shift_end: shiftEnd,
                        late_grace_minutes: lateGraceMins,
                        early_leave_grace_minutes: earlyLeaveGraceMins,
                        break_start: breakStart,
                        break_end: breakEnd,
                        break_duration_minutes: breakDurationMinutes,
                        break_threshold_hours: breakThresholdHours,
                        auto_checkout_time: autoCheckoutTime,
                        checkin_from: checkinFrom,
                        checkin_to: checkinTo,
                        checkout_from: checkoutFrom,
                        checkout_to: checkoutTo,
                        min_minutes_between_same_type: minMinutesBetween
                      });
                      setTimezone(next.timezone);
                      setFaceThresholdPct(Math.round(next.face_match_threshold * 100));
                      setShiftStart(next.shift_start);
                      setShiftEnd(next.shift_end);
                      setLateGraceMins(next.late_grace_minutes);
                      setEarlyLeaveGraceMins(next.early_leave_grace_minutes);
                      setBreakStart(next.break_start ?? breakStart);
                      setBreakEnd(next.break_end ?? breakEnd);
                      setBreakDurationMinutes(Number(next.break_duration_minutes ?? breakDurationMinutes));
                      setBreakThresholdHours(Number(next.break_threshold_hours ?? breakThresholdHours));
                      setAutoCheckoutTime(next.auto_checkout_time ?? autoCheckoutTime);
                      setCheckinFrom(next.checkin_from);
                      setCheckinTo(next.checkin_to);
                      setCheckoutFrom(next.checkout_from);
                      setCheckoutTo(next.checkout_to);
                      setMinMinutesBetween(next.min_minutes_between_same_type);
                    } catch (e) {
                      setPolicyError(getApiErrorMessage(e));
                    } finally {
                      setPolicySaving(false);
                    }
                  }}
                >
                  {policySaving ? "Đang lưu..." : <><SaveOutlined /> Lưu cài đặt</>}
                </button>
                <button className={styles.btnGhost} type="button" disabled={!policyLoadedOnce || policyLoading || policySaving}>
                  Khôi phục
                </button>
              </div>
            </div>
          </Card>
        </div>

        <div className={styles.col}>
          <Card title={sectionTitle(<ClockCircleOutlined />, "Quy định giờ làm")}>
            {policyError ? <div className={styles.errorBox}>{policyError}</div> : null}
            <div className={styles.form}>
              <div className={styles.formRow}>
                <div className={styles.formLabel}>Giờ vào chuẩn</div>
                <input className={styles.input} type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} disabled={!policyLoadedOnce || policyLoading} />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formLabel}>Giờ ra chuẩn</div>
                <input className={styles.input} type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} disabled={!policyLoadedOnce || policyLoading} />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formLabel}>Cho phép đến muộn (phút)</div>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  value={lateGraceMins}
                  onChange={(e) => setLateGraceMins(Number(e.target.value))}
                  disabled={!policyLoadedOnce || policyLoading}
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formLabel}>Cho phép về sớm (phút)</div>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  value={earlyLeaveGraceMins}
                  onChange={(e) => setEarlyLeaveGraceMins(Number(e.target.value))}
                  disabled={!policyLoadedOnce || policyLoading}
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formLabel}>Giờ nghỉ trưa</div>
                <div className={styles.rangeInputs}>
                  <input className={styles.input} type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} disabled={!policyLoadedOnce || policyLoading} />
                  <span className={styles.rangeSep}>→</span>
                  <input className={styles.input} type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} disabled={!policyLoadedOnce || policyLoading} />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formLabel}>Trừ nghỉ tối đa (phút)</div>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  max={240}
                  value={breakDurationMinutes}
                  onChange={(e) => setBreakDurationMinutes(Number(e.target.value))}
                  disabled={!policyLoadedOnce || policyLoading}
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formLabel}>Ngưỡng trừ nghỉ (giờ)</div>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={breakThresholdHours}
                  onChange={(e) => setBreakThresholdHours(Number(e.target.value))}
                  disabled={!policyLoadedOnce || policyLoading}
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formLabel}>Auto check-out</div>
                <input className={styles.input} type="time" value={autoCheckoutTime} onChange={(e) => setAutoCheckoutTime(e.target.value)} disabled={!policyLoadedOnce || policyLoading} />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formLabel}>Múi giờ</div>
                <select className={styles.input} value={timezone} onChange={(e) => setTimezone(e.target.value)} disabled={!policyLoadedOnce || policyLoading}>
                  {mockSettings.timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.divider} />

              <div className={styles.rangeGrid}>
                <div className={styles.rangeTitle}>Cửa sổ check-in</div>
                <div className={styles.rangeInputs}>
                  <input className={styles.input} type="time" value={checkinFrom} onChange={(e) => setCheckinFrom(e.target.value)} disabled={!policyLoadedOnce || policyLoading} />
                  <span className={styles.rangeSep}>→</span>
                  <input className={styles.input} type="time" value={checkinTo} onChange={(e) => setCheckinTo(e.target.value)} disabled={!policyLoadedOnce || policyLoading} />
                </div>
              </div>

              <div className={styles.rangeGrid}>
                <div className={styles.rangeTitle}>Cửa sổ check-out</div>
                <div className={styles.rangeInputs}>
                  <input className={styles.input} type="time" value={checkoutFrom} onChange={(e) => setCheckoutFrom(e.target.value)} disabled={!policyLoadedOnce || policyLoading} />
                  <span className={styles.rangeSep}>→</span>
                  <input className={styles.input} type="time" value={checkoutTo} onChange={(e) => setCheckoutTo(e.target.value)} disabled={!policyLoadedOnce || policyLoading} />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formLabel}>Chống spam (phút)</div>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  value={minMinutesBetween}
                  onChange={(e) => setMinMinutesBetween(Number(e.target.value))}
                  disabled={!policyLoadedOnce || policyLoading}
                />
              </div>

              <button
                className={styles.btnPrimaryFull}
                type="button"
                disabled={!policyLoadedOnce || policyLoading || policySaving}
                onClick={async () => {
                  try {
                    setPolicySaving(true);
                    setPolicyError(null);
                    const next = await updateAttendancePolicy({
                      timezone,
                      face_match_threshold: faceThresholdPct / 100,
                      shift_start: shiftStart,
                      shift_end: shiftEnd,
                      late_grace_minutes: lateGraceMins,
                      early_leave_grace_minutes: earlyLeaveGraceMins,
                      break_start: breakStart,
                      break_end: breakEnd,
                      break_duration_minutes: breakDurationMinutes,
                      break_threshold_hours: breakThresholdHours,
                      auto_checkout_time: autoCheckoutTime,
                      checkin_from: checkinFrom,
                      checkin_to: checkinTo,
                      checkout_from: checkoutFrom,
                      checkout_to: checkoutTo,
                      min_minutes_between_same_type: minMinutesBetween
                    });
                    setTimezone(next.timezone);
                    setFaceThresholdPct(Math.round(next.face_match_threshold * 100));
                    setShiftStart(next.shift_start);
                    setShiftEnd(next.shift_end);
                    setLateGraceMins(next.late_grace_minutes);
                    setEarlyLeaveGraceMins(next.early_leave_grace_minutes);
                    setBreakStart(next.break_start ?? breakStart);
                    setBreakEnd(next.break_end ?? breakEnd);
                    setBreakDurationMinutes(Number(next.break_duration_minutes ?? breakDurationMinutes));
                    setBreakThresholdHours(Number(next.break_threshold_hours ?? breakThresholdHours));
                    setAutoCheckoutTime(next.auto_checkout_time ?? autoCheckoutTime);
                    setCheckinFrom(next.checkin_from);
                    setCheckinTo(next.checkin_to);
                    setCheckoutFrom(next.checkout_from);
                    setCheckoutTo(next.checkout_to);
                    setMinMinutesBetween(next.min_minutes_between_same_type);
                  } catch (e) {
                    setPolicyError(getApiErrorMessage(e));
                  } finally {
                    setPolicySaving(false);
                  }
                }}
              >
                {policySaving ? "Đang lưu..." : <><SaveOutlined /> Lưu cài đặt</>}
              </button>
            </div>
          </Card>

          <Card
            title={sectionTitle(<BellOutlined />, "Thông báo")}
            sub={notifLoading ? "Đang tải cấu hình..." : "Bật/tắt các loại cảnh báo theo công ty"}
            right={
              <button
                className={styles.btnGhost}
                type="button"
                disabled={notifSaving || notifLoading}
                onClick={async () => {
                  try {
                    setNotifSaving(true);
                    setNotifError(null);
                    await updateCompanyNotificationPolicies({
                      late_attendance_enabled: notifLate,
                      absent_attendance_enabled: notifAbsent,
                      new_leave_request_enabled: notifNewLeave,
                      daily_report_enabled: notifDailyReport,
                      overtime_request_enabled: notifOvertime,
                      attendance_policy_change_enabled: notifAttendancePolicy,
                      gps_policy_change_enabled: notifGpsPolicy
                    });
                  } catch (e) {
                    setNotifError(getApiErrorMessage(e));
                  } finally {
                    setNotifSaving(false);
                  }
                }}
              >
                {notifSaving ? "Đang lưu..." : <><SaveOutlined /> Lưu thông báo</>}
              </button>
            }
          >
            {notifError ? <div style={{ marginBottom: 12, color: "var(--danger)", fontWeight: 800 }}>{notifError}</div> : null}
            <div className={styles.simpleList}>
              <div className={styles.simpleRow}>
                <div className={styles.simpleLabel}>Cảnh báo đi muộn</div>
                <Toggle checked={notifLate} onChange={setNotifLate} label="Cảnh báo đi muộn" />
              </div>
              <div className={styles.simpleRow}>
                <div className={styles.simpleLabel}>Thông báo vắng mặt</div>
                <Toggle checked={notifAbsent} onChange={setNotifAbsent} label="Thông báo vắng mặt" />
              </div>
              <div className={styles.simpleRow}>
                <div className={styles.simpleLabel}>Đơn nghỉ phép mới</div>
                <Toggle checked={notifNewLeave} onChange={setNotifNewLeave} label="Đơn nghỉ phép mới" />
              </div>
              <div className={styles.simpleRow}>
                <div className={styles.simpleLabel}>Báo cáo cuối ngày</div>
                <Toggle checked={notifDailyReport} onChange={setNotifDailyReport} label="Báo cáo cuối ngày" />
              </div>
              <div className={styles.simpleRow}>
                <div className={styles.simpleLabel}>Nhắc nhở tăng ca</div>
                <Toggle checked={notifOvertime} onChange={setNotifOvertime} label="Nhắc nhở tăng ca" />
              </div>
              <div className={styles.simpleRow}>
                <div className={styles.simpleLabel}>Đổi chính sách chấm công</div>
                <Toggle checked={notifAttendancePolicy} onChange={setNotifAttendancePolicy} label="Đổi chính sách chấm công" />
              </div>
              <div className={`${styles.simpleRow} ${styles.simpleRowLast}`}>
                <div className={styles.simpleLabel}>Đổi cấu hình GPS công ty</div>
                <Toggle checked={notifGpsPolicy} onChange={setNotifGpsPolicy} label="Đổi cấu hình GPS công ty" />
              </div>
            </div>
          </Card>

          <Card
            title={sectionTitle(<FileImageOutlined />, "Attendance Evidence")}
            sub={evidenceLoading ? "Đang tải cấu hình lưu ảnh..." : "Điều khiển lưu ảnh, nén ảnh và thời gian giữ ảnh theo từng công ty"}
            right={
              <button
                className={styles.btnGhost}
                type="button"
                disabled={evidenceSaving || evidenceLoading}
                onClick={async () => {
                  try {
                    setEvidenceSaving(true);
                    setEvidenceError(null);
                    const next = await updateAttendanceEvidenceSettings({
                      enable_evidence_image: evidenceEnabled,
                      image_quality: evidenceQuality,
                      image_max_width: evidenceMaxWidth,
                      image_format: evidenceFormat,
                      image_retention_days: evidenceRetentionDays
                    });
                    setEvidenceEnabled(Boolean(next.enable_evidence_image));
                    setEvidenceQuality(Number(next.image_quality));
                    setEvidenceMaxWidth(Number(next.image_max_width));
                    setEvidenceFormat(next.image_format);
                    setEvidenceRetentionDays(Number(next.image_retention_days));
                  } catch (e) {
                    setEvidenceError(getApiErrorMessage(e));
                  } finally {
                    setEvidenceSaving(false);
                  }
                }}
              >
                {evidenceSaving ? "Đang lưu..." : <><SaveOutlined /> Lưu evidence</>}
              </button>
            }
          >
            {evidenceError ? <div className={styles.errorBox}>{evidenceError}</div> : null}
            <div className={styles.simpleList}>
              <div className={styles.simpleRow}>
                <div>
                  <div className={styles.simpleLabel}>Lưu ảnh bằng chứng</div>
                  <div className={styles.simpleHint}>Bật để worker nén, upload MinIO và cấp presigned URL cho lịch sử chấm công.</div>
                </div>
                <Toggle checked={evidenceEnabled} onChange={setEvidenceEnabled} label="Lưu ảnh bằng chứng" />
              </div>
            </div>

            <div className={styles.form} style={{ marginTop: 14 }}>
              <div className={styles.formRow}>
                <div className={styles.formLabel}>Định dạng ảnh</div>
                <select
                  className={styles.input}
                  value={evidenceFormat}
                  onChange={(e) => setEvidenceFormat(e.target.value as "webp" | "jpeg")}
                  disabled={evidenceLoading || evidenceSaving}
                >
                  <option value="webp">WEBP</option>
                  <option value="jpeg">JPEG</option>
                </select>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formLabel}>Chất lượng nén</div>
                <input
                  className={styles.input}
                  type="number"
                  min={30}
                  max={95}
                  value={evidenceQuality}
                  onChange={(e) => setEvidenceQuality(Number(e.target.value))}
                  disabled={evidenceLoading || evidenceSaving}
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formLabel}>Chiều rộng tối đa</div>
                <input
                  className={styles.input}
                  type="number"
                  min={240}
                  max={4096}
                  step={10}
                  value={evidenceMaxWidth}
                  onChange={(e) => setEvidenceMaxWidth(Number(e.target.value))}
                  disabled={evidenceLoading || evidenceSaving}
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formLabel}>Giữ ảnh (ngày)</div>
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  max={3650}
                  value={evidenceRetentionDays}
                  onChange={(e) => setEvidenceRetentionDays(Number(e.target.value))}
                  disabled={evidenceLoading || evidenceSaving}
                />
              </div>
            </div>

            <div className={styles.evidenceMetaGrid}>
              <div className={styles.evidenceMetaCard}>
                <div className={styles.evidenceMetaValue}>{evidenceFormat.toUpperCase()}</div>
                <div className={styles.evidenceMetaLabel}>Định dạng hiện tại</div>
              </div>
              <div className={styles.evidenceMetaCard}>
                <div className={styles.evidenceMetaValue}>{evidenceMaxWidth}px</div>
                <div className={styles.evidenceMetaLabel}>Kích thước tối đa</div>
              </div>
              <div className={styles.evidenceMetaCard}>
                <div className={styles.evidenceMetaValue}>{evidenceRetentionDays}</div>
                <div className={styles.evidenceMetaLabel}>Ngày lưu trữ</div>
              </div>
            </div>
          </Card>

          <Card
            title={sectionTitle(<SoundOutlined />, "Âm thanh chấm công")}
            sub="Cấu hình âm thanh thành công và thất bại theo từng công ty. Nếu để mặc định, toàn app dùng preset chung."
            right={
              <button
                className={styles.btnGhost}
                type="button"
                disabled={soundSaving || !!soundUploading}
                onClick={async () => {
                  try {
                    setSoundSaving(true);
                    setSoundError(null);
                    const payload = {
                      attendance_success_sound_source: successSoundSource,
                      attendance_success_sound_sample_id: successSoundSampleId || null,
                      attendance_success_sound_url: successSoundUrl.trim() || null,
                      attendance_success_sound_text: successSoundText.trim() || null,
                      attendance_failure_sound_source: failureSoundSource,
                      attendance_failure_sound_sample_id: failureSoundSampleId || null,
                      attendance_failure_sound_url: failureSoundUrl.trim() || null,
                      attendance_failure_sound_text: failureSoundText.trim() || null
                    };
                    const cid = auth.roleKeys.includes("admin") ? (auth.selectedCompanyId ?? null) : null;
                    const updated = cid ? await updateCompany(cid, payload) : await updateMyCompany(payload);
                    setSuccessSoundSource((updated.attendance_success_sound_source ?? "default") as AttendanceSoundSource);
                    setSuccessSoundSampleId(updated.attendance_success_sound_sample_id ?? ATTENDANCE_SOUND_SAMPLE_OPTIONS[0].id);
                    setSuccessSoundUrl(updated.attendance_success_sound_url ?? "");
                    setSuccessSoundText(updated.attendance_success_sound_text ?? "Chấm công thành công");
                    setSuccessSoundDataUrl(updated.attendance_success_sound_data_url ?? null);
                    setFailureSoundSource((updated.attendance_failure_sound_source ?? "default") as AttendanceSoundSource);
                    setFailureSoundSampleId(updated.attendance_failure_sound_sample_id ?? "alert-buzz");
                    setFailureSoundUrl(updated.attendance_failure_sound_url ?? "");
                    setFailureSoundText(updated.attendance_failure_sound_text ?? "Chấm công thất bại, vui lòng thử lại");
                    setFailureSoundDataUrl(updated.attendance_failure_sound_data_url ?? null);
                  } catch (e) {
                    setSoundError(getApiErrorMessage(e));
                  } finally {
                    setSoundSaving(false);
                  }
                }}
              >
                {soundSaving ? "Đang lưu..." : <><SaveOutlined /> Lưu âm thanh</>}
              </button>
            }
          >
            {soundError ? <div className={styles.errorBox}>{soundError}</div> : null}

            <div className={styles.audioSoundGrid}>
              {([
                {
                  key: "success",
                  title: "Âm thanh thành công",
                  desc: "Phát khi chấm công vào/ra ca thành công.",
                  source: successSoundSource,
                  sampleId: successSoundSampleId,
                  url: successSoundUrl,
                  text: successSoundText,
                  dataUrl: successSoundDataUrl,
                  setSource: setSuccessSoundSource,
                  setSampleId: setSuccessSoundSampleId,
                  setUrl: setSuccessSoundUrl,
                  setText: setSuccessSoundText,
                  inputRef: successSoundInputRef
                },
                {
                  key: "failure",
                  title: "Âm thanh thất bại",
                  desc: "Phát khi chấm công lỗi hoặc bị từ chối.",
                  source: failureSoundSource,
                  sampleId: failureSoundSampleId,
                  url: failureSoundUrl,
                  text: failureSoundText,
                  dataUrl: failureSoundDataUrl,
                  setSource: setFailureSoundSource,
                  setSampleId: setFailureSoundSampleId,
                  setUrl: setFailureSoundUrl,
                  setText: setFailureSoundText,
                  inputRef: failureSoundInputRef
                }
              ] as const).map((sound) => (
                <div key={sound.key} className={styles.audioSoundCard}>
                  <div className={styles.audioSoundHead}>
                    <div>
                      <div className={styles.audioSoundTitle}>{sound.title}</div>
                      <div className={styles.audioSoundDesc}>{sound.desc}</div>
                    </div>
                    <button
                      className={styles.btnGhost}
                      type="button"
                      onClick={() => {
                        void previewAttendanceFeedback(
                          {
                            source: sound.source,
                            sampleId: sound.sampleId,
                            url: sound.url,
                            text: sound.text,
                            dataUrl: sound.dataUrl
                          },
                          sound.key
                        );
                      }}
                    >
                      Nghe thử
                    </button>
                  </div>

                  <div className={styles.form}>
                    <div className={styles.formRow}>
                      <div className={styles.formLabel}>Nguồn âm thanh</div>
                      <select className={styles.input} value={sound.source} onChange={(e) => sound.setSource(e.target.value as AttendanceSoundSource)}>
                        {ATTENDANCE_SOUND_SOURCE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {sound.source === "sample" ? (
                      <div className={styles.formRow}>
                        <div className={styles.formLabel}>Âm thanh mẫu</div>
                        <select className={styles.input} value={sound.sampleId} onChange={(e) => sound.setSampleId(e.target.value)}>
                          {ATTENDANCE_SOUND_SAMPLE_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    {sound.source === "url" ? (
                      <div className={styles.formRow}>
                        <div className={styles.formLabel}>URL âm thanh</div>
                        <input
                          className={styles.input}
                          value={sound.url}
                          onChange={(e) => sound.setUrl(e.target.value)}
                          placeholder="https://example.com/success.mp3"
                        />
                      </div>
                    ) : null}

                    {sound.source === "tts" ? (
                      <div className={styles.formRow}>
                        <div className={styles.formLabel}>Text để đọc</div>
                        <textarea
                          className={styles.input}
                          value={sound.text}
                          onChange={(e) => sound.setText(e.target.value)}
                          placeholder="Ví dụ: Chấm công thành công"
                          rows={3}
                        />
                      </div>
                    ) : null}

                    {sound.source === "upload" ? (
                      <div className={styles.formRow}>
                        <div className={styles.formLabel}>File công ty</div>
                        <div className={styles.audioUploadRow}>
                          <div className={styles.audioUploadStatus}>
                            {sound.dataUrl ? "Đã có file upload" : "Chưa có file upload"}
                          </div>
                          <button
                            className={styles.btnGhost}
                            type="button"
                            disabled={soundUploading === sound.key}
                            onClick={() => sound.inputRef.current?.click()}
                          >
                            {soundUploading === sound.key ? "Đang upload..." : "Tải âm thanh lên"}
                          </button>
                          <input
                            ref={sound.inputRef}
                            className={styles.hiddenInput}
                            type="file"
                            accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/aac,audio/webm"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                void handleAttendanceSoundPicked(sound.key, file);
                              }
                            }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className={styles.audioSoundFooter}>
                    <span className={styles.audioSourcePill}>
                      {sound.source === "default"
                        ? "Đang dùng mặc định toàn app"
                        : sound.source === "sample"
                          ? "Đang dùng preset mẫu"
                          : sound.source === "upload"
                            ? "Đang dùng file do công ty upload"
                            : sound.source === "url"
                              ? "Đang dùng URL ngoài"
                              : "Đang dùng text-to-speech tiếng Việt"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title={sectionTitle(<ApiOutlined />, "Trạng thái dịch vụ")} sub="Mock status">
            <div className={styles.statusList}>
              {mockSettings.services.map((s) => (
                <div key={s.name} className={styles.statusItem}>
                  <div className={styles.statusName}>{s.name}</div>
                  <div className={s.tone === "ok" ? `${styles.statusTag} ${styles.ok}` : `${styles.statusTag} ${styles.warn}`}>{viStatusLabel(s.status)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card/Card";
import { mockSettings } from "../../../shared/mock/mockData";
import { getAttendancePolicy, updateAttendancePolicy } from "../../../shared/api/settings";
import { getCompany, getMyCompany, updateCompany, updateMyCompany } from "../../../shared/api/companies";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import { useTheme } from "../../../shared/theme/theme";
import { useGeoPosition } from "../../../shared/hooks/useGeoPosition";
import { useNavigate } from "react-router-dom";
import styles from "./SettingsPage.module.scss";
import { useAuth } from "../../../shared/auth/auth";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { viStatusLabel } from "../../../shared/i18n/vi";

type LatLng = { lat: number; lng: number };
type NominatimResult = { display_name: string; lat: string; lon: string };

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
  label
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      className={checked ? `${styles.toggle} ${styles.toggleOn}` : styles.toggle}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    />
  );
}

export default function SettingsPage() {
  const nav = useNavigate();
  const auth = useAuth();
  const [company, setCompany] = useState<string>("");
  const [companyAddr, setCompanyAddr] = useState<string>("");
  const [companyLat, setCompanyLat] = useState<string>("");
  const [companyLng, setCompanyLng] = useState<string>("");
  const [companyRadius, setCompanyRadius] = useState<number>(250);
  const [companyRequireGps, setCompanyRequireGps] = useState(false);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
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

  const [notifLate, setNotifLate] = useState(true);
  const [notifAbsent, setNotifAbsent] = useState(true);
  const [notifNewLeave, setNotifNewLeave] = useState(true);
  const [notifDailyReport, setNotifDailyReport] = useState(false);
  const [notifOvertime, setNotifOvertime] = useState(true);

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
      } catch (e) {
        setCompanyError(getApiErrorMessage(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.selectedCompanyId, auth.roleKeys.join("|")]);

  useEffect(() => {
    ensureLeafletDefaultIcon();
  }, []);

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

  return (
    <div className={styles.page}>
      <div className={styles.grid2}>
        <div className={styles.col}>
          <Card title="⚙️ Cài đặt chung" sub="Tuỳ chỉnh hệ thống">
            <div className={styles.form}>
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
                <div style={{ color: "var(--text3)", fontSize: 12.5, fontWeight: 800, marginTop: 6 }}>
                  Khi bật: mỗi lần chấm công bắt buộc gửi vị trí GPS. Khi tắt: chấm công bỏ qua GPS và không áp dụng giới hạn bán kính.
                </div>
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

                  <div className={styles.mapHint}>
                    Chạm vào bản đồ để chọn vị trí công ty. Khi đã cấu hình GPS + bán kính, hệ thống chỉ cho chấm công nếu vị trí nhân viên nằm trong bán kính này.
                  </div>
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
                      if (cid) await updateCompany(cid, payload);
                      else await updateMyCompany(payload);
                    } catch (e) {
                      setCompanyError(getApiErrorMessage(e));
                    } finally {
                      setCompanySaving(false);
                    }
                  }}
                >
                  💾 Lưu vị trí công ty
                </button>
                {companyError ? <div style={{ marginLeft: 12, color: "var(--danger)", fontWeight: 800 }}>{companyError}</div> : null}
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.settingsList}>
              <div className={styles.settingsItem}>
                <div className={`${styles.settingsIcon} ${styles.iconInfo}`}>
                  🌍
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
                  🌙
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
                  📧
                </div>
                <div className={styles.settingsInfo}>
                  <div className={styles.settingsLabel}>Email thông báo</div>
                  <div className={styles.settingsDesc}>Gửi report hàng ngày</div>
                </div>
                <Toggle checked={dailyEmailReport} onChange={setDailyEmailReport} label="Email thông báo" />
              </div>

              <div className={styles.settingsItem}>
                <div className={`${styles.settingsIcon} ${styles.iconDanger}`}>
                  🔐
                </div>
                <div className={styles.settingsInfo}>
                  <div className={styles.settingsLabel}>Bảo mật 2 lớp</div>
                  <div className={styles.settingsDesc}>Xác thực 2 yếu tố</div>
                </div>
                <Toggle checked={twoFactor} onChange={setTwoFactor} label="Bảo mật 2 lớp" />
              </div>

              <button className={`${styles.settingsItem} ${styles.settingsClickable}`} type="button" onClick={() => nav("/change-password")}>
                <div className={`${styles.settingsIcon} ${styles.iconDanger}`}>🔒</div>
                <div className={styles.settingsInfo}>
                  <div className={styles.settingsLabel}>Đổi mật khẩu</div>
                  <div className={styles.settingsDesc}>Thay đổi mật khẩu đăng nhập</div>
                </div>
                <div className={styles.settingsArrow}>›</div>
              </button>
            </div>
          </Card>

          <Card title="📷 Cài đặt nhận diện khuôn mặt" sub="Ngưỡng + camera + chống giả mạo">
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
                  {policySaving ? "Đang lưu..." : "💾 Lưu cài đặt"}
                </button>
                <button className={styles.btnGhost} type="button" disabled={!policyLoadedOnce || policyLoading || policySaving}>
                  Khôi phục
                </button>
              </div>
            </div>
          </Card>
        </div>

        <div className={styles.col}>
          <Card title="⏰ Quy định giờ làm">
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
                {policySaving ? "Đang lưu..." : "💾 Lưu cài đặt"}
              </button>
            </div>
          </Card>

          <Card title="📱 Thông báo" sub="Bật/tắt các loại cảnh báo">
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
              <div className={`${styles.simpleRow} ${styles.simpleRowLast}`}>
                <div className={styles.simpleLabel}>Nhắc nhở tăng ca</div>
                <Toggle checked={notifOvertime} onChange={setNotifOvertime} label="Nhắc nhở tăng ca" />
              </div>
            </div>
          </Card>

          <Card title="🧪 Trạng thái dịch vụ" sub="Mock status">
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

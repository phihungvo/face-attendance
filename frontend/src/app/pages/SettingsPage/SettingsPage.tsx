import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card/Card";
import { mockSettings } from "../../../shared/mock/mockData";
import { getAttendancePolicy, updateAttendancePolicy } from "../../../shared/api/settings";
import { getMyCompany, updateMyCompany } from "../../../shared/api/companies";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import { useTheme } from "../../../shared/theme/theme";
import { useGeoPosition } from "../../../shared/hooks/useGeoPosition";
import { useNavigate } from "react-router-dom";
import styles from "./SettingsPage.module.scss";

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
  const [company, setCompany] = useState<string>("");
  const [companyAddr, setCompanyAddr] = useState<string>("");
  const [companyLat, setCompanyLat] = useState<string>("");
  const [companyLng, setCompanyLng] = useState<string>("");
  const [companyRadius, setCompanyRadius] = useState<number>(250);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
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
        const c = await getMyCompany();
        setCompany(c.name ?? "");
        setCompanyAddr((c as any).address ?? "");
        setCompanyLat((c as any).latitude != null ? String((c as any).latitude) : "");
        setCompanyLng((c as any).longitude != null ? String((c as any).longitude) : "");
        setCompanyRadius(Number((c as any).geo_radius_meters ?? 250));
      } catch (e) {
        setCompanyError(getApiErrorMessage(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              <div className={styles.formRow}>
                <div className={styles.formLabel}>Vị trí chấm công (GPS)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <input className={styles.input} value={companyLat} onChange={(e) => setCompanyLat(e.target.value)} placeholder="Latitude" />
                  <input className={styles.input} value={companyLng} onChange={(e) => setCompanyLng(e.target.value)} placeholder="Longitude" />
                </div>
                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 160px", gap: 10, alignItems: "center" }}>
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    value={companyRadius}
                    onChange={(e) => setCompanyRadius(Number(e.target.value))}
                    placeholder="Bán kính (m)"
                  />
                  <button className={styles.btnGhost} type="button" onClick={() => geo.refresh()}>
                    📍 Lấy vị trí
                  </button>
                </div>
                {geo.enabled ? (
                  <div style={{ marginTop: 8, color: "var(--text3)", fontWeight: 700, fontSize: 12.5 }}>
                    GPS hiện tại: {geo.latitude?.toFixed(6)}, {geo.longitude?.toFixed(6)} (±{Math.round(geo.accuracyMeters ?? 0)}m)
                    <button
                      type="button"
                      className={styles.btnLink}
                      style={{ marginLeft: 8 }}
                      onClick={() => {
                        setCompanyLat(String(geo.latitude ?? ""));
                        setCompanyLng(String(geo.longitude ?? ""));
                      }}
                    >
                      Dùng vị trí này
                    </button>
                  </div>
                ) : null}
                <div style={{ marginTop: 8, color: "var(--text3)", fontSize: 12.5 }}>
                  Khi đã cấu hình GPS + bán kính, hệ thống chỉ cho chấm công nếu vị trí nhân viên nằm trong bán kính này.
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
                      await updateMyCompany({
                        name: company.trim() || null,
                        address: companyAddr.trim() || null,
                        latitude: lat,
                        longitude: lng,
                        geo_radius_meters: Number.isFinite(companyRadius) ? companyRadius : 250
                      });
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
          <Card title="⏰ Quy định giờ làm" sub="Áp dụng cho chấm công khuôn mặt + báo cáo">
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
                  <div className={s.tone === "ok" ? `${styles.statusTag} ${styles.ok}` : `${styles.statusTag} ${styles.warn}`}>{s.status}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

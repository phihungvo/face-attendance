import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/auth/auth";
import styles from "./EmployeeProfilePage.module.scss";
import { useCamera } from "../../../shared/hooks/useCamera";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { enrollMyFace, getMyFaceStatus } from "../../../shared/api/enrollFace";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import { formatDateTimeVi } from "../../../shared/lib/date";
import { getMyProfile, updateMyProfile } from "../../../shared/api/users";
import { listMyTimelog } from "../../../shared/api/attendance";
import { useTheme } from "../../../shared/theme/theme";
import { getMyCompany, type Company } from "../../../shared/api/companies";
import {
  CalendarOutlined,
  BankOutlined,
  CameraOutlined,
  EditOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
  LockOutlined,
  LogoutOutlined,
  MailOutlined,
  MoonOutlined,
  PhoneOutlined,
  SafetyOutlined,
  StopOutlined,
  SunOutlined,
  SwapOutlined,
  UserOutlined
} from "@ant-design/icons";
import { useCachedQuery } from "../../../shared/hooks/useCachedQuery";
import { invalidateKey } from "../../../shared/lib/queryCache";
import { empKeys } from "../../cacheKeys";

type DetailItem = {
  key: string;
  label: string;
  value: string;
  icon: ReactNode;
  tone: "indigo" | "green" | "amber" | "rose";
};

export default function EmployeeProfilePage() {
  const auth = useAuth();
  const nav = useNavigate();
  const cam = useCamera();
  const { resolvedTheme, toggle } = useTheme();
  const [busy, setBusy] = useState(false);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [faceInfo, setFaceInfo] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileInfo, setProfileInfo] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileCitizenId, setProfileCitizenId] = useState("");
  const [profileCitizenIdPlace, setProfileCitizenIdPlace] = useState("");
  const [monthDays, setMonthDays] = useState<number | null>(null);
  const [attendancePct, setAttendancePct] = useState<number | null>(null);
  const [expLabel, setExpLabel] = useState<string>("—");

  const qMe = useCachedQuery({
    key: empKeys.meProfile(),
    ttlMs: 5 * 60_000,
    fetcher: getMyProfile
  });
  const me = qMe.data;

  const qCompany = useCachedQuery<Company>({
    key: empKeys.myCompany(),
    ttlMs: 5 * 60_000,
    fetcher: getMyCompany
  });
  const company = qCompany.data;

  const qFace = useCachedQuery({
    key: empKeys.myFaceStatus(),
    ttlMs: 60_000,
    fetcher: getMyFaceStatus
  });
  const lastFace = qFace.data?.last_enrolled_at ?? null;

  const initials = (me?.name || auth.username || "ME")
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  useEffect(() => {
    const expSource = me?.hire_date ? `${me.hire_date}T00:00:00` : me?.created_at;
    if (!expSource) return;
    const created = new Date(expSource);
    const now = new Date();
    const months = Math.max(0, (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth()));
    const years = Math.floor(months / 12);
    setExpLabel(years > 0 ? `${years} năm` : `${months} tháng`);
  }, [me?.created_at, me?.hire_date]);

  const now = useMemo(() => new Date(), []);
  const ym = useMemo(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, [now]);
  const qMonth = useCachedQuery({
    key: empKeys.myTimelogMonth(ym),
    ttlMs: 60_000,
    fetcher: async () => {
      const from = `${ym}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const to = `${ym}-${String(lastDay).padStart(2, "0")}`;
      return listMyTimelog({ from_date: from, to_date: to });
    }
  });

  useEffect(() => {
    const rows = qMonth.data ?? null;
    if (!rows) return;
    const present = rows.filter((r: any) => !r.absent).length;
    const total = rows.length || 0;
    setMonthDays(present);
    setAttendancePct(total > 0 ? Math.round((present / total) * 100) : null);
  }, [qMonth.data]);

  const companyLogo = company?.logo_data_url ?? auth.companyLogoDataUrl ?? null;
  const companyName = company?.name || auth.companyName || "Công ty của bạn";
  const faceStatusText = lastFace ? `Đã cập nhật ${formatDateTimeVi(new Date(lastFace))}` : "Chưa đăng ký khuôn mặt";
  const faceReady = Boolean(lastFace);
  const faceToneClass = faceReady ? styles.good : styles.warn;

  useEffect(() => {
    if (!me || editingProfile) return;
    setProfileName(me.name || "");
    setProfileEmail(me.email || "");
    setProfilePhone(me.phone || "");
    setProfileAddress(me.address || "");
    setProfileCitizenId(me.citizen_id || "");
    setProfileCitizenIdPlace(me.citizen_id_place || "");
  }, [editingProfile, me]);

  const details = useMemo<DetailItem[]>(
    () => [
      {
        key: "email",
        label: "Email",
        value: me?.email || "Chưa cập nhật",
        icon: <MailOutlined />,
        tone: "indigo"
      },
      {
        key: "phone",
        label: "Điện thoại",
        value: me?.phone || "Chưa cập nhật",
        icon: <PhoneOutlined />,
        tone: "green"
      },
      {
        key: "address",
        label: "Địa chỉ",
        value: me?.address || "Chưa cập nhật",
        icon: <EnvironmentOutlined />,
        tone: "amber"
      },
      {
        key: "code",
        label: "Mã nhân viên",
        value: me?.code || "Chưa cấp mã",
        icon: <IdcardOutlined />,
        tone: "rose"
      },
      {
        key: "citizen_id",
        label: "CCCD",
        value: me?.citizen_id || "Chưa cập nhật",
        icon: <IdcardOutlined />,
        tone: "amber"
      },
      {
        key: "citizen_id_place",
        label: "Nơi cấp CCCD",
        value: me?.citizen_id_place || "Chưa cập nhật",
        icon: <EnvironmentOutlined />,
        tone: "rose"
      },
      {
        key: "department",
        label: "Phòng ban",
        value: me?.department_name || "Chưa gắn phòng ban",
        icon: <BankOutlined />,
        tone: "indigo"
      },
      {
        key: "hire_date",
        label: "Ngày vào làm",
        value: me?.hire_date ? formatDateTimeVi(new Date(`${me.hire_date}T00:00:00`), { dateOnly: true }) : "Chưa cập nhật",
        icon: <CalendarOutlined />,
        tone: "green"
      },
      {
        key: "account",
        label: "Tài khoản",
        value: auth.username ?? "—",
        icon: <UserOutlined />,
        tone: "amber"
      },
      {
        key: "permissions",
        label: "Quyền truy cập",
        value: `${auth.permissionKeys.length} quyền`,
        icon: <SafetyOutlined />,
        tone: "rose"
      }
    ],
    [auth.permissionKeys.length, auth.username, me?.address, me?.citizen_id, me?.citizen_id_place, me?.code, me?.department_name, me?.email, me?.hire_date, me?.phone]
  );

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.heroIdentity}>
            <div className={styles.avatar}>{initials || "ME"}</div>
            <div className={styles.heroText}>
              <h1 className={styles.heroName}>{me?.name || auth.username || "—"}</h1>
              <div className={styles.heroSub}>
                <span>{me?.department_name || "Nhân viên"}</span>
                <span>{me?.code ? `Mã ${me.code}` : "Chưa cấp mã"}</span>
              </div>
            </div>
          </div>

          <div className={styles.heroCompany}>
            {companyLogo ? (
              <div className={styles.companyLogoWrap}>
                <img className={styles.companyLogo} src={companyLogo} alt={companyName} />
              </div>
            ) : (
              <div className={styles.companyFallback}>{companyName.trim().slice(0, 1).toUpperCase() || "C"}</div>
            )}
            <div className={styles.heroCompanyText}>
              <div className={styles.heroCompanyLabel}>Công ty</div>
              <div className={styles.heroCompanyName}>{companyName}</div>
            </div>
          </div>
        </div>

        <div className={styles.heroMetrics}>
          <div className={styles.metricPrimary}>
            <span className={styles.metricLabel}>Chuyên cần</span>
            <strong className={styles.metricValue}>{attendancePct !== null ? `${attendancePct}%` : "—"}</strong>
          </div>

          <div className={styles.metricPair}>
            <div className={styles.metricSecondary}>
              <span className={styles.metricLabel}>Ngày công</span>
              <strong className={styles.metricSmallValue}>{monthDays !== null ? monthDays : "—"}</strong>
            </div>
            <div className={styles.metricSecondary}>
              <span className={styles.metricLabel}>Kinh nghiệm</span>
              <strong className={styles.metricSmallValue}>{expLabel}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.content}>
        <section className={styles.panel}>
          <div className={styles.sectionHead}>
            <div>
              <div className={styles.sectionEyebrow}>Thông tin chính</div>
            </div>
            <button
              className={styles.secondaryBtn}
              type="button"
              disabled={!me || profileSaving}
              onClick={() => {
                setProfileError(null);
                setProfileInfo(null);
                setEditingProfile((v) => !v);
              }}
            >
              <EditOutlined /> {editingProfile ? "Đóng chỉnh sửa" : "Cập nhật thông tin"}
            </button>
          </div>

          <div className={styles.detailGrid}>
            {details.map((item) => (
              <div className={styles.detailCard} key={item.key}>
                <div className={`${styles.detailIcon} ${styles[item.tone]}`}>{item.icon}</div>
                <div className={styles.detailBody}>
                  <div className={styles.detailLabel}>{item.label}</div>
                  <div className={styles.detailValue}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>

          {editingProfile ? (
            <div className={styles.profileEditor}>
              {profileError ? <div className={`${styles.notice} ${styles.danger}`}>{profileError}</div> : null}
              {profileInfo ? <div className={`${styles.notice} ${styles.good}`}>{profileInfo}</div> : null}

              <div className={styles.editorGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Họ và tên</span>
                  <input className={styles.fieldInput} value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Nguyễn Văn A" />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Email</span>
                  <input className={styles.fieldInput} value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} placeholder="email@company.vn" />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Điện thoại</span>
                  <input className={styles.fieldInput} value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="0912 345 678" />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>CCCD</span>
                  <input className={styles.fieldInput} value={profileCitizenId} onChange={(e) => setProfileCitizenId(e.target.value)} placeholder="079203001234" />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Nơi cấp CCCD</span>
                  <input className={styles.fieldInput} value={profileCitizenIdPlace} onChange={(e) => setProfileCitizenIdPlace(e.target.value)} placeholder="Cục CSQLHC về TTXH" />
                </label>

                <label className={`${styles.field} ${styles.fieldFull}`}>
                  <span className={styles.fieldLabel}>Địa chỉ</span>
                  <textarea
                    className={`${styles.fieldInput} ${styles.fieldTextarea}`}
                    value={profileAddress}
                    onChange={(e) => setProfileAddress(e.target.value)}
                    placeholder="Quận 1, TP.HCM"
                    rows={3}
                  />
                </label>
              </div>

              <div className={styles.editorNote}>Những thông tin như mã nhân viên, phòng ban, ngày vào làm, chức vụ do công ty quản lý.</div>

              <div className={styles.editorActions}>
                <button
                  className={styles.secondaryBtn}
                  type="button"
                  disabled={profileSaving}
                  onClick={() => {
                    setEditingProfile(false);
                    setProfileError(null);
                    setProfileInfo(null);
                  }}
                >
                  Hủy
                </button>
                <button
                  className={styles.primaryBtn}
                  type="button"
                  disabled={profileSaving || !profileName.trim()}
                  onClick={async () => {
                    try {
                      setProfileSaving(true);
                      setProfileError(null);
                      setProfileInfo(null);
                      await updateMyProfile({
                        name: profileName.trim(),
                        email: profileEmail.trim() || null,
                        phone: profilePhone.trim() || null,
                        address: profileAddress.trim() || null,
                        citizen_id: profileCitizenId.trim() || null,
                        citizen_id_place: profileCitizenIdPlace.trim() || null
                      });
                      invalidateKey(empKeys.meProfile());
                      qMe.refresh();
                      await auth.refreshMe().catch(() => undefined);
                      setProfileInfo("Đã cập nhật hồ sơ");
                      setEditingProfile(false);
                    } catch (e) {
                      setProfileError(getApiErrorMessage(e));
                    } finally {
                      setProfileSaving(false);
                    }
                  }}
                >
                  {profileSaving ? "Đang lưu..." : "Lưu thông tin"}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <div className={styles.columns}>
          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <div>
                <div className={styles.sectionEyebrow}>Bảo mật và giao diện</div>
              </div>
            </div>

            <div className={styles.actionList}>
              <button className={styles.actionRow} type="button" onClick={toggle} aria-label="Đổi giao diện sáng/tối">
                <div className={`${styles.actionIcon} ${styles.indigo}`}>{resolvedTheme === "dark" ? <MoonOutlined /> : <SunOutlined />}</div>
                <div className={styles.actionText}>
                  <div className={styles.actionTitle}>Giao diện</div>
                  <div className={styles.actionSub}>{resolvedTheme === "dark" ? "Đang tối" : "Đang sáng"}</div>
                </div>
              </button>

              <button className={styles.actionRow} type="button" onClick={() => nav("/employee/change-password")}>
                <div className={`${styles.actionIcon} ${styles.amber}`}>
                  <LockOutlined />
                </div>
                <div className={styles.actionText}>
                  <div className={styles.actionTitle}>Đổi mật khẩu</div>
                  <div className={styles.actionSub}>Cập nhật bảo mật tài khoản</div>
                </div>
              </button>

              <button
                className={`${styles.actionRow} ${styles.actionDanger}`}
                type="button"
                onClick={() => {
                  auth.logout();
                  nav("/", { replace: true });
                }}
              >
                <div className={`${styles.actionIcon} ${styles.rose}`}>
                  <LogoutOutlined />
                </div>
                <div className={styles.actionText}>
                  <div className={styles.actionTitle}>Đăng xuất</div>
                  <div className={styles.actionSub}>Thoát khỏi tài khoản hiện tại</div>
                </div>
              </button>
            </div>
          </section>

          <section className={styles.panel} id="face-section">
            <div className={styles.sectionHead}>
              <div>
                <div className={styles.sectionEyebrow}>Sinh trắc học</div>
              </div>
              <div className={`${styles.statusChip} ${faceToneClass}`}>{faceStatusText}</div>
            </div>

            <div className={styles.faceCard}>
              <div className={styles.faceCamera}>
                {!cam.state.ready ? (
                  <div className={styles.facePlaceholder}>
                    <CameraOutlined />
                    <span>Camera chưa bật</span>
                  </div>
                ) : null}
                <video ref={cam.videoRef} className={styles.faceVideo} playsInline muted />
              </div>

              <div className={styles.faceControls}>
                {cam.state.error ? <div className={`${styles.notice} ${styles.warn}`}>{cam.state.error}</div> : null}
                {faceError ? <div className={`${styles.notice} ${styles.danger}`}>{faceError}</div> : null}
                {faceInfo ? <div className={`${styles.notice} ${styles.good}`}>{faceInfo}</div> : null}

                <div className={styles.faceButtons}>
                  {!cam.state.ready ? (
                    <button className={styles.primaryBtn} type="button" disabled={busy} onClick={() => cam.start()}>
                      <CameraOutlined /> Bật camera
                    </button>
                  ) : (
                    <button
                      className={styles.primaryBtn}
                      type="button"
                      disabled={!cam.state.ready || busy}
                      onClick={async () => {
                        try {
                          setBusy(true);
                          setFaceError(null);
                          setFaceInfo(null);
                          const blob = await cam.capture({ quality: 0.9, type: "image/jpeg" });
                          await enrollMyFace(blob);
                          setFaceInfo("Đã lưu khuôn mặt thành công");
                          invalidateKey(empKeys.myFaceStatus());
                          qFace.refresh();
                        } catch (e) {
                          setFaceError(getApiErrorMessage(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {busy ? "Đang lưu..." : "Lưu khuôn mặt"}
                    </button>
                  )}
                  <button className={styles.secondaryBtn} type="button" disabled={!cam.state.ready || busy} onClick={() => cam.switchCamera()}>
                    <SwapOutlined /> Đổi camera
                  </button>
                  <button className={styles.secondaryBtn} type="button" disabled={!cam.state.ready || busy} onClick={() => cam.stop()}>
                    <StopOutlined /> Tắt camera
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

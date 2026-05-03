import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/auth/auth";
import styles from "./EmployeeProfilePage.module.scss";
import { employeeMock } from "../../mock/employeeMock";
import { useCamera } from "../../../shared/hooks/useCamera";
import { useEffect, useState } from "react";
import { enrollMyFace, getMyFaceStatus } from "../../../shared/api/enrollFace";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";

export default function EmployeeProfilePage() {
  const auth = useAuth();
  const nav = useNavigate();
  const cam = useCamera();
  const [busy, setBusy] = useState(false);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [faceInfo, setFaceInfo] = useState<string | null>(null);
  const [lastFace, setLastFace] = useState<string | null>(null);
  const [nextAllowed, setNextAllowed] = useState<string | null>(null);
  const me = employeeMock.me;
  const initials = me.name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  useEffect(() => {
    (async () => {
      try {
        const st = await getMyFaceStatus();
        setLastFace(st.last_enrolled_at);
        setNextAllowed(st.next_allowed_at);
      } catch {
        // ignore - employee profile can still render
      }
    })();
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.profileHeader}>
        <div className={styles.profileAvatar}>{initials || "ME"}</div>
        <div className={styles.profileName}>{me.name}</div>
        <div className={styles.profileRole}>Nhân viên · {me.dept}</div>
        <div className={styles.profileId}>Mã NV: {me.code}</div>
      </div>

      <div className={styles.profileStats}>
        <div className={styles.profileStat}>
          <div className={styles.profileStatVal} style={{ color: "var(--indigo)" }}>
            98%
          </div>
          <div className={styles.profileStatLbl}>Chuyên cần</div>
        </div>
        <div className={styles.profileStat}>
          <div className={styles.profileStatVal} style={{ color: "var(--green)" }}>
            22
          </div>
          <div className={styles.profileStatLbl}>Ngày công</div>
        </div>
        <div className={styles.profileStat}>
          <div className={styles.profileStatVal} style={{ color: "var(--amber)" }}>
            3 năm
          </div>
          <div className={styles.profileStatLbl}>Kinh nghiệm</div>
        </div>
      </div>

      <div className={styles.profileScroll}>
        <div className={styles.profileSection}>
          <div className={styles.profileSectionTitle}>Thông tin tài khoản</div>
          <div className={styles.profileRow}>
            <div className={styles.profileItem}>
              <div className={styles.profileItemIcon} style={{ background: "var(--indigo-light)" }}>
                👤
              </div>
              <div>
                <div className={styles.profileItemKey}>Username</div>
                <div className={styles.profileItemVal}>{auth.username ?? "—"}</div>
              </div>
              <div className={styles.profileItemArrow}>›</div>
            </div>
            <div className={styles.profileItem}>
              <div className={styles.profileItemIcon} style={{ background: "var(--amber-light)" }}>
                🛡️
              </div>
              <div>
                <div className={styles.profileItemKey}>Roles</div>
                <div className={styles.profileItemVal}>{auth.roleKeys.join(", ") || "—"}</div>
              </div>
              <div className={styles.profileItemArrow}>›</div>
            </div>
            <div className={styles.profileItem}>
              <div className={styles.profileItemIcon} style={{ background: "var(--green-light)" }}>
                ✅
              </div>
              <div>
                <div className={styles.profileItemKey}>Quyền</div>
                <div className={styles.profileItemVal}>{auth.permissionKeys.length} permissions</div>
              </div>
              <div className={styles.profileItemArrow}>›</div>
            </div>
          </div>
        </div>

        <div className={styles.profileSection}>
        <div className={styles.profileSectionTitle}>Cài đặt & Bảo mật</div>
        <div className={styles.profileRow}>
            <div className={styles.profileItem}>
              <div className={styles.profileItemIcon} style={{ background: "var(--indigo-light)" }}>
                🤳
              </div>
              <div>
                <div className={styles.profileItemKey}>Khuôn mặt đã đăng ký</div>
                <div className={styles.profileItemVal}>
                  {lastFace ? `Cập nhật lần cuối: ${new Date(lastFace).toLocaleString("vi-VN")}` : "Chưa đăng ký"}
                  {nextAllowed ? ` • Có thể đăng ký lại sau: ${new Date(nextAllowed).toLocaleString("vi-VN")}` : ""}
                </div>
              </div>
              <div className={styles.profileItemArrow}>›</div>
            </div>
            <div className={`${styles.profileItem} ${styles.clickable}`} onClick={() => window.alert("Chức năng đổi mật khẩu sẽ được nối API sau.")}>
              <div className={styles.profileItemIcon} style={{ background: "#FFE9E9" }}>
                🔒
              </div>
              <div>
                <div className={styles.profileItemKey}>Đổi mật khẩu</div>
                <div className={styles.profileItemVal} style={{ color: "var(--indigo)" }}>
                  Thay đổi
                </div>
              </div>
              <div className={styles.profileItemArrow}>›</div>
            </div>
            <div
              className={`${styles.profileItem} ${styles.clickable}`}
              onClick={() => {
                auth.logout();
                nav("/", { replace: true });
              }}
            >
              <div className={styles.profileItemIcon} style={{ background: "#FFE9E9" }}>
                🚪
              </div>
              <div>
                <div className={styles.profileItemKey}>Đăng xuất</div>
                <div className={styles.profileItemVal} style={{ color: "var(--rose)" }}>
                  Thoát khỏi tài khoản
                </div>
              </div>
              <div className={styles.profileItemArrow}>›</div>
            </div>
          </div>
        </div>

        <div className={styles.profileSection}>
          <div className={styles.profileSectionTitle}>Đăng ký khuôn mặt</div>
          <div className={styles.faceCard}>
            <div className={styles.faceCamera}>
              {!cam.state.ready ? <div className={styles.facePlaceholder}>📷 Camera chưa bật</div> : null}
              <video ref={cam.videoRef} className={styles.faceVideo} playsInline muted />
            </div>

            {cam.state.error ? <div className={styles.faceWarn}>{cam.state.error}</div> : null}
            {faceError ? <div className={styles.faceErr}>{faceError}</div> : null}
            {faceInfo ? <div className={styles.faceInfo}>{faceInfo}</div> : null}

            <div className={styles.faceActions}>
              {!cam.state.ready ? (
                <button className={styles.faceBtnPrimary} type="button" disabled={busy} onClick={() => cam.start()}>
                  📷 Bật camera
                </button>
              ) : (
                <button
                  className={styles.faceBtnPrimary}
                  type="button"
                  disabled={!cam.state.ready || busy}
                  onClick={async () => {
                    try {
                      setBusy(true);
                      setFaceError(null);
                      setFaceInfo(null);
                      const blob = await cam.capture({ quality: 0.9, type: "image/jpeg" });
                      const res = await enrollMyFace(blob);
                      setFaceInfo("✅ Đăng ký khuôn mặt thành công");
                      const st = await getMyFaceStatus();
                      setLastFace(st.last_enrolled_at);
                      setNextAllowed(st.next_allowed_at);
                      return res;
                    } catch (e) {
                      setFaceError(getApiErrorMessage(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Đang đăng ký..." : "✅ Đăng ký / Cập nhật"}
                </button>
              )}
              <button className={styles.faceBtnGhost} type="button" disabled={!cam.state.ready || busy} onClick={() => cam.switchCamera()}>
                🔄 Đổi camera
              </button>
              <button className={styles.faceBtnGhost} type="button" disabled={!cam.state.ready || busy} onClick={() => cam.stop()}>
                ⏹ Tắt camera
              </button>
            </div>
            <div className={styles.faceHint}>Giới hạn: mỗi tài khoản chỉ được đăng ký khuôn mặt 1 lần / tháng.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

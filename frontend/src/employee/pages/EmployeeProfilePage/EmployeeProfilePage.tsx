import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/auth/auth";
import styles from "./EmployeeProfilePage.module.scss";
import { employeeMock } from "../../mock/employeeMock";

export default function EmployeeProfilePage() {
  const auth = useAuth();
  const nav = useNavigate();
  const me = employeeMock.me;
  const initials = me.name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

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
                <div className={styles.profileItemVal}>Cập nhật lần cuối: {employeeMock.leaveBalance.faceLastUpdated}</div>
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
      </div>
    </div>
  );
}

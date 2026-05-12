import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./ChangePasswordPage.module.scss";
import { changeMyPassword } from "../../../shared/api/auth";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";

export default function ChangePasswordPage() {
  const nav = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const disabled = useMemo(() => {
    if (loading) return true;
    if (currentPassword.length < 6) return true;
    if (newPassword.length < 6) return true;
    if (newPassword !== newPassword2) return true;
    return false;
  }, [loading, currentPassword, newPassword, newPassword2]);

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.h1}>🔒 Đổi mật khẩu</div>
        <div className={styles.muted}>Áp dụng cho tài khoản đang đăng nhập (Admin/Quản lý).</div>

        <label className={styles.label}>Mật khẩu hiện tại</label>
        <input className={styles.input} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />

        <label className={styles.label}>Mật khẩu mới</label>
        <input className={styles.input} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />

        <label className={styles.label}>Nhập lại mật khẩu mới</label>
        <input className={styles.input} type="password" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} />

        {err ? <div className={styles.error}>{err}</div> : null}
        {ok ? <div className={styles.ok}>{ok}</div> : null}

        <div className={styles.row}>
          <button className={styles.btnGhost} type="button" onClick={() => nav(-1)} disabled={loading}>
            ← Quay lại
          </button>
          <button
            className={styles.btnPrimary}
            type="button"
            disabled={disabled}
            onClick={async () => {
              try {
                setLoading(true);
                setErr(null);
                setOk(null);
                await changeMyPassword({ current_password: currentPassword, new_password: newPassword });
                setCurrentPassword("");
                setNewPassword("");
                setNewPassword2("");
                setOk("✅ Đổi mật khẩu thành công");
              } catch (e) {
                setErr(getApiErrorMessage(e));
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "Đang đổi..." : "Đổi mật khẩu"}
          </button>
        </div>
      </div>
    </div>
  );
}

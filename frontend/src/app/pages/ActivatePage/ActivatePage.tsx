import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, formatAuthError } from "../../../shared/auth/auth";
import styles from "./ActivatePage.module.scss";

export default function ActivatePage() {
  const auth = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = useMemo(() => {
    if (!token.trim()) return true;
    if (password.length < 6) return true;
    if (password !== password2) return true;
    return loading;
  }, [loading, password, password2, token]);

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.h1}>Kích hoạt tài khoản</h1>
        <div className={styles.muted}>Tạo mật khẩu để hoàn tất kích hoạt. Link có thể hết hạn sau một thời gian.</div>
        {error ? <div className={styles.error}>{error}</div> : null}

        <label className={styles.label}>Mật khẩu mới</label>
        <input className={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <label className={styles.label}>Nhập lại mật khẩu</label>
        <input className={styles.input} type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} />

        <button
          className={styles.primaryBtn}
          disabled={disabled}
          onClick={async () => {
            try {
              setLoading(true);
              setError(null);
              await auth.acceptInvite(token, password);
              nav("/", { replace: true });
            } catch (e) {
              setError(formatAuthError(e));
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Đang kích hoạt..." : "Kích hoạt"}
        </button>
      </div>
    </div>
  );
}


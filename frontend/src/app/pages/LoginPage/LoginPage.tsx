import { useMemo, useState } from "react";
import { useAuth } from "../../../shared/auth/auth";
import { formatAuthError } from "../../../shared/auth/auth";
import styles from "./LoginPage.module.scss";

export default function LoginPage() {
  const auth = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => (mode === "login" ? "Đăng nhập" : "Tạo tài khoản"), [mode]);

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>🎯</div>
          <div>
            <div className={styles.brandTitle}>FaceTime HR</div>
            <div className={styles.brandSub}>Hệ thống chấm công thông minh</div>
          </div>
        </div>

        <h1 className={styles.h1}>{title}</h1>
        {error ? <div className={styles.error}>{error}</div> : null}

        <label className={styles.label}>Username</label>
        <input className={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} />
        <label className={styles.label}>Password</label>
        <input className={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <button
          className={styles.primaryBtn}
          disabled={loading}
          onClick={async () => {
            try {
              setLoading(true);
              setError(null);
              if (mode === "login") await auth.login(username, password);
              else await auth.register(username, password);
            } catch (e) {
              setError(formatAuthError(e));
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
        </button>

        <button className={styles.secondaryBtn} type="button" onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}>
          {mode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
        </button>
      </div>
    </div>
  );
}

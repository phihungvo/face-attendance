import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/auth/auth";
import { formatAuthError } from "../../../shared/auth/auth";
import styles from "./LoginPage.module.scss";

export default function LoginPage() {
  const auth = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [role, setRole] = useState<"employee" | "manager">("employee");
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
              else await auth.register(username, password, role);
              nav("/", { replace: true });
            } catch (e) {
              setError(formatAuthError(e));
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
        </button>

        {mode === "register" ? (
          <div className={styles.formRow}>
            <div className={styles.formLabel}>Role</div>
            <select className={styles.select} value={role} onChange={(e) => setRole(e.target.value as "employee" | "manager")} aria-label="Role">
              <option value="employee">Nhân viên</option>
              <option value="manager">Quản lý</option>
            </select>
          </div>
        ) : null}

        <button className={styles.secondaryBtn} type="button" onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}>
          {mode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
        </button>
      </div>
    </div>
  );
}

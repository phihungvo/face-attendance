import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatAuthError, useAuth } from "../../../shared/auth/auth";
import { api, type ApiResponse } from "../../../shared/lib/apiClient";
import styles from "./LoginPage.module.scss";

type AuthConfig = {
  public_registration_enabled: boolean;
  account_onboarding_mode: "company_invite" | "public_register";
};

export default function LoginPage() {
  const auth = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [publicRegistrationEnabled, setPublicRegistrationEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ApiResponse<AuthConfig>>("/auth/config")
      .then((res) => {
        if (cancelled) return;
        setPublicRegistrationEnabled(Boolean(res.data.result?.public_registration_enabled));
      })
      .catch(() => {
        if (!cancelled) setPublicRegistrationEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!publicRegistrationEnabled && mode === "register") {
      setMode("login");
    }
  }, [mode, publicRegistrationEnabled]);

  const title = useMemo(() => (mode === "login" ? "Đăng nhập" : "Tạo tài khoản"), [mode]);

  function switchMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError(null);
    if (nextMode === "register") {
      setIdentifier("");
      setPassword("");
    } else if (!identifier.trim() && !password.trim()) {
      setIdentifier("admin");
      setPassword("admin123");
    }
  }

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

        <label className={styles.label}>{mode === "login" ? "Tài khoản (username/email/mã NV)" : "Tên đăng nhập mới"}</label>
        <input
          className={styles.input}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={mode === "login" ? "Nhập tài khoản" : "Ví dụ: nguyenvana"}
        />
        <label className={styles.label}>Mật khẩu</label>
        <input className={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tối thiểu 8 ký tự" />

        <button
          className={styles.primaryBtn}
          disabled={loading}
          onClick={async () => {
            try {
              setLoading(true);
              setError(null);
              if (mode === "login") await auth.login(identifier, password);
              else await auth.register(identifier, password);
              sessionStorage.setItem("dashboard:intro", "login");
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

        {publicRegistrationEnabled ? (
          <button className={styles.secondaryBtn} type="button" onClick={() => switchMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
          </button>
        ) : (
          <div className={styles.notice}>
            <div className={styles.noticeTitle}>Tài khoản do công ty cấp</div>
            <div>Nhân viên mới cần được quản lý tạo hồ sơ và gửi link kích hoạt qua email.</div>
          </div>
        )}
      </div>
    </div>
  );
}

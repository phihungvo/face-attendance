import { useState } from "react";
import { formatAuthError, useAuth } from "../auth";

export default function LoginPage() {
  const auth = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!username.trim() || !password) {
      setError("Vui lòng nhập tên đăng nhập và mật khẩu");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") await auth.login(username.trim(), password);
      else await auth.register(username.trim(), password);
    } catch (e) {
      setError(formatAuthError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 420, margin: "0 auto" }}>
      <h1>{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</h1>
      {error ? <div className="alert error">{error}</div> : null}

      <div className="card">
        <div className="formRow">
          <label className="label">Tên đăng nhập</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </div>
        <div className="formRow">
          <label className="label">Mật khẩu</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>

        <button className="btn" onClick={submit} disabled={loading}>
          {loading ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Đăng ký"}
        </button>

        <div className="muted" style={{ marginTop: 10 }}>
          {mode === "login" ? (
            <>
              Chưa có tài khoản?{" "}
              <button className="linkBtn" onClick={() => setMode("register")}>
                Đăng ký
              </button>
            </>
          ) : (
            <>
              Đã có tài khoản?{" "}
              <button className="linkBtn" onClick={() => setMode("login")}>
                Đăng nhập
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


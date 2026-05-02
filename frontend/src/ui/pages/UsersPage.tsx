import { useEffect, useState } from "react";
import { api, ApiResponse, getApiErrorMessage } from "../apiClient";

type User = { id: number; name: string; created_at: string };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadUsers() {
    const res = await api.get<ApiResponse<User[]>>("/users");
    setUsers(res.data.result ?? []);
  }

  useEffect(() => {
    loadUsers().catch(() => setError("Failed to load users"));
  }, []);

  async function enroll() {
    if (!name.trim() || !file) {
      setError("Vui lòng nhập tên và chọn ảnh khuôn mặt");
      return;
    }
    try {
      setError(null);
      setStatus(null);
      const form = new FormData();
      form.append("name", name.trim());
      form.append("image", file);
      const res = await api.post<ApiResponse<{ user_id: number; status: string }>>("/users/enroll", form, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const userId = res.data.result?.user_id;
      setStatus(userId ? `Đăng ký thành công (user_id=${userId})` : "Đăng ký thành công");
      setName("");
      setFile(null);
      await loadUsers();
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    }
  }

  return (
    <div className="page">
      <h1>Users</h1>
      {error ? <div className="alert error">{error}</div> : null}
      {status ? <div className="alert ok">{status}</div> : null}

      <div className="card">
        <div className="cardTitle">Enroll New User</div>
        <div className="formRow">
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nguyen Van A" />
        </div>
        <div className="formRow">
          <label className="label">Face Image</label>
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <button className="btn" onClick={enroll}>
          Enroll
        </button>
        <div className="muted" style={{ marginTop: 8 }}>
          Gợi ý: dùng ảnh rõ mặt, nhìn thẳng để độ chính xác tốt hơn.
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="cardTitle">User List</div>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.name}</td>
                <td>{new Date(u.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 ? <div className="muted">No users yet.</div> : null}
      </div>
    </div>
  );
}

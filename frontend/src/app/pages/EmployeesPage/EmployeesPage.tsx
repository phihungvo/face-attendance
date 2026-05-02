import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card/Card";
import StatCard from "../../components/StatCard/StatCard";
import Table from "../../components/Table/Table";
import Modal from "../../components/Modal/Modal";
import { createUser, deleteUser, listUsers, updateUser } from "../../../shared/api/users";
import { listDepartments } from "../../../shared/api/departments";
import { enrollFaceForUser } from "../../../shared/api/enrollFace";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import type { User } from "../../../shared/types/user";
import type { Department } from "../../../shared/types/department";
import { useCamera } from "../../../shared/hooks/useCamera";
import styles from "./EmployeesPage.module.scss";

export default function EmployeesPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [faceModalOpen, setFaceModalOpen] = useState(false);
  const [faceUser, setFaceUser] = useState<User | null>(null);
  const cam = useCamera();

  async function refresh(q?: string) {
    try {
      setLoading(true);
      setError(null);
      const data = await listUsers({ q: q?.trim() || undefined, limit: 200, offset: 0 });
      setUsers(data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    (async () => {
      try {
        const depts = await listDepartments({ limit: 500, offset: 0 });
        setDepartments(depts);
      } catch {
        // ignore - employees CRUD still works without dept labels
      }
    })();
  }, []);

  const deptById = useMemo(() => {
    const m = new Map<number, Department>();
    for (const d of departments) m.set(d.id, d);
    return m;
  }, [departments]);

  const stats = useMemo(() => {
    return [
      { icon: "👥", label: "Tổng nhân viên", value: users.length, delta: { label: "DB", tone: "neutral" as const } },
      { icon: "🧾", label: "Bản ghi", value: users.length, delta: { label: "users", tone: "neutral" as const } },
      { icon: "🆕", label: "Mới hôm nay", value: 0, delta: { label: "—", tone: "neutral" as const } },
      { icon: "⚙️", label: "Nguồn", value: "API", delta: { label: "/api/v1/users", tone: "neutral" as const } }
    ];
  }, [users.length]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${u.id} ${u.code ?? ""} ${u.name} ${u.email ?? ""}`.toLowerCase().includes(q));
  }, [query, users]);

  return (
    <div className={styles.page}>
      <div className={styles.statsGrid}>
        {stats.map((s) => (
          <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} delta={s.delta} />
        ))}
      </div>

      <Card
        title="👥 Danh sách nhân viên"
        sub="CRUD thật qua DB (FastAPI)"
        right={
          <div className={styles.actions}>
            <button
              className={styles.btnGhost}
              type="button"
              onClick={() => {
                setEditing(null);
                setCode("");
                setName("");
                setEmail("");
                setRole("");
                setStatus("active");
                setDepartmentId("");
                setModalOpen(true);
              }}
            >
              ➕ Thêm nhân viên
            </button>
          </div>
        }
      >
        {error ? <div className={styles.error}>{error}</div> : null}
        <div className={styles.filters}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
              }}
              placeholder="Tìm theo tên hoặc ID..."
            />
          </div>
          <button className={styles.btnGhost} type="button" disabled={loading} onClick={() => refresh(query)}>
            {loading ? "Đang tải..." : "Làm mới"}
          </button>
        </div>

        <Table>
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>ID</th>
              <th>Mã</th>
              <th>Email</th>
              <th>Phòng ban</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th style={{ width: 120 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td className={styles.empCell}>
                  <span className={styles.empAvatar}>{u.name.slice(0, 2).toUpperCase()}</span>
                  <span className={styles.empMain}>
                    <span className={styles.empName}>{u.name}</span>
                    <span className={styles.empSub}>{new Date(u.created_at).toLocaleString("vi-VN")}</span>
                  </span>
                </td>
                <td className={styles.mono}>{u.id}</td>
                <td className={styles.mono}>{u.code || "—"}</td>
                <td className={styles.muted}>{u.email || "—"}</td>
                <td>{u.department_id ? deptById.get(u.department_id)?.name ?? `#${u.department_id}` : "—"}</td>
                <td>{u.role || "—"}</td>
                <td>
                  <span className={u.status === "active" ? `${styles.tag} ${styles.good}` : `${styles.tag} ${styles.bad}`}>{u.status}</span>
                </td>
                <td>
                  <div className={styles.rowActions}>
                    <button
                      className={`${styles.rowBtn} ${styles.edit}`}
                      type="button"
                      title="Sửa"
                      onClick={() => {
                        setEditing(u);
                        setCode(u.code ?? "");
                        setName(u.name);
                        setEmail(u.email ?? "");
                        setRole(u.role ?? "");
                        setStatus((u.status as any) === "inactive" ? "inactive" : "active");
                        setDepartmentId(u.department_id ? String(u.department_id) : "");
                        setModalOpen(true);
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      className={styles.rowBtn}
                      type="button"
                      title="Đăng ký gương mặt"
                      onClick={() => {
                        setFaceUser(u);
                        setFaceModalOpen(true);
                        setError(null);
                      }}
                    >
                      📷
                    </button>
                    <button
                      className={`${styles.rowBtn} ${styles.del}`}
                      type="button"
                      title="Xóa"
                      onClick={async () => {
                        if (!confirm(`Xóa nhân viên "${u.name}"?`)) return;
                        try {
                          setLoading(true);
                          setError(null);
                          await deleteUser(u.id);
                          await refresh(query);
                        } catch (e) {
                          setError(getApiErrorMessage(e));
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        {filtered.length === 0 ? <div className={styles.empty}>Chưa có nhân viên (hoặc không khớp tìm kiếm).</div> : null}
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? "✏️ Sửa nhân viên" : "➕ Thêm nhân viên"}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className={styles.btnGhost} type="button" onClick={() => setModalOpen(false)} disabled={loading}>
              Hủy
            </button>
            <button
              className={styles.btnPrimary}
              type="button"
              disabled={loading || !name.trim()}
              onClick={async () => {
                try {
                  setLoading(true);
                  setError(null);
                  const payload = {
                    name: name.trim(),
                    code: code.trim() || null,
                    email: email.trim() || null,
                    role: role.trim() || null,
                    status,
                    department_id: departmentId ? Number(departmentId) : null
                  };
                  if (editing) await updateUser(editing.id, payload);
                  else await createUser(payload);
                  setModalOpen(false);
                  await refresh(query);
                } catch (e) {
                  setError(getApiErrorMessage(e));
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? "Đang lưu..." : "Lưu"}
            </button>
          </>
        }
      >
        <div className={styles.formRow}>
          <div className={styles.formLabel}>Mã</div>
          <input className={styles.input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="VD: NV001" />
        </div>
        <div className={styles.formRow}>
          <div className={styles.formLabel}>Tên nhân viên</div>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Nguyễn Văn A" />
        </div>
        <div className={styles.formRow}>
          <div className={styles.formLabel}>Email</div>
          <input className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="VD: a@company.vn" />
        </div>
        <div className={styles.formRow}>
          <div className={styles.formLabel}>Phòng ban</div>
          <select className={styles.input} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">—</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.formRow}>
          <div className={styles.formLabel}>Vai trò</div>
          <input className={styles.input} value={role} onChange={(e) => setRole(e.target.value)} placeholder="VD: Engineer" />
        </div>
        <div className={styles.formRow}>
          <div className={styles.formLabel}>Trạng thái</div>
          <select className={styles.input} value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
        <div className={styles.hint}>Code/email unique. Nếu trùng sẽ báo lỗi từ backend.</div>
      </Modal>

      <Modal
        open={faceModalOpen}
        title={`📷 Đăng ký gương mặt${faceUser ? ` • ${faceUser.name}` : ""}`}
        onClose={() => {
          setFaceModalOpen(false);
          cam.stop();
        }}
        footer={
          <>
            {!cam.state.ready ? (
              <button className={styles.btnGhost} type="button" onClick={() => cam.start()} disabled={loading}>
                📷 Bật camera
              </button>
            ) : (
              <button className={styles.btnGhost} type="button" onClick={() => cam.switchCamera()} disabled={loading}>
                🔄 Đổi camera
              </button>
            )}
            <button
              className={styles.btnPrimary}
              type="button"
              disabled={!cam.state.ready || loading || !faceUser}
              onClick={async () => {
                try {
                  if (!faceUser) return;
                  setLoading(true);
                  setError(null);
                  const blob = await cam.capture({ type: "image/jpeg", quality: 0.9 });
                  await enrollFaceForUser(faceUser.id, blob);
                  alert("Đăng ký gương mặt thành công");
                  setFaceModalOpen(false);
                  cam.stop();
                } catch (e) {
                  setError(getApiErrorMessage(e));
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? "Đang đăng ký..." : "Lưu gương mặt"}
            </button>
          </>
        }
      >
        {cam.state.error ? <div className={styles.error}>{cam.state.error}</div> : null}
        <div className={styles.faceVideoWrap}>
          <video ref={cam.videoRef} className={styles.faceVideo} playsInline muted />
          {!cam.state.ready ? <div className={styles.facePlaceholder}>Bật camera để chụp ảnh khuôn mặt</div> : null}
        </div>
        <div className={styles.hint}>Tip: đứng đủ sáng, nhìn thẳng camera, không che mặt.</div>
      </Modal>
    </div>
  );
}

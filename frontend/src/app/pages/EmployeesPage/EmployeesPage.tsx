import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card/Card";
import StatCard from "../../components/StatCard/StatCard";
import Table from "../../components/Table/Table";
import Modal from "../../components/Modal/Modal";
import { createUser, deleteUser, listUsers, updateUser } from "../../../shared/api/users";
import { listDepartments } from "../../../shared/api/departments";
import { enrollFaceForUser } from "../../../shared/api/enrollFace";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import { exportExcelHtml } from "../../../shared/lib/excelExport";
import type { User } from "../../../shared/types/user";
import type { Department } from "../../../shared/types/department";
import { useCamera } from "../../../shared/hooks/useCamera";
import { viStatusLabel } from "../../../shared/i18n/vi";
import styles from "./EmployeesPage.module.scss";

function initialsFromName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/g)
    .filter(Boolean);
  if (parts.length === 0) return "??";
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : parts[0]?.[1] ?? "";
  return `${a}${b}`.toUpperCase();
}

function colorFromString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 75% 55%)`;
}

function nextEmployeeCode(users: User[]) {
  let maxNum = 0;
  let maxDigits = 3;
  for (const u of users) {
    const c = (u.code ?? "").trim().toUpperCase();
    const m = /^NV(\d+)$/.exec(c);
    if (!m) continue;
    const digits = m[1]?.length ?? 0;
    const num = Number(m[1]);
    if (Number.isFinite(num)) {
      maxNum = Math.max(maxNum, num);
      maxDigits = Math.max(maxDigits, digits);
    }
  }
  const next = maxNum + 1;
  return `NV${String(next).padStart(maxDigits, "0")}`;
}

export default function EmployeesPage() {
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
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
  const [portalRoleKey, setPortalRoleKey] = useState<"employee" | "manager">("employee");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [faceModalOpen, setFaceModalOpen] = useState(false);
  const [faceUser, setFaceUser] = useState<User | null>(null);
  const cam = useCamera();

  async function refresh(q?: string) {
    try {
      setLoading(true);
      setError(null);
      const data = await listUsers({ q: q?.trim() || undefined, limit: 500, offset: 0 });
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

  const deptOptions = useMemo(() => {
    return departments
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
      .map((d) => ({ id: String(d.id), label: `${d.code} - ${d.name}` }));
  }, [departments]);

  const stats = useMemo(() => {
    return [
      { icon: "👥", label: "Tổng nhân viên", value: users.length, variant: "blue" as const, delta: { label: "↑ DB", tone: "neutral" as const } },
      { icon: "🧾", label: "Bản ghi", value: users.length, variant: "green" as const, delta: { label: "↑ users", tone: "neutral" as const } },
      { icon: "🆕", label: "Mới hôm nay", value: 0, variant: "orange" as const, delta: { label: "—", tone: "neutral" as const } },
      // { icon: "⚙️", label: "Nguồn", value: "API", variant: "red" as const, delta: { label: "/api/v1/users", tone: "neutral" as const } }
    ];
  }, [users.length]);

  const suggestedCode = useMemo(() => nextEmployeeCode(users), [users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byText = !q
      ? users
      : users.filter((u) => `${u.id} ${u.code ?? ""} ${u.name} ${u.email ?? ""}`.toLowerCase().includes(q));
    if (!deptFilter) return byText;
    return byText.filter((u) => String(u.department_id ?? "") === deptFilter);
  }, [deptFilter, query, users]);

  const pageSize = view === "grid" ? 12 : 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [deptFilter, query, view]);

  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const pageItems = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSafe, pageSize]);

  const pageButtons = useMemo(() => {
    const windowSize = 5;
    const half = Math.floor(windowSize / 2);
    let start = Math.max(1, pageSafe - half);
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    const out: number[] = [];
    for (let p = start; p <= end; p++) out.push(p);
    return out;
  }, [pageSafe, totalPages]);

  return (
    <div className={styles.page}>
      <div className={styles.statsGrid}>
        {stats.map((s) => (
          <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} delta={s.delta} variant={s.variant} />
        ))}
      </div>

      <Card>
        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.toolbar}>
          <div className={styles.tabGroup} role="tablist" aria-label="Chế độ hiển thị nhân viên">
            <button
              className={view === "grid" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              type="button"
              role="tab"
              aria-selected={view === "grid"}
              onClick={() => setView("grid")}
            >
              🔲 Lưới
            </button>
            <button
              className={view === "list" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              type="button"
              role="tab"
              aria-selected={view === "list"}
              onClick={() => setView("list")}
            >
              ☰ Danh sách
            </button>
          </div>

          <div className={styles.searchBoxCompact}>
            <span className={styles.searchIcon}>🔍</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm nhân viên..." />
          </div>

          <select className={styles.select} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} aria-label="Lọc phòng ban">
            <option value="">Tất cả phòng ban</option>
            {deptOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>

          <button className={styles.btnGhost} type="button" disabled={loading} onClick={() => refresh(query)}>
            {loading ? "Đang tải..." : "Làm mới"}
          </button>
          <button
            className={styles.btnGhost}
            type="button"
            disabled={!filtered.length}
            onClick={() => {
              exportExcelHtml({
                filename: `employees_${new Date().toLocaleDateString("en-CA")}.xls`,
                title: "DANH SÁCH NHÂN VIÊN",
                meta: { "Tổng": filtered.length, "Phòng ban": deptOptions.find((d) => d.id === deptFilter)?.label ?? "Tất cả" },
                columns: [
                  { key: "code", label: "Mã NV", widthPx: 110 },
                  { key: "name", label: "Họ tên", widthPx: 220 },
                  { key: "department", label: "Phòng ban", widthPx: 180 },
                  { key: "role", label: "Chức vụ", widthPx: 150 },
                  { key: "status", label: "Trạng thái", widthPx: 110 },
                  { key: "email", label: "Email", widthPx: 220 }
                ],
                rows: filtered.map((u) => ({
                  code: u.code || `#${u.id}`,
                  name: u.name,
                  department: u.department_id ? deptById.get(u.department_id)?.name ?? `#${u.department_id}` : "—",
                  role: u.role || "—",
                  status: u.status || "active",
                  email: u.email || "—"
                }))
              });
            }}
          >
            📥 Xuất Excel
          </button>

          <button
            className={styles.btnPrimary}
            type="button"
            onClick={() => {
              setEditing(null);
              setCode(suggestedCode);
              setName("");
              setEmail("");
              setRole("");
              setDepartmentId("");
              setPortalRoleKey("employee");
              setModalOpen(true);
            }}
          >
            + Thêm nhân viên
          </button>
        </div>
      </Card>

      {view === "grid" ? (
        <div className={styles.empGrid}>
          {pageItems.map((u) => {
            const deptLabel = u.department_id ? deptById.get(u.department_id)?.name ?? `#${u.department_id}` : "—";
            const avatarColor = colorFromString(u.name);
            const initials = initialsFromName(u.name);
            const statusDotClass = u.status === "active" ? `${styles.empStatusDot} ${styles.online}` : `${styles.empStatusDot} ${styles.offline}`;
            return (
              <div
                key={u.id}
                className={styles.empCard}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setEditing(u);
                  setCode(u.code ?? "");
                  setName(u.name);
                  setEmail(u.email ?? "");
                  setRole(u.role ?? "");
                  setDepartmentId(u.department_id ? String(u.department_id) : "");
                  setModalOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  setEditing(u);
                  setCode(u.code ?? "");
                  setName(u.name);
                  setEmail(u.email ?? "");
                  setRole(u.role ?? "");
                  setDepartmentId(u.department_id ? String(u.department_id) : "");
                  setModalOpen(true);
                }}
              >
                <div className={styles.empBigAvatar} style={{ background: avatarColor }}>
                  {initials}
                  <div className={statusDotClass} />
                </div>
                <div className={styles.empCardName}>{u.name}</div>
                <div className={styles.empCardRole}>{u.role || "—"}</div>
                <div className={styles.deptBadge}>{deptLabel}</div>

                <div className={styles.empStats}>
                  <div className={styles.empStatItem}>
                    <div className={styles.empStatVal}>{u.code || "—"}</div>
                    <div className={styles.empStatLbl}>Mã</div>
                  </div>
                  <div className={styles.empStatItem}>
                    <div className={styles.empStatValSmall}>{u.email ? u.email.split("@")[0] : "—"}</div>
                    <div className={styles.empStatLbl}>Email</div>
                  </div>
                  <div className={styles.empStatItem}>
                    <div className={u.status === "active" ? `${styles.empStatVal} ${styles.ok}` : `${styles.empStatVal} ${styles.warn}`}>{viStatusLabel(u.status)}</div>
                    <div className={styles.empStatLbl}>TT</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card title="👥 Danh sách nhân viên">
          <Table>
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Phòng ban</th>
                <th>Chức vụ</th>
                <th>Trạng thái</th>
                <th>Email</th>
                <th style={{ width: 120 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((u) => (
                <tr key={u.id}>
                  <td className={styles.empCell}>
                    <span className={styles.empAvatar}>{initialsFromName(u.name)}</span>
                    <span className={styles.empMain}>
                      <span className={styles.empName}>{u.name}</span>
                      <span className={styles.empSub}>{u.code || `#${u.id}`}</span>
                    </span>
                  </td>
                  <td>{u.department_id ? deptById.get(u.department_id)?.name ?? `#${u.department_id}` : "—"}</td>
                  <td className={styles.muted}>{u.role || "—"}</td>
                  <td>
                    <span className={u.status === "active" ? `${styles.tag} ${styles.good}` : `${styles.tag} ${styles.bad}`}>{viStatusLabel(u.status)}</span>
                  </td>
                  <td className={styles.muted}>{u.email || "—"}</td>
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
                        className={u.status === "active" ? styles.rowBtn : `${styles.rowBtn} ${styles.enable}`}
                        type="button"
                        title={u.status === "active" ? "Tạm tắt" : "Kích hoạt"}
                        onClick={async () => {
                          try {
                            const nextStatus = u.status === "active" ? "inactive" : "active";
                            setLoading(true);
                            setError(null);
                            await updateUser(u.id, {
                              name: u.name,
                              code: u.code ?? null,
                              email: u.email ?? null,
                              role: u.role ?? null,
                              status: nextStatus,
                              department_id: u.department_id ?? null
                            });
                            await refresh(query);
                          } catch (e) {
                            setError(getApiErrorMessage(e));
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        {u.status === "active" ? "🚫" : "✅"}
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
      )}

      <div className={styles.pagination}>
        <div className={styles.pageHint}>
          {filtered.length === 0 ? "0 kết quả" : `Trang ${pageSafe}/${totalPages} • ${filtered.length} nhân viên`}
        </div>
        <div className={styles.pageControls}>
          <button className={styles.pageBtn} type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSafe <= 1}>
            ←
          </button>
          {pageButtons.map((p) => (
            <button
              key={p}
              className={p === pageSafe ? `${styles.pageBtn} ${styles.pageBtnActive}` : styles.pageBtn}
              type="button"
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}
          <button
            className={styles.pageBtn}
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={pageSafe >= totalPages}
          >
            →
          </button>
        </div>
      </div>

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
              disabled={loading || !name.trim() || (!editing && !email.trim())}
              onClick={async () => {
                try {
                  setLoading(true);
                  setError(null);
                  const payload = {
                    name: name.trim(),
                    code: editing ? (code.trim() || null) : (code.trim() || suggestedCode),
                    email: email.trim() || null,
                    role: role.trim() || null,
                    status: editing ? (editing.status as any) : "active",
                    department_id: departmentId ? Number(departmentId) : null,
                    ...(editing
                      ? {}
                      : {
                          create_login: true,
                          portal_role_key: portalRoleKey
                        })
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
        <div className={styles.modalIntro}>
          <div className={styles.modalTitleLine}>Thông tin cơ bản</div>
          <div className={styles.modalSubLine}>Nhập đủ dữ liệu cần thiết, có thể chỉnh sửa sau.</div>
        </div>

        <div className={styles.modalGrid}>
          <div className={styles.formGroup}>
            <div className={styles.formLabelTop}>Mã nhân viên</div>
            <input className={styles.input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="VD: NV001" />
            {!editing ? <div className={styles.fieldHint}>Gợi ý tự động: {suggestedCode}</div> : null}
          </div>

          <div className={styles.formGroup}>
            <div className={styles.formLabelTop}>
              Tên nhân viên <span className={styles.req}>*</span>
            </div>
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Nguyễn Văn A" />
          </div>

          <div className={styles.formGroup}>
            <div className={styles.formLabelTop}>
              Email {!editing ? <span className={styles.req}>*</span> : null}
            </div>
            <input className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="VD: a@company.vn" />
            {!editing ? <div className={styles.fieldHint}>Bắt buộc để gửi link kích hoạt tài khoản.</div> : null}
          </div>

          <div className={styles.formGroup}>
            <div className={styles.formLabelTop}>Phòng ban</div>
            <select className={styles.input} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>

          {!editing ? (
            <div className={styles.formGroup}>
              <div className={styles.formLabelTop}>Quyền truy cập Portal</div>
              <select className={styles.input} value={portalRoleKey} onChange={(e) => setPortalRoleKey(e.target.value as any)}>
                <option value="employee">Nhân viên</option>
                <option value="manager">Quản lý</option>
              </select>
              <div className={styles.fieldHint}>Quản lý có thể xem/duyệt theo phạm vi công ty (không có quyền IAM/Công ty).</div>
            </div>
          ) : null}

          <div className={styles.formGroup}>
            <div className={styles.formLabelTop}>Chức danh (tùy chọn)</div>
            <input className={styles.input} value={role} onChange={(e) => setRole(e.target.value)} placeholder="VD: Team lead" />
          </div>
        </div>

        <div className={styles.modalNote}>Lưu ý: `code`/`email` là duy nhất trong phạm vi công ty. Nếu trùng sẽ báo lỗi từ backend.</div>
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

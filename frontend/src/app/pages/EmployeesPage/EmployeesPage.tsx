import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card/Card";
import StatCard from "../../components/StatCard/StatCard";
import Table from "../../components/Table/Table";
import Modal from "../../components/Modal/Modal";
import { createUser, deleteUser, hardDeleteUser, listUsers, restoreUser, updateUser, type UserDeletedFilter } from "../../../shared/api/users";
import {
  approveCompanyJoinRequest,
  createCompanyInvitation,
  listCompanyInvitations,
  listCompanyJoinRequests,
  rejectCompanyJoinRequest,
  type CompanyInvitation,
  type CompanyJoinRequest
} from "../../../shared/api/companyMembership";
import { listDepartments } from "../../../shared/api/departments";
import { enrollFaceForUser, resetFaceForUser } from "../../../shared/api/enrollFace";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import { exportExcelHtml } from "../../../shared/lib/excelExport";
import { formatDateVi } from "../../../shared/lib/date";
import type { User } from "../../../shared/types/user";
import type { Department } from "../../../shared/types/department";
import { useCamera } from "../../../shared/hooks/useCamera";
import { viStatusLabel } from "../../../shared/i18n/vi";
import { useAuth } from "../../../shared/auth/auth";
import {
  AppstoreOutlined,
  ApartmentOutlined,
  CameraOutlined,
  CheckOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  LeftOutlined,
  MailOutlined,
  PlusOutlined,
  ReloadOutlined,
  RollbackOutlined,
  RetweetOutlined,
  RightOutlined,
  SearchOutlined,
  StopOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  UserAddOutlined
} from "@ant-design/icons";
import { Tooltip } from "antd";
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

function formatHireDateLabel(value?: string | null) {
  if (!value) return "—";
  const dt = new Date(`${value}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? value : formatDateVi(dt);
}

export default function EmployeesPage() {
  const auth = useAuth();
  const isAdmin = auth.roleKeys.includes("admin");
  const [workflowTab, setWorkflowTab] = useState<"employees" | "requests" | "invitations">("employees");
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [deletedFilter, setDeletedFilter] = useState<UserDeletedFilter>("active");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [joinRequests, setJoinRequests] = useState<CompanyJoinRequest[]>([]);
  const [invitations, setInvitations] = useState<CompanyInvitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [citizenId, setCitizenId] = useState("");
  const [citizenIdPlace, setCitizenIdPlace] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [role, setRole] = useState("");
  const [portalRoleKey, setPortalRoleKey] = useState<"employee" | "manager">("employee");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [faceModalOpen, setFaceModalOpen] = useState(false);
  const [faceUser, setFaceUser] = useState<User | null>(null);
  const cam = useCamera();

  async function refresh(q?: string, nextDeletedFilter: UserDeletedFilter = deletedFilter) {
    try {
      setLoading(true);
      setError(null);
      const data = await listUsers({ q: q?.trim() || undefined, limit: 500, offset: 0, deleted: isAdmin ? nextDeletedFilter : "active" });
      setUsers(data);
      const [requestsResult, invitesResult] = await Promise.allSettled([
        listCompanyJoinRequests({ status: "PENDING" }),
        listCompanyInvitations()
      ]);
      setJoinRequests(requestsResult.status === "fulfilled" ? requestsResult.value : []);
      setInvitations(invitesResult.status === "fulfilled" ? invitesResult.value : []);
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
  }, [isAdmin]);

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
    const activeCount = users.filter((u) => u.status === "active" && !u.deleted_at).length;
    const softDeletedCount = users.filter((u) => u.deleted_at).length;
    const deptCount = new Set(users.map((u) => u.department_id).filter((v): v is number => typeof v === "number")).size;
    const pendingAuthCount = invitations.filter((x) => x.status === "PENDING").length;
    const noDeptCount = users.filter((u) => !u.department_id).length;
    return [
      { icon: <TeamOutlined />, label: deletedFilter === "deleted" ? "Đã xoá mềm" : deletedFilter === "all" ? "Tất cả nhân viên" : "Nhân viên", value: users.length, variant: "blue" as const, foot: softDeletedCount > 0 ? `${softDeletedCount} đã xoá mềm` : `${activeCount} đang hoạt động` },
      { icon: <ApartmentOutlined />, label: "Phòng ban có người", value: deptCount, variant: "green" as const, foot: noDeptCount > 0 ? `${noDeptCount} chưa gắn phòng ban` : "Đã gắn phòng ban đầy đủ" },
      { icon: <UserAddOutlined />, label: "Chờ xử lý", value: joinRequests.length + pendingAuthCount, variant: "orange" as const, foot: `${joinRequests.length} yêu cầu • ${pendingAuthCount} lời mời` }
    ];
  }, [deletedFilter, invitations, joinRequests.length, users]);

  const suggestedCode = useMemo(() => nextEmployeeCode(users), [users]);

  function openCreateModal() {
    setEditing(null);
    setCode(suggestedCode);
    setName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setCitizenId("");
    setCitizenIdPlace("");
    setHireDate("");
    setRole("");
    setDepartmentId("");
    setPortalRoleKey("employee");
    setModalOpen(true);
  }

  function openEditModal(u: User) {
    setEditing(u);
    setCode(u.code ?? "");
    setName(u.name);
    setEmail(u.email ?? "");
    setPhone(u.phone ?? "");
    setAddress(u.address ?? "");
    setCitizenId(u.citizen_id ?? "");
    setCitizenIdPlace(u.citizen_id_place ?? "");
    setHireDate(u.hire_date ?? "");
    setRole(u.role ?? "");
    setDepartmentId(u.department_id ? String(u.department_id) : "");
    setModalOpen(true);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byText = !q
      ? users
      : users.filter((u) => `${u.id} ${u.code ?? ""} ${u.name} ${u.email ?? ""} ${u.phone ?? ""} ${u.address ?? ""} ${u.citizen_id ?? ""} ${u.citizen_id_place ?? ""}`.toLowerCase().includes(q));
    if (!deptFilter) return byText;
    return byText.filter((u) => String(u.department_id ?? "") === deptFilter);
  }, [deptFilter, query, users]);

  const pageSize = view === "grid" ? 12 : 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [deletedFilter, deptFilter, query, view]);

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
              className={workflowTab === "employees" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              type="button"
              role="tab"
              aria-selected={workflowTab === "employees"}
              onClick={() => setWorkflowTab("employees")}
            >
              <TeamOutlined /> Nhân viên
            </button>
            <button
              className={workflowTab === "requests" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              type="button"
              role="tab"
              aria-selected={workflowTab === "requests"}
              onClick={() => setWorkflowTab("requests")}
            >
              <UserAddOutlined /> Yêu cầu
            </button>
            <button
              className={workflowTab === "invitations" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              type="button"
              role="tab"
              aria-selected={workflowTab === "invitations"}
              onClick={() => setWorkflowTab("invitations")}
            >
              <MailOutlined /> Lời mời
            </button>
          </div>

          {workflowTab === "employees" ? (
            <>
              <div className={styles.searchBoxCompact}>
                <span className={styles.searchIcon}>
                  <SearchOutlined />
                </span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tên, mã, email, SĐT, CCCD..." />
              </div>

              <select className={styles.select} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} aria-label="Lọc phòng ban">
                <option value="">Tất cả phòng ban</option>
                {deptOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>

              {isAdmin ? (
                <select
                  className={styles.select}
                  value={deletedFilter}
                  onChange={async (e) => {
                    const next = e.target.value as UserDeletedFilter;
                    setDeletedFilter(next);
                    setPage(1);
                    await refresh(query, next);
                  }}
                  aria-label="Lọc trạng thái xoá mềm"
                >
                  <option value="active">Chưa xoá mềm</option>
                  <option value="deleted">Đã xoá mềm</option>
                  <option value="all">Tất cả nhân viên</option>
                </select>
              ) : null}

              <button className={styles.btnGhost} type="button" disabled={loading} onClick={() => refresh(query)}>
                {loading ? "..." : <ReloadOutlined />}
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
                      { key: "phone", label: "Số điện thoại", widthPx: 150 },
                      { key: "citizen_id", label: "CCCD", widthPx: 160 },
                      { key: "citizen_id_place", label: "Nơi cấp CCCD", widthPx: 200 },
                      { key: "hire_date", label: "Ngày vào làm", widthPx: 150 },
                      { key: "status", label: "Trạng thái", widthPx: 110 },
                      { key: "email", label: "Email", widthPx: 220 },
                      { key: "address", label: "Địa chỉ", widthPx: 260 }
                    ],
                    rows: filtered.map((u) => ({
                      code: u.code || `#${u.id}`,
                      name: u.name,
                      department: u.department_id ? deptById.get(u.department_id)?.name ?? `#${u.department_id}` : "—",
                      role: u.role || "—",
                      phone: u.phone || "—",
                      citizen_id: u.citizen_id || "—",
                      citizen_id_place: u.citizen_id_place || "—",
                      hire_date: formatHireDateLabel(u.hire_date),
                      status: u.status || "active",
                      email: u.email || "—",
                      address: u.address || "—"
                    }))
                  });
                }}
              >
                <DownloadOutlined /> Excel
              </button>

              <button
                className={styles.btnPrimary}
                type="button"
                onClick={openCreateModal}
              >
                <PlusOutlined /> Thêm
              </button>
            </>
          ) : (
            <button className={styles.btnGhost} type="button" disabled={loading} onClick={() => refresh(query)}>
              {loading ? "Đang tải..." : "Làm mới"}
            </button>
          )}
        </div>
      </Card>

      {workflowTab === "employees" ? (
        <div className={styles.employeeControls}>
          <div className={styles.viewSwitch} role="tablist" aria-label="Kiểu hiển thị nhân viên">
            <button
              className={view === "grid" ? `${styles.viewBtn} ${styles.viewBtnActive}` : styles.viewBtn}
              type="button"
              role="tab"
              aria-selected={view === "grid"}
              onClick={() => setView("grid")}
            >
              <AppstoreOutlined /> Lưới
            </button>
            <button
              className={view === "list" ? `${styles.viewBtn} ${styles.viewBtnActive}` : styles.viewBtn}
              type="button"
              role="tab"
              aria-selected={view === "list"}
              onClick={() => setView("list")}
            >
              <UnorderedListOutlined /> Danh sách
            </button>
          </div>

          <div className={styles.pagination}>
            <div className={styles.pageHint}>
              {filtered.length === 0 ? "0 kết quả" : `Trang ${pageSafe}/${totalPages} • ${filtered.length} nhân viên`}
            </div>
            <div className={styles.pageControls}>
              <button className={styles.pageBtn} type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSafe <= 1}>
                <LeftOutlined />
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
                <RightOutlined />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {workflowTab === "requests" ? (
        <Card
          title={
            <span className={styles.cardTitle}>
              <UserAddOutlined /> Yêu cầu tham gia
            </span>
          }
        >
          <div className={styles.workflowList}>
            {joinRequests.map((request) => (
              <div key={request.id} className={styles.workflowItem}>
                <div>
                  <div className={styles.workflowTitle}>{request.user?.name ?? `User #${request.user_id}`}</div>
                  <div className={styles.workflowSub}>{request.user?.email ?? "Chưa có email"} • {request.company?.name ?? `Công ty #${request.company_id}`}</div>
                </div>
                <div className={styles.workflowActions}>
                  <button
                    className={styles.btnPrimary}
                    type="button"
                    disabled={loading}
                    onClick={async () => {
                      try {
                        setLoading(true);
                        setError(null);
                        await approveCompanyJoinRequest(request.id);
                        await refresh(query);
                      } catch (e) {
                        setError(getApiErrorMessage(e));
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    Duyệt
                  </button>
                  <button
                    className={styles.btnGhost}
                    type="button"
                    disabled={loading}
                    onClick={async () => {
                      try {
                        setLoading(true);
                        setError(null);
                        await rejectCompanyJoinRequest(request.id);
                        await refresh(query);
                      } catch (e) {
                        setError(getApiErrorMessage(e));
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          </div>
          {joinRequests.length === 0 ? <div className={styles.empty}>Chưa có yêu cầu tham gia đang chờ.</div> : null}
        </Card>
      ) : workflowTab === "invitations" ? (
        <Card
          title={
            <span className={styles.cardTitle}>
              <MailOutlined /> Lời mời nhân viên
            </span>
          }
        >
          <div className={styles.inviteBox}>
            <div className={styles.searchBox}>
              <span className={styles.searchIcon}>
                <MailOutlined />
              </span>
              <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email nhân viên" />
            </div>
            <button
              className={styles.btnPrimary}
              type="button"
              disabled={loading || !inviteEmail.trim()}
              onClick={async () => {
                try {
                  setLoading(true);
                  setError(null);
                  await createCompanyInvitation(inviteEmail.trim());
                  setInviteEmail("");
                  await refresh(query);
                } catch (e) {
                  setError(getApiErrorMessage(e));
                } finally {
                  setLoading(false);
                }
              }}
            >
              <MailOutlined /> Mời nhân viên
            </button>
          </div>
          <div className={styles.workflowList}>
            {invitations.map((invitation) => (
              <div key={invitation.id} className={styles.workflowItem}>
                <div>
                  <div className={styles.workflowTitle}>{invitation.email}</div>
                  <div className={styles.workflowSub}>{invitation.company?.name ?? `Công ty #${invitation.company_id}`}</div>
                </div>
                <span className={invitation.status === "PENDING" ? `${styles.tag} ${styles.good}` : styles.tag}>{invitation.status}</span>
              </div>
            ))}
          </div>
          {invitations.length === 0 ? <div className={styles.empty}>Chưa có lời mời nào.</div> : null}
        </Card>
      ) : view === "grid" ? (
        <div className={styles.empGrid}>
          {pageItems.map((u) => {
            const deptLabel = u.department_id ? deptById.get(u.department_id)?.name ?? `#${u.department_id}` : "—";
            const avatarColor = colorFromString(u.name);
            const initials = initialsFromName(u.name);
            const statusDotClass = u.status === "active" ? `${styles.empStatusDot} ${styles.online}` : `${styles.empStatusDot} ${styles.offline}`;
            return (
              <div
                key={u.id}
                className={u.deleted_at ? `${styles.empCard} ${styles.empCardDeleted}` : styles.empCard}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!u.deleted_at) openEditModal(u);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  if (u.deleted_at) return;
                  openEditModal(u);
                }}
              >
                <div className={styles.empBigAvatar} style={{ background: avatarColor }}>
                  {initials}
                  <div className={statusDotClass} />
                </div>
                <div className={styles.empCardName}>{u.name}</div>
                <div className={styles.empCardRole}>{u.role || "—"}</div>
                <div className={styles.deptBadge}>{deptLabel}</div>
                {u.deleted_at ? <div className={`${styles.tag} ${styles.deletedTag}`}>Đã xoá mềm</div> : null}
                {u.deleted_at && isAdmin ? (
                  <div className={styles.cardActions}>
                    <Tooltip title="Khôi phục" placement="top">
                      <button
                        className={`${styles.rowBtn} ${styles.enable}`}
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            setLoading(true);
                            setError(null);
                            await restoreUser(u.id);
                            await refresh(query);
                          } catch (err) {
                            setError(getApiErrorMessage(err));
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        <RollbackOutlined />
                      </button>
                    </Tooltip>
                    <Tooltip title="Xóa vĩnh viễn" placement="top">
                      <button
                        className={`${styles.rowBtn} ${styles.del}`}
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(`Xóa vĩnh viễn nhân viên "${u.name}"? Dữ liệu liên quan sẽ bị gỡ khỏi hệ thống.`)) return;
                          try {
                            setLoading(true);
                            setError(null);
                            await hardDeleteUser(u.id);
                            await refresh(query);
                          } catch (err) {
                            setError(getApiErrorMessage(err));
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        <DeleteOutlined />
                      </button>
                    </Tooltip>
                  </div>
                ) : null}

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
                    <div className={styles.empStatValSmall}>{u.phone || "—"}</div>
                    <div className={styles.empStatLbl}>SĐT</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card
          title={
            <span className={styles.cardTitle}>
              <TeamOutlined /> Danh sách nhân viên
            </span>
          }
        >
          <Table>
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Phòng ban</th>
                <th>Chức vụ</th>
                <th>Số điện thoại</th>
                <th>CCCD</th>
                <th>Ngày vào làm</th>
                <th>Trạng thái</th>
                <th>Email</th>
                <th style={{ width: 120 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((u) => {
                const isSoftDeleted = Boolean(u.deleted_at);
                return (
                <tr key={u.id} className={isSoftDeleted ? styles.deletedRow : undefined}>
                  <td className={styles.empCell}>
                    <span className={styles.empAvatar}>{initialsFromName(u.name)}</span>
                    <span className={styles.empMain}>
                      <span className={styles.empName}>{u.name}</span>
                      <span className={styles.empSub}>{u.code || `#${u.id}`}</span>
                    </span>
                  </td>
                  <td>{u.department_id ? deptById.get(u.department_id)?.name ?? `#${u.department_id}` : "—"}</td>
                  <td className={styles.muted}>{u.role || "—"}</td>
                  <td className={styles.muted}>{u.phone || "—"}</td>
                  <td className={styles.muted}>{u.citizen_id || "—"}</td>
                  <td className={styles.muted}>{formatHireDateLabel(u.hire_date)}</td>
                  <td>
                    {isSoftDeleted ? (
                      <span className={`${styles.tag} ${styles.deletedTag}`}>Đã xoá mềm</span>
                    ) : (
                      <span className={u.status === "active" ? `${styles.tag} ${styles.good}` : `${styles.tag} ${styles.bad}`}>{viStatusLabel(u.status)}</span>
                    )}
                  </td>
                  <td className={styles.muted}>{u.email || "—"}</td>
                  <td>
                    <div className={styles.rowActions}>
                      {isSoftDeleted ? (
                        isAdmin ? (
                          <>
                            <Tooltip title="Khôi phục" placement="top">
                              <button
                                className={`${styles.rowBtn} ${styles.enable}`}
                                type="button"
                                onClick={async () => {
                                  try {
                                    setLoading(true);
                                    setError(null);
                                    await restoreUser(u.id);
                                    await refresh(query);
                                  } catch (e) {
                                    setError(getApiErrorMessage(e));
                                  } finally {
                                    setLoading(false);
                                  }
                                }}
                              >
                                <RollbackOutlined />
                              </button>
                            </Tooltip>
                            <Tooltip title="Xóa vĩnh viễn" placement="top">
                              <button
                                className={`${styles.rowBtn} ${styles.del}`}
                                type="button"
                                onClick={async () => {
                                  if (!confirm(`Xóa vĩnh viễn nhân viên "${u.name}"? Dữ liệu liên quan sẽ bị gỡ khỏi hệ thống.`)) return;
                                  try {
                                    setLoading(true);
                                    setError(null);
                                    await hardDeleteUser(u.id);
                                    await refresh(query);
                                  } catch (e) {
                                    setError(getApiErrorMessage(e));
                                  } finally {
                                    setLoading(false);
                                  }
                                }}
                              >
                                <DeleteOutlined />
                              </button>
                            </Tooltip>
                          </>
                        ) : null
                      ) : (
                        <>
                          <Tooltip title="Sửa" placement="top">
                            <button
                              className={`${styles.rowBtn} ${styles.edit}`}
                              type="button"
                              onClick={() => openEditModal(u)}
                            >
                              <EditOutlined />
                            </button>
                          </Tooltip>
                          <Tooltip title="Gương mặt" placement="top">
                            <button
                              className={styles.rowBtn}
                              type="button"
                              onClick={() => {
                                setFaceUser(u);
                                setFaceModalOpen(true);
                                setError(null);
                              }}
                            >
                              <CameraOutlined />
                            </button>
                          </Tooltip>
                          <Tooltip title={u.status === "active" ? "Tạm tắt" : "Kích hoạt"} placement="top">
                            <button
                              className={u.status === "active" ? styles.rowBtn : `${styles.rowBtn} ${styles.enable}`}
                              type="button"
                              onClick={async () => {
                                try {
                                  const nextStatus = u.status === "active" ? "inactive" : "active";
                                  setLoading(true);
                                  setError(null);
                                  await updateUser(u.id, {
                                    name: u.name,
                                    code: u.code ?? null,
                                    email: u.email ?? null,
                                    phone: u.phone ?? null,
                                    address: u.address ?? null,
                                    citizen_id: u.citizen_id ?? null,
                                    citizen_id_place: u.citizen_id_place ?? null,
                                    hire_date: u.hire_date ?? null,
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
                              {u.status === "active" ? <StopOutlined /> : <CheckOutlined />}
                            </button>
                          </Tooltip>
                          <Tooltip title="Xóa mềm" placement="top">
                            <button
                              className={`${styles.rowBtn} ${styles.del}`}
                              type="button"
                              onClick={async () => {
                                if (!confirm(`Xóa mềm nhân viên "${u.name}"? Nhân viên sẽ bị ẩn khỏi giao diện quản lý.`)) return;
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
                              <DeleteOutlined />
                            </button>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </Table>

          {filtered.length === 0 ? <div className={styles.empty}>Chưa có nhân viên (hoặc không khớp tìm kiếm).</div> : null}
        </Card>
      )}

      <Modal
        open={modalOpen}
        title={
          <span className={styles.modalTitle}>
            {editing ? <EditOutlined /> : <PlusOutlined />}
            {editing ? "Sửa nhân viên" : "Thêm nhân viên"}
          </span>
        }
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
                    phone: phone.trim() || null,
                    address: address.trim() || null,
                    citizen_id: citizenId.trim() || null,
                    citizen_id_place: citizenIdPlace.trim() || null,
                    hire_date: hireDate || null,
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
        {/*<div className={styles.modalIntro}>*/}
        {/*  <div className={styles.modalTitleLine}>Thông tin cơ bản</div>*/}
        {/*  <div className={styles.modalSubLine}>Nhập đủ dữ liệu cần thiết, có thể chỉnh sửa sau.</div>*/}
        {/*</div>*/}

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
            <div className={styles.formLabelTop}>Số điện thoại</div>
            <input className={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="VD: 0912 345 678" />
          </div>

          <div className={styles.formGroup}>
            <div className={styles.formLabelTop}>Căn cước công dân</div>
            <input className={styles.input} value={citizenId} onChange={(e) => setCitizenId(e.target.value)} placeholder="VD: 079203001234" />
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
              {/*<div className={styles.fieldHint}>Quản lý có thể xem/duyệt theo phạm vi công ty (không có quyền IAM/Công ty).</div>*/}
            </div>
          ) : null}

          <div className={styles.formGroup}>
            <div className={styles.formLabelTop}>Chức danh (tùy chọn)</div>
            <input className={styles.input} value={role} onChange={(e) => setRole(e.target.value)} placeholder="VD: Team lead" />
          </div>

          <div className={styles.formGroup}>
            <div className={styles.formLabelTop}>Nơi cấp CCCD</div>
            <input className={styles.input} value={citizenIdPlace} onChange={(e) => setCitizenIdPlace(e.target.value)} placeholder="VD: Cục CSQLHC về TTXH" />
          </div>

          <div className={styles.formGroup}>
            <div className={styles.formLabelTop}>Ngày vào làm</div>
            <input className={styles.input} type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
          </div>

          <div className={styles.formGroup} style={{ gridColumn: "1 / -1" }}>
            <div className={styles.formLabelTop}>Địa chỉ</div>
            <textarea
              className={styles.input}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="VD: Quận 1, TP.HCM"
              rows={3}
            />
          </div>
        </div>

      </Modal>

      <Modal
        open={faceModalOpen}
        title={
          <span className={styles.modalTitle}>
            <CameraOutlined />
            {`Đăng ký gương mặt${faceUser ? ` • ${faceUser.name}` : ""}`}
          </span>
        }
        onClose={() => {
          setFaceModalOpen(false);
          cam.stop();
        }}
        footer={
          <>
            <button
              className={styles.btnGhost}
              type="button"
              disabled={loading || !faceUser}
              onClick={async () => {
                try {
                  if (!faceUser) return;
                  const ok = confirm(`Reset khuôn mặt của "${faceUser.name}" về trống?`);
                  if (!ok) return;
                  setLoading(true);
                  setError(null);
                  await resetFaceForUser(faceUser.id);
                  alert("Đã reset khuôn mặt về trống");
                  setFaceModalOpen(false);
                  cam.stop();
                } catch (e) {
                  setError(getApiErrorMessage(e));
                } finally {
                  setLoading(false);
                }
              }}
            >
              <ReloadOutlined /> Reset khuôn mặt
            </button>
            {!cam.state.ready ? (
              <button className={styles.btnGhost} type="button" onClick={() => cam.start()} disabled={loading}>
                <CameraOutlined /> Bật camera
              </button>
            ) : (
              <button className={styles.btnGhost} type="button" onClick={() => cam.switchCamera()} disabled={loading}>
                <RetweetOutlined /> Đổi camera
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

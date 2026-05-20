import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card/Card";
import Modal from "../../components/Modal/Modal";
import Table from "../../components/Table/Table";
import RequirePermission from "../../../shared/rbac/RequirePermission";
import { api, type ApiResponse, getApiErrorMessage } from "../../../shared/lib/apiClient";
import styles from "./IamUsersPage.module.scss";

type PermissionOut = { id: number; key: string; label: string; description?: string | null };
type RoleOut = { id: number; key: string; label: string; description?: string | null; permission_keys: string[] };
type AccountOut = { id: number; username: string; role_keys: string[]; permission_keys: string[] };

type CreateForm = { username: string; password: string; roleKeys: string[] };
type EditForm = { id: number; username: string; roleKeys: string[]; permissionKeys: string[] };

const emptyCreate: CreateForm = { username: "", password: "", roleKeys: ["employee"] };
const pageSize = 20;

export default function IamUsersPage() {
  const [accounts, setAccounts] = useState<AccountOut[]>([]);
  const [roles, setRoles] = useState<RoleOut[]>([]);
  const [permissions, setPermissions] = useState<PermissionOut[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  async function loadOptions() {
    const [rr, pr] = await Promise.all([
      api.get<ApiResponse<RoleOut[]>>("/iam/roles", { params: { limit: 500, offset: 0 } }),
      api.get<ApiResponse<PermissionOut[]>>("/iam/permissions", { params: { limit: 500, offset: 0 } })
    ]);
    setRoles(rr.data.result ?? []);
    setPermissions(pr.data.result ?? []);
  }

  async function reload(nextOffset = 0, append = false) {
    try {
      setLoading(true);
      setErr(null);
      const ar = await api.get<ApiResponse<AccountOut[]>>("/iam/users", { params: { limit: pageSize, offset: nextOffset } });
      const rows = ar.data.result ?? [];
      setAccounts((prev) => (append ? [...prev, ...rows] : rows));
      setOffset(nextOffset);
      setHasMore(rows.length === pageSize);
    } catch (e) {
      setErr(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([loadOptions(), reload()]).catch((e) => setErr(getApiErrorMessage(e)));
  }, []);

  const roleLabelByKey = useMemo(() => new Map(roles.map((r) => [r.key, r.label])), [roles]);

  const [openCreate, setOpenCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreate);

  const [openEdit, setOpenEdit] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const createDisabled = !createForm.username.trim() || createForm.password.length < 6;

  return (
    <RequirePermission permission="iam.manage" fallback={<div className={styles.denied}>Bạn không có quyền truy cập IAM.</div>}>
      <div className={styles.page}>
        <Card
          title="🛡️ IAM Users"
          sub="CRUD (DB)"
          right={
            <button
              className={styles.btnPrimary}
              type="button"
              onClick={() => {
                setErr(null);
                setCreateForm(emptyCreate);
                setOpenCreate(true);
              }}
            >
              + Thêm user
            </button>
          }
        >
          {err ? <div className={styles.denied}>{err}</div> : null}
          <Table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Roles</th>
                <th>Permissions</th>
                <th style={{ width: 160 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td className={styles.mono}>{a.username}</td>
                  <td className={styles.rolesCell}>
                    {a.role_keys.map((k) => roleLabelByKey.get(k) ?? k).join(", ") || <span className={styles.muted}>—</span>}
                  </td>
                  <td className={styles.muted}>{a.permission_keys.length} perms</td>
                  <td className={styles.actions}>
                    <button
                      className={styles.btnGhost}
                      type="button"
                      onClick={() => {
                        setErr(null);
                        setEditForm({ id: a.id, username: a.username, roleKeys: a.role_keys, permissionKeys: a.permission_keys });
                        setOpenEdit(true);
                      }}
                    >
                      Sửa
                    </button>
                    <button
                      className={styles.btnDanger}
                      type="button"
                      onClick={() => {
                        setErr(null);
                        api
                          .delete(`/iam/users/${a.id}`)
                          .then(() => reload())
                          .catch((e) => setErr(getApiErrorMessage(e)));
                      }}
                    >
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className={styles.pagination}>
            <div className={styles.pageHint}>{hasMore ? `Đã tải ${accounts.length} tài khoản` : `Đã hiển thị ${accounts.length} tài khoản`}</div>
            {hasMore ? (
              <button className={styles.btnGhost} type="button" disabled={loading} onClick={() => void reload(offset + pageSize, true)}>
                {loading ? "Đang tải..." : "Tải thêm"}
              </button>
            ) : null}
          </div>
        </Card>

        <Modal
          open={openCreate}
          title="Thêm user"
          onClose={() => setOpenCreate(false)}
          footer={
            <>
              <button className={styles.btnGhost} type="button" onClick={() => setOpenCreate(false)}>
                Huỷ
              </button>
              <button
                className={styles.btnPrimary}
                type="button"
                disabled={createDisabled}
                onClick={() => {
                  setErr(null);
                  api
                    .post("/iam/users", {
                      username: createForm.username.trim(),
                      password: createForm.password,
                      role_keys: createForm.roleKeys
                    })
                    .then(() => reload())
                    .then(() => setOpenCreate(false))
                    .catch((e) => setErr(getApiErrorMessage(e)));
                }}
              >
                Tạo
              </button>
            </>
          }
        >
          <div className={styles.form}>
            <div className={styles.formRow}>
              <div className={styles.formLabel}>Username</div>
              <input className={styles.input} value={createForm.username} onChange={(e) => setCreateForm((s) => ({ ...s, username: e.target.value }))} />
            </div>
            <div className={styles.formRow}>
              <div className={styles.formLabel}>Password</div>
              <input
                className={styles.input}
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((s) => ({ ...s, password: e.target.value }))}
              />
            </div>

            <div className={styles.divider} />

            <div className={styles.blockTitle}>Roles</div>
            <div className={styles.pills}>
              {roles.map((r) => {
                const on = createForm.roleKeys.includes(r.key);
                return (
                  <button
                    key={r.key}
                    className={on ? `${styles.pill} ${styles.pillOn}` : styles.pill}
                    type="button"
                    onClick={() => setCreateForm((s) => ({ ...s, roleKeys: on ? s.roleKeys.filter((k) => k !== r.key) : [...s.roleKeys, r.key] }))}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Modal>

        <Modal
          open={openEdit}
          title={editForm ? `Sửa: ${editForm.username}` : "Sửa user"}
          onClose={() => setOpenEdit(false)}
          footer={
            <>
              <button className={styles.btnGhost} type="button" onClick={() => setOpenEdit(false)}>
                Huỷ
              </button>
              <button
                className={styles.btnPrimary}
                type="button"
                disabled={!editForm}
                onClick={() => {
                  if (!editForm) return;
                  setErr(null);
                  api
                    .put(`/iam/users/${editForm.id}`, { role_keys: editForm.roleKeys, permission_keys: editForm.permissionKeys })
                    .then(() => reload())
                    .then(() => setOpenEdit(false))
                    .catch((e) => setErr(getApiErrorMessage(e)));
                }}
              >
                Lưu
              </button>
            </>
          }
        >
          {editForm ? (
            <div className={styles.form}>
              <div className={styles.blockTitle}>Roles</div>
              <div className={styles.pills}>
                {roles.map((r) => {
                  const on = editForm.roleKeys.includes(r.key);
                  return (
                    <button
                      key={r.key}
                      className={on ? `${styles.pill} ${styles.pillOn}` : styles.pill}
                      type="button"
                      onClick={() =>
                        setEditForm((s) =>
                          s ? { ...s, roleKeys: on ? s.roleKeys.filter((k) => k !== r.key) : [...s.roleKeys, r.key] } : s
                        )
                      }
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>

              <div className={styles.divider} />

              <div className={styles.blockTitle}>Direct permissions</div>
              <div className={styles.pills}>
                {permissions.map((p) => {
                  const on = editForm.permissionKeys.includes(p.key);
                  return (
                    <button
                      key={p.key}
                      className={on ? `${styles.pill} ${styles.pillOn}` : styles.pill}
                      type="button"
                      onClick={() =>
                        setEditForm((s) =>
                          s
                            ? {
                                ...s,
                                permissionKeys: on ? s.permissionKeys.filter((k) => k !== p.key) : [...s.permissionKeys, p.key]
                              }
                            : s
                        )
                      }
                      title={p.label}
                    >
                      {p.key}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </Modal>
      </div>
    </RequirePermission>
  );
}

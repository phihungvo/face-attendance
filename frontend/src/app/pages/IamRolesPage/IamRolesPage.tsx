import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card/Card";
import Modal from "../../components/Modal/Modal";
import Table from "../../components/Table/Table";
import RequirePermission from "../../../shared/rbac/RequirePermission";
import { api, type ApiResponse, getApiErrorMessage } from "../../../shared/lib/apiClient";
import styles from "./IamRolesPage.module.scss";

type PermissionOut = { id: number; key: string; label: string; description?: string | null };
type RoleOut = { id: number; key: string; label: string; description?: string | null; permission_keys: string[] };

type FormState = {
  id?: number;
  key: string;
  label: string;
  description?: string;
  permissionKeys: string[];
};

const emptyForm: FormState = { key: "employee", label: "", description: "", permissionKeys: [] };

export default function IamRolesPage() {
  const [roles, setRoles] = useState<RoleOut[]>([]);
  const [permissions, setPermissions] = useState<PermissionOut[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const permLabelByKey = useMemo(() => new Map(permissions.map((p) => [p.key, p.label])), [permissions]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  async function reload() {
    const [pr, rr] = await Promise.all([
      api.get<ApiResponse<PermissionOut[]>>("/iam/permissions"),
      api.get<ApiResponse<RoleOut[]>>("/iam/roles")
    ]);
    setPermissions(pr.data.result ?? []);
    setRoles(rr.data.result ?? []);
  }

  useEffect(() => {
    reload().catch((e) => setErr(getApiErrorMessage(e)));
  }, []);

  const saveDisabled = !form.key.trim() || !form.label.trim();

  return (
    <RequirePermission permission="iam.manage" fallback={<div className={styles.denied}>Bạn không có quyền truy cập IAM.</div>}>
      <div className={styles.page}>
        <Card
          title="🔑 IAM Roles"
          sub="CRUD (DB)"
          right={
            <button
              className={styles.btnPrimary}
              type="button"
              onClick={() => {
                setErr(null);
                setForm(emptyForm);
                setOpen(true);
              }}
            >
              + Thêm role
            </button>
          }
        >
          {err ? <div className={styles.denied}>{err}</div> : null}
          <Table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Tên</th>
                <th>Permissions</th>
                <th style={{ width: 140 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id}>
                  <td className={styles.mono}>{r.key}</td>
                  <td>
                    <div className={styles.roleTitle}>{r.label}</div>
                    {r.description ? <div className={styles.muted}>{r.description}</div> : null}
                  </td>
                  <td className={styles.muted}>
                    {r.permission_keys.map((k) => permLabelByKey.get(k) ?? k).slice(0, 5).join(", ")}
                    {r.permission_keys.length > 5 ? ` (+${r.permission_keys.length - 5})` : ""}
                  </td>
                  <td className={styles.actions}>
                    <button
                      className={styles.btnGhost}
                      type="button"
                      onClick={() => {
                        setErr(null);
                        setForm({
                          id: r.id,
                          key: r.key,
                          label: r.label,
                          description: r.description ?? "",
                          permissionKeys: r.permission_keys
                        });
                        setOpen(true);
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
                          .delete(`/iam/roles/${r.id}`)
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
        </Card>

        <Modal
          open={open}
          title={form.id ? "Sửa role" : "Thêm role"}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className={styles.btnGhost} type="button" onClick={() => setOpen(false)}>
                Huỷ
              </button>
              <button
                className={styles.btnPrimary}
                type="button"
                disabled={saveDisabled}
                onClick={() => {
                  setErr(null);
                  const req = form.id
                    ? api.put(`/iam/roles/${form.id}`, {
                        label: form.label.trim(),
                        description: form.description?.trim() || undefined,
                        permission_keys: form.permissionKeys
                      })
                    : api.post("/iam/roles", {
                        key: form.key.trim(),
                        label: form.label.trim(),
                        description: form.description?.trim() || undefined,
                        permission_keys: form.permissionKeys
                      });
                  req
                    .then(() => reload())
                    .then(() => setOpen(false))
                    .catch((e) => setErr(getApiErrorMessage(e)));
                }}
              >
                Lưu
              </button>
            </>
          }
        >
          <div className={styles.form}>
            <div className={styles.formRow}>
              <div className={styles.formLabel}>Role key</div>
              <input className={styles.input} value={form.key} onChange={(e) => setForm((s) => ({ ...s, key: e.target.value }))} />
            </div>
            <div className={styles.formRow}>
              <div className={styles.formLabel}>Tên role</div>
              <input className={styles.input} value={form.label} onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))} />
            </div>
            <div className={styles.formRow}>
              <div className={styles.formLabel}>Mô tả</div>
              <input className={styles.input} value={form.description ?? ""} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
            </div>

            <div className={styles.divider} />

            <div className={styles.blockTitle}>Permissions</div>
            <div className={styles.pills}>
              {permissions.map((p) => {
                const on = form.permissionKeys.includes(p.key);
                return (
                  <button
                    key={p.key}
                    className={on ? `${styles.pill} ${styles.pillOn}` : styles.pill}
                    type="button"
                    onClick={() =>
                      setForm((s) => ({ ...s, permissionKeys: on ? s.permissionKeys.filter((k) => k !== p.key) : [...s.permissionKeys, p.key] }))
                    }
                    title={p.description ?? p.label}
                  >
                    {p.key}
                  </button>
                );
              })}
            </div>
          </div>
        </Modal>
      </div>
    </RequirePermission>
  );
}


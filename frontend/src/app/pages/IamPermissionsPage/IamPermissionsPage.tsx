import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card/Card";
import Table from "../../components/Table/Table";
import RequirePermission from "../../../shared/rbac/RequirePermission";
import { api, type ApiResponse, getApiErrorMessage } from "../../../shared/lib/apiClient";
import styles from "./IamPermissionsPage.module.scss";

type PermissionOut = { id: number; key: string; label: string; description?: string | null };

export default function IamPermissionsPage() {
  const [q, setQ] = useState("");
  const [perms, setPerms] = useState<PermissionOut[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const res = await api.get<ApiResponse<PermissionOut[]>>("/iam/permissions");
        setPerms(res.data.result ?? []);
      } catch (e) {
        setErr(getApiErrorMessage(e));
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return perms;
    return perms.filter((p) => p.key.toLowerCase().includes(s) || p.label.toLowerCase().includes(s));
  }, [perms, q]);

  return (
    <RequirePermission permission="iam.manage" fallback={<div className={styles.denied}>Bạn không có quyền truy cập IAM.</div>}>
      <div className={styles.page}>
        <Card
          title="🧩 IAM Permissions"
          sub="Danh sách permissions (DB)"
          right={<input className={styles.search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm permission..." />}
        >
          {err ? <div className={styles.denied}>{err}</div> : null}
          <Table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Tên</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className={styles.mono}>{p.key}</td>
                  <td>{p.label}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </RequirePermission>
  );
}

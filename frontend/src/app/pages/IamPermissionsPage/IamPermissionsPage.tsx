import { useEffect, useState } from "react";
import Card from "../../components/Card/Card";
import Table from "../../components/Table/Table";
import RequirePermission from "../../../shared/rbac/RequirePermission";
import { api, type ApiResponse, getApiErrorMessage } from "../../../shared/lib/apiClient";
import styles from "./IamPermissionsPage.module.scss";

type PermissionOut = { id: number; key: string; label: string; description?: string | null };
const pageSize = 30;

export default function IamPermissionsPage() {
  const [q, setQ] = useState("");
  const [perms, setPerms] = useState<PermissionOut[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  async function reload(nextOffset = 0, append = false) {
    try {
      setLoading(true);
      setErr(null);
      const res = await api.get<ApiResponse<PermissionOut[]>>("/iam/permissions", {
        params: { q: q.trim() || undefined, limit: pageSize, offset: nextOffset }
      });
      const rows = res.data.result ?? [];
      setPerms((prev) => (append ? [...prev, ...rows] : rows));
      setOffset(nextOffset);
      setHasMore(rows.length === pageSize);
    } catch (e) {
      setErr(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [q]);

  return (
    <RequirePermission permission="iam.manage" fallback={<div className={styles.denied}>Bạn không có quyền truy cập IAM.</div>}>
      <div className={styles.page}>
        <Card
          title="🧩 IAM Permissions"
          sub={loading && perms.length === 0 ? "Đang tải..." : `Đã tải ${perms.length} permission`}
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
              {perms.map((p) => (
                <tr key={p.id}>
                  <td className={styles.mono}>{p.key}</td>
                  <td>{p.label}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className={styles.pagination}>
            <div className={styles.pageHint}>{hasMore ? `Đã tải ${perms.length} permission` : `Đã hiển thị ${perms.length} permission`}</div>
            {hasMore ? (
              <button className={styles.loadMore} type="button" disabled={loading} onClick={() => void reload(offset + pageSize, true)}>
                {loading ? "Đang tải..." : "Tải thêm"}
              </button>
            ) : null}
          </div>
        </Card>
      </div>
    </RequirePermission>
  );
}

import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card/Card";
import Modal from "../../components/Modal/Modal";
import Table from "../../components/Table/Table";
import { createCompany, deleteCompany, listCompanies, updateCompany, type Company } from "../../../shared/api/companies";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import styles from "./CompaniesPage.module.scss";
import { useAuth } from "../../../shared/auth/auth";
import { viStatusLabel } from "../../../shared/i18n/vi";

const pageSize = 20;

export default function CompaniesPage() {
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Company[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const canManage = useMemo(() => auth.permissionKeys.includes("companies.manage"), [auth.permissionKeys]);

  async function reload(nextOffset = 0, append = false) {
    setLoading(true);
    setError(null);
    try {
      const rows = await listCompanies({ limit: pageSize, offset: nextOffset });
      setItems((prev) => (append ? [...prev, ...rows] : rows));
      setOffset(nextOffset);
      setHasMore(rows.length === pageSize);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    setCode("");
    setName("");
    setStatus("active");
    setOpen(true);
  };

  const openEdit = (c: Company) => {
    setEditing(c);
    setCode(c.code);
    setName(c.name);
    setStatus((c.status as any) === "inactive" ? "inactive" : "active");
    setOpen(true);
  };

  const save = async () => {
    setError(null);
    try {
      if (editing) await updateCompany(editing.id, { code, name, status });
      else await createCompany({ code, name, status });
      setOpen(false);
      await reload();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  const remove = async (c: Company) => {
    if (!canManage) return;
    // eslint-disable-next-line no-alert
    if (!confirm(`Xoá công ty "${c.name}"?`)) return;
    setError(null);
    try {
      await deleteCompany(c.id);
      await reload();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  return (
    <div className={styles.page}>
      {error ? <div className={styles.errorBox}>⚠️ {error}</div> : null}

      <Card
        title="🏢 Danh sách công ty"
        sub={loading && items.length === 0 ? "Đang tải..." : `Đã tải ${items.length} công ty`}
        right={
          canManage ? (
            <button className={styles.primaryBtn} type="button" onClick={openCreate}>
              + Thêm công ty
            </button>
          ) : undefined
        }
      >
        <Table>
          <thead>
            <tr>
              <th style={{ width: 64 }}>ID</th>
              <th>Code</th>
              <th>Tên</th>
              <th style={{ width: 120 }}>Trạng thái</th>
              <th style={{ width: 220 }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>#{c.id}</td>
                <td className={styles.mono}>{c.code}</td>
                <td>{c.name}</td>
                <td>
                  <span className={c.status === "active" ? `${styles.tag} ${styles.good}` : `${styles.tag} ${styles.bad}`}>{viStatusLabel(c.status)}</span>
                </td>
                <td className={styles.actions}>
                  <button className={styles.smallBtn} type="button" onClick={() => auth.setSelectedCompanyId(c.id)} title="Chọn công ty này để thao tác">
                    Chọn
                  </button>
                  <button className={styles.smallBtn} type="button" onClick={() => openEdit(c)} disabled={!canManage}>
                    Sửa
                  </button>
                  <button className={styles.smallBtnDanger} type="button" onClick={() => remove(c)} disabled={!canManage}>
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  Chưa có công ty nào
                </td>
              </tr>
            ) : null}
          </tbody>
        </Table>
        <div className={styles.pagination}>
          <div className={styles.pageHint}>{hasMore ? `Đã tải ${items.length} công ty gần nhất` : `Đã hiển thị toàn bộ ${items.length} công ty đang tải được`}</div>
          {hasMore ? (
            <button className={styles.secondaryBtn} type="button" disabled={loading} onClick={() => void reload(offset + pageSize, true)}>
              {loading ? "Đang tải..." : "Tải thêm"}
            </button>
          ) : null}
        </div>
      </Card>

      <Modal
        open={open}
        title={editing ? "Sửa công ty" : "Thêm công ty"}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className={styles.secondaryBtn} type="button" onClick={() => setOpen(false)}>
              Huỷ
            </button>
            <button className={styles.primaryBtn} type="button" onClick={save} disabled={!code.trim() || !name.trim()}>
              Lưu
            </button>
          </>
        }
      >
        <div className={styles.form}>
          <label>
            <div className={styles.label}>Code</div>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="vd: acme" />
          </label>
          <label>
            <div className={styles.label}>Tên công ty</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="vd: ACME Corp" />
          </label>
          <label>
            <div className={styles.label}>Trạng thái</div>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="active">{viStatusLabel("active")}</option>
                <option value="inactive">{viStatusLabel("inactive")}</option>
              </select>
            </label>
        </div>
      </Modal>
    </div>
  );
}

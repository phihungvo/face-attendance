import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card/Card";
import Table from "../../components/Table/Table";
import Modal from "../../components/Modal/Modal";
import { createDepartment, deleteDepartment, listDepartments, updateDepartment } from "../../../shared/api/departments";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import type { Department } from "../../../shared/types/department";
import styles from "./DepartmentsPage.module.scss";

const pageSize = 20;

export default function DepartmentsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Department[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  async function refresh(q?: string, nextOffset = 0, append = false) {
    try {
      setLoading(true);
      setError(null);
      const data = await listDepartments({ q: q?.trim() || undefined, limit: pageSize, offset: nextOffset });
      setRows((prev) => (append ? [...prev, ...data] : data));
      setOffset(nextOffset);
      setHasMore(data.length === pageSize);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const kpis = useMemo(() => {
    const count = rows.length;
    const locations = new Set(rows.map((r) => r.location).filter(Boolean)).size;
    return [
      { label: "Phòng ban", value: count },
      { label: "Địa điểm", value: locations },
    ];
  }, [rows]);

  return (
    <div className={styles.page}>
      <div className={styles.grid2}>
        <Card title="🏢 Tổng quan phòng ban">
          <div className={styles.kpis}>
            {kpis.map((k) => (
              <div key={k.label} className={styles.kpi}>
                <div className={styles.kpiLabel}>{k.label}</div>
                <div className={styles.kpiValue}>{k.value}</div>
              </div>
            ))}
          </div>
        </Card>
        {/*<Card title="🧭 Gợi ý" sub="Quy trình quản lý nhân sự">*/}
        {/*  <div className={styles.infoBox}>*/}
        {/*    Tạo phòng ban → gán quản lý → phân quyền → map ca làm/địa điểm chấm công (phần ca làm đã bỏ theo yêu cầu).*/}
        {/*  </div>*/}
        {/*</Card>*/}
      </div>

      <Card
        title="🏢 Danh sách phòng ban"
        right={
          <div className={styles.actions}>
            <div className={styles.searchBox}>
              <span className={styles.searchIcon}>🔍</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo mã/tên..." />
            </div>
            <button className={styles.btnGhost} type="button" disabled={loading} onClick={() => refresh(query)}>
              {loading ? "Đang tải..." : "Làm mới"}
            </button>
            <button
              className={styles.btnGhost}
              type="button"
              onClick={() => {
                setEditing(null);
                setCode("");
                setName("");
                setLocation("");
                setModalOpen(true);
              }}
            >
              ➕ Thêm phòng ban
            </button>
          </div>
        }
      >
        {error ? <div className={styles.error}>{error}</div> : null}
        <Table>
          <thead>
            <tr>
              <th>Phòng ban</th>
              <th>Mã</th>
              <th>Địa điểm</th>
              <th>Ngày tạo</th>
              <th style={{ width: 120 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={styles.deptCell}>
                  <span className={styles.deptIcon}>🏢</span>
                  <span className={styles.deptName}>{r.name}</span>
                </td>
                <td className={styles.mono}>{r.code}</td>
                <td className={styles.muted}>{r.location || "—"}</td>
                <td className={styles.muted}>{new Date(r.created_at).toLocaleString("vi-VN")}</td>
                <td>
                  <div className={styles.rowActions}>
                    <button
                      className={`${styles.rowBtn} ${styles.edit}`}
                      type="button"
                      title="Sửa"
                      onClick={() => {
                        setEditing(r);
                        setCode(r.code);
                        setName(r.name);
                        setLocation(r.location || "");
                        setModalOpen(true);
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      className={`${styles.rowBtn} ${styles.del}`}
                      type="button"
                      title="Xóa"
                      onClick={async () => {
                        if (!confirm(`Xóa phòng ban "${r.name}"?`)) return;
                        try {
                          setLoading(true);
                          setError(null);
                          await deleteDepartment(r.id);
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
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className={`${styles.muted} ${styles.empty}`}>
                  Chưa có phòng ban phù hợp.
                </td>
              </tr>
            ) : null}
          </tbody>
        </Table>
        <div className={styles.pagination}>
          <div className={styles.pageHint}>{hasMore ? `Đã tải ${rows.length} phòng ban` : `Đã hiển thị ${rows.length} phòng ban`}</div>
          {hasMore ? (
            <button className={styles.btnGhost} type="button" disabled={loading} onClick={() => void refresh(query, offset + pageSize, true)}>
              {loading ? "Đang tải..." : "Tải thêm"}
            </button>
          ) : null}
        </div>
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? "✏️ Sửa phòng ban" : "➕ Thêm phòng ban"}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className={styles.btnGhost} type="button" onClick={() => setModalOpen(false)} disabled={loading}>
              Hủy
            </button>
            <button
              className={styles.btnPrimary}
              type="button"
              disabled={loading || !code.trim() || !name.trim()}
              onClick={async () => {
                try {
                  setLoading(true);
                  setError(null);
                  if (editing) await updateDepartment(editing.id, { code: code.trim(), name: name.trim(), location: location.trim() || null });
                  else await createDepartment({ code: code.trim(), name: name.trim(), location: location.trim() || null });
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
          <input className={styles.input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="VD: HR, IT..." />
        </div>
        <div className={styles.formRow}>
          <div className={styles.formLabel}>Tên phòng ban</div>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Nhân sự" />
        </div>
        <div className={styles.formRow}>
          <div className={styles.formLabel}>Địa điểm</div>
          <input className={styles.input} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="VD: Tầng 3" />
        </div>
      </Modal>
    </div>
  );
}

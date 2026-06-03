import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card/Card";
import StatCard from "../../components/StatCard/StatCard";
import Table from "../../components/Table/Table";
import Modal from "../../components/Modal/Modal";
import { createDepartment, deleteDepartment, listDepartments, updateDepartment } from "../../../shared/api/departments";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import type { Department } from "../../../shared/types/department";
import { ApartmentOutlined, DeleteOutlined, EditOutlined, EnvironmentOutlined, MinusCircleOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
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

  const stats = useMemo(() => {
    const count = rows.length;
    const locations = new Set(rows.map((r) => r.location?.trim()).filter(Boolean)).size;
    const missingLocation = rows.filter((r) => !r.location?.trim()).length;
    return [
      {
        icon: <ApartmentOutlined />,
        label: "Phòng ban hiển thị",
        value: count,
        variant: "blue" as const,
        foot: hasMore ? `Đang hiển thị ${count} phòng ban đầu tiên` : `Đã tải ${count} phòng ban`
      },
      {
        icon: <EnvironmentOutlined />,
        label: "Địa điểm hoạt động",
        value: locations,
        variant: "green" as const,
        foot: locations > 0 ? `${rows.length - missingLocation} phòng ban đã gắn địa điểm` : "Chưa có địa điểm nào được khai báo"
      },
      {
        icon: <MinusCircleOutlined />,
        label: "Thiếu địa điểm",
        value: missingLocation,
        variant: "orange" as const,
        foot: missingLocation > 0 ? "Nên bổ sung để quản trị tốt hơn" : "Tất cả phòng ban đã có địa điểm"
      }
    ];
  }, [hasMore, rows]);

  return (
    <div className={styles.page}>
      <div className={styles.statsGrid}>
        {stats.map((item) => (
          <StatCard key={item.label} icon={item.icon} label={item.label} value={item.value} foot={item.foot} variant={item.variant} />
        ))}
      </div>

      <Card>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleWrap}>
            <span className={styles.sectionIcon}>
              <ApartmentOutlined />
            </span>
            <div>
              <div className={styles.sectionTitle}>Danh sách phòng ban</div>
              <div className={styles.sectionSub}>Quản lý mã, tên và địa điểm làm việc theo từng phòng ban.</div>
            </div>
          </div>
          <div className={styles.actions}>
            <div className={styles.searchBox}>
              <span className={styles.searchIcon}>
                <SearchOutlined />
              </span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo mã/tên..." />
            </div>
            <button className={styles.btnGhost} type="button" disabled={loading} onClick={() => refresh(query)}>
              <ReloadOutlined /> {loading ? "Đang tải..." : "Làm mới"}
            </button>
            <button
              className={styles.btnPrimary}
              type="button"
              onClick={() => {
                setEditing(null);
                setCode("");
                setName("");
                setLocation("");
                setModalOpen(true);
              }}
            >
              <PlusOutlined /> Thêm phòng ban
            </button>
          </div>
        </div>
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
                  <span className={styles.deptIcon}>
                    <ApartmentOutlined />
                  </span>
                  <span className={styles.deptName}>{r.name}</span>
                </td>
                <td className={styles.mono}>{r.code}</td>
                <td className={styles.muted}>{r.location || "—"}</td>
                <td className={styles.muted}>{new Date(r.created_at).toLocaleString("vi-VN")}</td>
                <td>
                  <div className={styles.rowActions}>
                    <Tooltip title="Sửa" placement="top">
                      <button
                        className={`${styles.rowBtn} ${styles.edit}`}
                        type="button"
                        onClick={() => {
                          setEditing(r);
                          setCode(r.code);
                          setName(r.name);
                          setLocation(r.location || "");
                          setModalOpen(true);
                        }}
                      >
                        <EditOutlined />
                      </button>
                    </Tooltip>
                    <Tooltip title="Xóa" placement="top">
                      <button
                        className={`${styles.rowBtn} ${styles.del}`}
                        type="button"
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
                        <DeleteOutlined />
                      </button>
                    </Tooltip>
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
        title={
          <span className={styles.modalTitle}>
            {editing ? <EditOutlined /> : <PlusOutlined />}
            {editing ? "Sửa phòng ban" : "Thêm phòng ban"}
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

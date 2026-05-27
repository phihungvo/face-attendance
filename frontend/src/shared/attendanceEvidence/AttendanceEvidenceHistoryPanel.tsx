import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAttendanceEvidenceUrl,
  listAttendanceHistory,
  type AttendanceHistoryRow
} from "../api/attendance";
import { listUsers } from "../api/users";
import { useAuth } from "../auth/auth";
import { getApiErrorMessage } from "../lib/apiClient";
import { formatDateTimeVi } from "../lib/date";
import Modal from "../../app/components/Modal/Modal";
import Table from "../../app/components/Table/Table";
import styles from "./AttendanceEvidenceHistoryPanel.module.scss";

function toYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function defaultFromDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - Math.max(0, days - 1));
  return toYmd(date);
}

function formatConfidence(score: number) {
  const normalized = score <= 1 ? score * 100 : score;
  return `${Math.round(normalized)}%`;
}

function typeLabel(type: AttendanceHistoryRow["type"]) {
  return type === "checkin" ? "Vào ca" : "Ra ca";
}

function statusMeta(status: AttendanceHistoryRow["upload_status"]) {
  if (status === "uploaded") return { label: "Sẵn sàng", tone: "success" as const };
  if (status === "pending") return { label: "Đang chờ", tone: "warning" as const };
  if (status === "retry") return { label: "Đang thử lại", tone: "warning" as const };
  if (status === "failed") return { label: "Lỗi upload", tone: "danger" as const };
  if (status === "deleted") return { label: "Đã xóa", tone: "muted" as const };
  return { label: "Đã tắt", tone: "muted" as const };
}

type Props = {
  title?: string;
  sub?: string;
  defaultDays?: number;
  pageSize?: number;
  compact?: boolean;
};

export default function AttendanceEvidenceHistoryPanel({
  title = "Lịch sử bằng chứng chấm công",
  sub = "Xem từng lần vào/ra ca, trạng thái upload ảnh và mở ảnh gốc qua presigned URL.",
  defaultDays = 14,
  pageSize = 20,
  compact = false
}: Props) {
  const auth = useAuth();
  const canReadAll = auth.permissionKeys.includes("attendance.read");
  const [fromDate, setFromDate] = useState(() => defaultFromDate(defaultDays));
  const [toDate, setToDate] = useState(() => toYmd(new Date()));
  const [typeFilter, setTypeFilter] = useState<"" | "checkin" | "checkout">("");
  const [employeeFilter, setEmployeeFilter] = useState<string>("");
  const [employees, setEmployees] = useState<Array<{ id: number; name: string; code?: string | null }>>([]);
  const [rows, setRows] = useState<AttendanceHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewRow, setPreviewRow] = useState<AttendanceHistoryRow | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!canReadAll) return;
    let active = true;
    listUsers({ limit: 500, offset: 0 })
      .then((data) => {
        if (!active) return;
        setEmployees(
          data
            .map((row) => ({ id: row.id, name: row.name, code: row.code ?? null }))
            .sort((a, b) => a.name.localeCompare(b.name, "vi"))
        );
      })
      .catch(() => {
        if (!active) return;
        setEmployees([]);
      });
    return () => {
      active = false;
    };
  }, [canReadAll]);

  async function loadHistory(reset: boolean) {
    const nextRequestId = requestIdRef.current + 1;
    requestIdRef.current = nextRequestId;
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    if (reset) setError(null);

    try {
      const nextOffset = reset ? 0 : rows.length;
      const data = await listAttendanceHistory({
        employee: employeeFilter ? Number(employeeFilter) : undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        type: typeFilter || undefined,
        limit: pageSize,
        offset: nextOffset
      });
      if (requestIdRef.current !== nextRequestId) return;
      setRows((prev) => (reset ? data : [...prev, ...data]));
      setHasMore(data.length === pageSize);
    } catch (e) {
      if (requestIdRef.current !== nextRequestId) return;
      setError(getApiErrorMessage(e));
      if (reset) {
        setRows([]);
        setHasMore(false);
      }
    } finally {
      if (requestIdRef.current !== nextRequestId) return;
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadHistory(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, typeFilter, employeeFilter, auth.selectedCompanyId, auth.companyId]);

  const stats = useMemo(() => {
    const uploaded = rows.filter((row) => row.upload_status === "uploaded").length;
    const waiting = rows.filter((row) => row.upload_status === "pending" || row.upload_status === "retry").length;
    const failed = rows.filter((row) => row.upload_status === "failed").length;
    return [
      { label: "Bản ghi", value: rows.length },
      { label: "Có ảnh", value: uploaded },
      { label: "Đang xử lý", value: waiting },
      { label: "Lỗi", value: failed }
    ];
  }, [rows]);

  async function handleOpenPreview(row: AttendanceHistoryRow) {
    setPreviewRow(row);
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewUrl(null);
    try {
      const res = await getAttendanceEvidenceUrl(row.id);
      setPreviewUrl(res.url);
    } catch (e) {
      setPreviewError(getApiErrorMessage(e));
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <>
      <section className={compact ? `${styles.panel} ${styles.panelCompact}` : styles.panel}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.sub}>{sub}</p>
          </div>
          <button className={styles.refreshBtn} type="button" disabled={loading || loadingMore} onClick={() => void loadHistory(true)}>
            {loading ? "Đang tải..." : "Làm mới"}
          </button>
        </div>

        <div className={styles.filters}>
          <label className={styles.filterField}>
            <span>Từ ngày</span>
            <input className={styles.input} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label className={styles.filterField}>
            <span>Đến ngày</span>
            <input className={styles.input} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
          <label className={styles.filterField}>
            <span>Loại</span>
            <select className={styles.input} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "" | "checkin" | "checkout")}>
              <option value="">Tất cả</option>
              <option value="checkin">Vào ca</option>
              <option value="checkout">Ra ca</option>
            </select>
          </label>
          {canReadAll ? (
            <label className={styles.filterField}>
              <span>Nhân viên</span>
              <select className={styles.input} value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
                <option value="">Tất cả nhân viên</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.code ? `${employee.code} • ${employee.name}` : employee.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className={styles.stats}>
          {stats.map((item) => (
            <div key={item.label} className={styles.statCard}>
              <div className={styles.statValue}>{item.value}</div>
              <div className={styles.statLabel}>{item.label}</div>
            </div>
          ))}
        </div>

        {error ? <div className={styles.errorBox}>{error}</div> : null}

        <Table>
          <thead>
            <tr>
              <th>Thời gian</th>
              {canReadAll ? <th>Nhân viên</th> : null}
              <th>Loại</th>
              <th>Độ khớp</th>
              <th>Ảnh</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td className={styles.emptyCell} colSpan={canReadAll ? 6 : 5}>
                  Chưa có lịch sử phù hợp với bộ lọc hiện tại.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const status = statusMeta(row.upload_status);
              return (
                <tr key={row.id}>
                  <td>
                    <div className={styles.primaryCell}>{formatDateTimeVi(new Date(row.check_time))}</div>
                    <div className={styles.secondaryCell}>Tạo lúc {formatDateTimeVi(new Date(row.created_at))}</div>
                  </td>
                  {canReadAll ? (
                    <td>
                      <div className={styles.primaryCell}>{row.employee_name || `#${row.employee_id}`}</div>
                      <div className={styles.secondaryCell}>{row.employee_code || `ID ${row.employee_id}`}</div>
                    </td>
                  ) : null}
                  <td>
                    <span className={row.type === "checkin" ? `${styles.typePill} ${styles.typeIn}` : `${styles.typePill} ${styles.typeOut}`}>
                      {typeLabel(row.type)}
                    </span>
                  </td>
                  <td>{formatConfidence(row.confidence_score)}</td>
                  <td>
                    {row.upload_status === "uploaded" ? (
                      <button className={styles.linkBtn} type="button" onClick={() => void handleOpenPreview(row)}>
                        Xem ảnh
                      </button>
                    ) : (
                      <span className={styles.secondaryCell}>
                        {row.image_format ? row.image_format.toUpperCase() : "Chưa có"} {row.image_size_kb ? `• ${row.image_size_kb} KB` : ""}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`${styles.statusPill} ${styles[`tone${status.tone[0].toUpperCase()}${status.tone.slice(1)}`]}`}>
                      {status.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>

        {(loading || loadingMore) && rows.length > 0 ? <div className={styles.loadingInline}>Đang tải thêm dữ liệu...</div> : null}

        {hasMore ? (
          <div className={styles.loadMoreWrap}>
            <button className={styles.loadMoreBtn} type="button" disabled={loading || loadingMore} onClick={() => void loadHistory(false)}>
              {loadingMore ? "Đang tải..." : "Tải thêm"}
            </button>
          </div>
        ) : null}
      </section>

      <Modal
        open={previewOpen}
        title={previewRow ? `Ảnh bằng chứng • ${typeLabel(previewRow.type)}` : "Ảnh bằng chứng"}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewRow(null);
          setPreviewUrl(null);
          setPreviewError(null);
        }}
        modalClassName={styles.modal}
      >
        <div className={styles.previewBody}>
          {previewRow ? (
            <div className={styles.previewMeta}>
              <div>{previewRow.employee_name || `#${previewRow.employee_id}`}</div>
              <div>{formatDateTimeVi(new Date(previewRow.check_time))}</div>
            </div>
          ) : null}
          {previewLoading ? <div className={styles.loadingInline}>Đang lấy ảnh bằng chứng...</div> : null}
          {previewError ? <div className={styles.errorBox}>{previewError}</div> : null}
          {!previewLoading && !previewError && previewUrl ? (
            <img className={styles.previewImage} src={previewUrl} alt="Attendance evidence" />
          ) : null}
        </div>
      </Modal>
    </>
  );
}

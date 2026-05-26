import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card/Card";
import Modal from "../../components/Modal/Modal";
import Table from "../../components/Table/Table";
import {
  deleteTimelogDay,
  getAttendanceEvidenceUrl,
  listAttendanceHistory,
  listTimelog,
  upsertTimelogDay,
  type AttendanceHistoryRow,
  type TimelogRow
} from "../../../shared/api/attendance";
import { listDepartments } from "../../../shared/api/departments";
import type { Department } from "../../../shared/types/department";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import { formatDateTimeVi } from "../../../shared/lib/date";
// import { exportExcelHtml } from "../../../shared/lib/excelExport";
import {
  ClockCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  SearchOutlined,
  TeamOutlined
} from "@ant-design/icons";
import styles from "./TimesheetPage.module.scss";
import {exportTimelogExcel} from "../../../shared/lib/excelExport";

const pageSize = 50;

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toHm(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function buildIso(day: string, hm: string) {
  return `${day}T${hm}:00`;
}

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
}

function formatMinutes(total?: number | null) {
  const minutes = Math.max(0, Number(total) || 0);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function historyRank(status?: string | null) {
  if (status === "uploaded") return 4;
  if (status === "pending") return 3;
  if (status === "retry") return 2;
  if (status === "failed") return 1;
  return 0;
}

function historyByType(rows: AttendanceHistoryRow[], type: "checkin" | "checkout", targetIso?: string | null) {
  const targetTs = targetIso ? new Date(targetIso).getTime() : null;
  return (
    rows
      .filter((row) => row.type === type)
      .sort((a, b) => {
        const rankDiff = historyRank(b.upload_status) - historyRank(a.upload_status);
        if (rankDiff !== 0) return rankDiff;

        if (targetTs != null) {
          const distA = Math.abs(new Date(a.check_time).getTime() - targetTs);
          const distB = Math.abs(new Date(b.check_time).getTime() - targetTs);
          if (distA !== distB) return distA - distB;
        }

        return new Date(b.check_time).getTime() - new Date(a.check_time).getTime();
      })
      .at(0) ?? null
  );
}

function uploadStatusLabel(status?: string | null) {
  if (status === "uploaded") return "Đã lưu ảnh";
  if (status === "pending") return "Đang xử lý";
  if (status === "retry") return "Đang thử lại";
  if (status === "failed") return "Upload lỗi";
  if (status === "deleted") return "Đã xóa";
  return "Chưa bật";
}

function formatEvidenceConfidence(score?: number | null) {
  if (score == null) return "—";
  const normalized = score <= 1 ? score * 100 : score;
  return `${Math.round(normalized)}%`;
}

function formatEvidenceSize(sizeKb?: number | null) {
  if (sizeKb == null) return "—";
  return `${sizeKb} KB`;
}

// function escapeHtml(s: any): string {
//     const str = String(s ?? "");
//     return str
//         .replace(/&/g, "&amp;")
//         .replace(/</g, "&lt;")
//         .replace(/>/g, "&gt;")
//         .replace(/"/g, "&quot;")
//         .replace(/'/g, "&#039;");
// }
//
// function exportTimelogExcel({
//     rows,
//     fromDate,
//     toDate,
//     departmentName,
//     statusFilter,
//     summary,
// }: {
//     rows: any[];
//     fromDate: string;
//     toDate: string;
//     departmentName: string;
//     statusFilter: string;
//     summary: { totalEmployees: number; totalHours: number; lateDays: number; absentDays: number };
// }) {
//     const today = new Date().toLocaleDateString("vi-VN", {
//         day: "2-digit", month: "2-digit", year: "numeric"
//     });
//
//     const toHm = (iso?: string | null): string => {
//         if (!iso) return "";
//         const d = new Date(iso);
//         const h = String(d.getHours()).padStart(2, "0");
//         const m = String(d.getMinutes()).padStart(2, "0");
//         return `${h}:${m}`;
//     };
//
//     // Sort & Group
//     const sorted = [...rows].sort((a, b) => {
//         const nameA = (a.user_name ?? "").localeCompare(b.user_name ?? "", "vi");
//         if (nameA !== 0) return nameA;
//         return (a.date ?? "").localeCompare(b.date ?? "");
//     });
//
//     const groupMap = new Map<number, any>();
//     for (const r of sorted) {
//         if (!groupMap.has(r.user_id)) {
//             groupMap.set(r.user_id, {
//                 user_code: r.user_code || `#${r.user_id}`,
//                 user_name: r.user_name,
//                 department_name: r.department_name || "—",
//                 rows: [] as any[],
//             });
//         }
//         groupMap.get(r.user_id)!.rows.push(r);
//     }
//     const groups = [...groupMap.values()];
//
//     const exportRows: any[] = [];
//     for (const g of groups) {
//         exportRows.push({
//             _type: "header",
//             user_name: `${g.user_code} • ${g.user_name}`,
//             department_name: g.department_name,
//             method: `${g.rows.length} ngày công`,
//         });
//
//         for (const r of g.rows) {
//             const st = r.absent ? "Vắng" : r.late ? "Muộn" : "Đúng giờ";
//             exportRows.push({
//                 _type: "data",
//                 user_code: r.user_code || `#${r.user_id}`,
//                 user_name: r.user_name,
//                 department_name: r.department_name || "—",
//                 date: r.date,
//                 checkin: toHm(r.checkin_time),
//                 checkout: toHm(r.checkout_time),
//                 work_hours: Number.isFinite(r.work_hours) ? Math.round((r.work_hours ?? 0) * 100) / 100 : 0,
//                 status: st,
//                 method: r.method || "Face+GPS",
//             });
//         }
//
//         const totalHours = g.rows.reduce((sum: number, r: any) => sum + (Number(r.work_hours) || 0), 0);
//         const lateCount = g.rows.filter((r: any) => r.late).length;
//         const absentCount = g.rows.filter((r: any) => r.absent).length;
//
//         exportRows.push({
//             _type: "subtotal",
//             user_name: "TỔNG CỘNG",
//             date: `${g.rows.length} ngày`,
//             work_hours: Math.round(totalHours * 100) / 100,
//             status: lateCount ? `Muộn: ${lateCount}` : "—",
//             method: absentCount ? `Vắng: ${absentCount}` : "—",
//         });
//
//         exportRows.push({ _type: "blank" });
//     }
//
//     const COLS = [
//         { key: "user_code", label: "Mã NV", widthPx: 100, align: "center" as const },
//         { key: "user_name", label: "Nhân viên", widthPx: 220 },
//         { key: "department_name", label: "Phòng ban", widthPx: 170 },
//         { key: "date", label: "Ngày", widthPx: 110, align: "center" as const },
//         { key: "checkin", label: "Giờ vào", widthPx: 90, align: "center" as const },
//         { key: "checkout", label: "Giờ ra", widthPx: 90, align: "center" as const },
//         { key: "work_hours", label: "Giờ làm", widthPx: 90, align: "right" as const },
//         { key: "status", label: "Trạng thái", widthPx: 120, align: "center" as const },
//         { key: "method", label: "Phương thức", widthPx: 110, align: "center" as const },
//     ];
//
//     const colCount = COLS.length + 1;
//
//     const metaData: [string, string][] = [
//         ["Ngày xuất dữ liệu", today],
//         ["Người xuất dữ liệu", "Hùng"],
//         ["Từ ngày", fromDate],
//         ["Đến ngày", toDate],
//         ["Phòng ban", departmentName],
//         ["Trạng thái", statusFilter || "Tất cả"],
//         ["Tổng nhân viên", String(summary.totalEmployees)],
//         ["Tổng giờ", String(summary.totalHours)],
//         ["Đi trễ", String(summary.lateDays)],
//         ["Vắng", String(summary.absentDays)],
//     ];
//
//     const freezeAt = 2 + metaData.length + 1;
//
//     const colgroupHtml = [`<col style="width:52px"/>`, ...COLS.map(c => `<col style="width:${c.widthPx}px"/>`)].join("");
//
//     const metaHtml = metaData.map(([k, v]) => `
//         <tr>
//             <td colspan="${colCount}" class="meta-row">
//                 <span class="meta-key">${escapeHtml(k)}:</span>&nbsp;${escapeHtml(v)}
//             </td>
//         </tr>
//     `).join("");
//
//     let dataIdx = 0;
//     const tbodyHtml = exportRows.map((r: any) => {
//         if (r._type === "header") {
//             return `<tr><td colspan="${colCount}" style="background:#1e3a8a;color:#fff;font-size:11.5pt;font-weight:800;padding:9px 12px;border:1.5px solid #1a3a5c;">
//                 ${escapeHtml(r.user_name)} &nbsp; <span style="font-weight:500;opacity:0.9;">(${escapeHtml(r.department_name)}) • ${escapeHtml(r.method)}</span>
//             </td></tr>`;
//         }
//         if (r._type === "subtotal") {
//             return `<tr>
//                 <td style="background:#dbeafe;color:#1e3a8a;font-weight:700;padding:8px 10px;border:1px solid #93c5fd;text-align:center;">∑</td>
//                 ${COLS.map(c => {
//                     const align = c.align || "left";
//                     return `<td style="background:#dbeafe;color:#1e3a8a;font-weight:700;padding:8px 10px;border:1px solid #93c5fd;text-align:${align};">${escapeHtml(r[c.key])}</td>`;
//                 }).join("")}
//             </tr>`;
//         }
//         if (r._type === "blank") {
//             return `<tr><td colspan="${colCount}" style="background:#f0f6fd;height:18px;border:none;"></td></tr>`;
//         }
//
//         dataIdx++;
//         const rowBg = dataIdx % 2 === 0 ? "#f0f6fd" : "#ffffff";
//         const statusRaw = String(r.status || "");
//         const statusStyle = statusRaw === "Vắng" ? "background:#f8d7da;color:#721c24;font-weight:700;" :
//                             statusRaw === "Muộn" ? "background:#fff7ed;color:#9a3412;font-weight:700;" :
//                             "background:#d4edda;color:#155724;font-weight:700;";
//
//         return `<tr>
//             <td style="background:${rowBg};text-align:center;padding:7px 8px;border:1px solid #b8cfe8;font-size:10.5pt;">${dataIdx}</td>
//             ${COLS.map(c => {
//                 const align = c.align || "left";
//                 const extra = c.key === "status" ? statusStyle : "";
//                 return `<td style="background:${rowBg};text-align:${align};padding:7px 8px;border:1px solid #b8cfe8;font-size:10.5pt;${extra}">${escapeHtml(r[c.key])}</td>`;
//             }).join("")}
//         </tr>`;
//     }).join("");
//
//     const grandTotalHours = exportRows
//         .filter((r: any) => r._type === "subtotal")
//         .reduce((sum: number, r: any) => sum + (Number(r.work_hours) || 0), 0);
//
//     const html = `<!DOCTYPE html>
// <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
// <head>
//   <meta charset="utf-8" />
//   <!--[if gte mso 9]><xml>
//     <x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
//       <x:Name>Bảng giờ công</x:Name>
//       <x:WorksheetOptions>
//         <x:Print><x:Orientation>Landscape</x:Orientation><x:PaperSize>9</x:PaperSize></x:Print>
//         <x:FreezePanes/><x:FrozenNoSplit/>
//         <x:SplitHorizontal>${freezeAt}</x:SplitHorizontal>
//         <x:TopRowBottomPane>${freezeAt}</x:TopRowBottomPane>
//         <x:ActivePane>2</x:ActivePane>
//       </x:WorksheetOptions>
//     </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
//   </xml><![endif]-->
//   <style>
//     @page { size: A4 landscape; margin: 1.5cm 1cm; }
//     * { font-family: "Times New Roman", serif; box-sizing: border-box; }
//     body { margin:0; padding:0; }
//     table { border-collapse: collapse; width: 100%; }
//     .title-row { background:#1a3a5c; color:#fff; font-size:18pt; font-weight:900; text-align:center; padding:14px 12px; letter-spacing:1px; border:2px solid #1a3a5c; }
//     .meta-row { background:#eef4fb; font-size:11pt; padding:6px 12px; border:1px solid #b8cfe8; }
//     .meta-key { font-weight:800; color:#1a3a5c; }
//     .th { background:#2563a8; color:#fff; font-size:11pt; font-weight:700; padding:9px 10px; border:1.5px solid #1a3a5c; text-align:center; white-space:nowrap; }
//   </style>
// </head>
// <body>
//   <table>
//     <colgroup>${colgroupHtml}</colgroup>
//     <thead>
//       <tr><td colspan="${colCount}" class="title-row">BẢNG GIỜ CÔNG NHÂN VIÊN TỪ NGÀY ${fromDate} ĐẾN NGÀY ${toDate}</td></tr>
//       <tr><td colspan="${colCount}" style="background:#1a3a5c;border:2px solid #1a3a5c;font-size:1pt;">&nbsp;</td></tr>
//       ${metaHtml}
//       <tr><th class="th">STT</th>${COLS.map(c => `<th class="th">${escapeHtml(c.label)}</th>`).join("")}</tr>
//     </thead>
//     <tbody>${tbodyHtml}</tbody>
//     <tfoot>
//       <tr>
//         <td colspan="${colCount}" style="background:#1a3a5c;color:#fff;font-size:11.5pt;font-weight:700;padding:10px 12px;text-align:right;border:1.5px solid #1a3a5c;">
//           TỔNG CỘNG: ${Math.round(grandTotalHours * 100) / 100} giờ &nbsp;|&nbsp; Muộn: ${summary.lateDays} &nbsp;|&nbsp; Vắng: ${summary.absentDays}
//         </td>
//       </tr>
//     </tfoot>
//   </table>
// </body>
// </html>`;
//
//     const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = `timelog_${fromDate}_${toDate}.xls`;
//     a.click();
//     URL.revokeObjectURL(url);
// }

export default function TimesheetPage() {
  const now = useMemo(() => new Date(), []);
  const [fromDate, setFromDate] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const [toDate, setToDate] = useState(() => toYmd(new Date()));
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [status, setStatus] = useState<"" | "on-time" | "late" | "absent">("");
  const [includeAbsent, setIncludeAbsent] = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [rows, setRows] = useState<TimelogRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<TimelogRow | null>(null);
  const [editCheckin, setEditCheckin] = useState("");
  const [editCheckout, setEditCheckout] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<TimelogRow | null>(null);
  const [detailHistory, setDetailHistory] = useState<AttendanceHistoryRow[]>([]);
  const [detailImageUrls, setDetailImageUrls] = useState<Record<number, string>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailPreview, setDetailPreview] = useState<{ label: string; item: AttendanceHistoryRow; url: string } | null>(null);

  const summary = useMemo(() => {
    const totalEmployees = new Set(rows.map((r) => r.user_id)).size;
    const totalHours = rows.reduce((acc, r) => acc + (r.work_hours || 0), 0);
    const lateDays = rows.reduce((acc, r) => acc + (r.late ? 1 : 0), 0);
    const absentDays = rows.reduce((acc, r) => acc + (r.absent ? 1 : 0), 0);
    return { totalEmployees, totalHours: Math.round(totalHours * 10) / 10, lateDays, absentDays };
  }, [rows]);

  async function refresh(nextOffset = 0, append = false) {
    try {
      setBusy(true);
      setError(null);
      const data = await listTimelog({
        from_date: fromDate,
        to_date: toDate,
        department_id: departmentId,
        status: status || null,
        include_absent: includeAbsent || status === "absent",
        limit: pageSize,
        offset: nextOffset
      });
      setRows((prev) => (append ? [...prev, ...data] : data));
      setOffset(nextOffset);
      setHasMore(data.length === pageSize);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const depts = await listDepartments({ limit: 500, offset: 0 });
        setDepartments(depts);
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDetail(row: TimelogRow) {
    setDetailOpen(true);
    setDetailRow(row);
    setDetailHistory([]);
    setDetailImageUrls({});
    setDetailError(null);
    try {
      setDetailLoading(true);
      const history = await listAttendanceHistory({
        employee: row.user_id,
        from_date: row.date,
        to_date: row.date,
        limit: 20,
        offset: 0
      });
      const sorted = history.slice().sort((a, b) => new Date(a.check_time).getTime() - new Date(b.check_time).getTime());
      setDetailHistory(sorted);
      const uploaded = sorted.filter((item) => item.upload_status === "uploaded");
      if (uploaded.length > 0) {
        const urlEntries = await Promise.all(
          uploaded.map(async (item) => {
            try {
              const res = await getAttendanceEvidenceUrl(item.id);
              return [item.id, res.url] as const;
            } catch {
              return null;
            }
          })
        );
        setDetailImageUrls(
          Object.fromEntries(urlEntries.filter((entry): entry is readonly [number, string] => Array.isArray(entry) && Boolean(entry[1])))
        );
      }
    } catch (e) {
      setDetailError(getApiErrorMessage(e));
    } finally {
      setDetailLoading(false);
    }
  }

  const detailCheckin = useMemo(
    () => historyByType(detailHistory, "checkin", detailRow?.checkin_time ?? null),
    [detailHistory, detailRow?.checkin_time]
  );
  const detailCheckout = useMemo(
    () => historyByType(detailHistory, "checkout", detailRow?.checkout_time ?? null),
    [detailHistory, detailRow?.checkout_time]
  );
  const detailEvidenceCount = useMemo(() => detailHistory.filter((row) => row.upload_status === "uploaded").length, [detailHistory]);

  return (
    <div className={styles.page}>
      <Card
        title={
          <span className={styles.cardTitle}>
            <FileTextOutlined /> Nhật ký giờ công
          </span>
        }
      >
        <div className={styles.filters}>
          <div className={styles.filterItem}>
            <div className={styles.filterLabel}>Từ ngày</div>
            <input className={styles.input} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className={styles.filterItem}>
            <div className={styles.filterLabel}>Đến ngày</div>
            <input className={styles.input} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className={styles.filterItem}>
            <div className={styles.filterLabel}>Phòng ban</div>
            <select
              className={styles.input}
              value={departmentId ?? ""}
              onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Tất cả</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterItem}>
            <div className={styles.filterLabel}>Trạng thái</div>
            <select className={styles.input} value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="">Tất cả</option>
              <option value="on-time">Đúng giờ</option>
              <option value="late">Muộn</option>
              <option value="absent">Vắng mặt</option>
            </select>
          </div>
          <label className={styles.check}>
            <input type="checkbox" checked={includeAbsent} onChange={(e) => setIncludeAbsent(e.target.checked)} /> Hiện vắng
          </label>
          <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" disabled={busy} onClick={() => void refresh()}>
            <SearchOutlined /> {busy ? "Đang tải..." : "Lọc"}
          </button>
          <button
            className={`${styles.btn} ${styles.btnGhost}`}
            type="button"
            disabled={!rows.length}
            onClick={() => {
              const lines = [
                ["Mã NV", "Tên", "Phòng ban", "Ngày", "Giờ vào", "Giờ ra", "Giờ làm", "Trạng thái", "Phương thức"].join(",")
              ];
              for (const r of rows) {
                const st = r.absent ? "absent" : r.late ? "late" : "on-time";
                lines.push(
                  [
                    r.user_code || String(r.user_id),
                    r.user_name,
                    r.department_name || "",
                    r.date,
                    toHm(r.checkin_time),
                    toHm(r.checkout_time),
                    String(r.work_hours ?? 0),
                    st,
                    r.method || ""
                  ].join(",")
                );
              }
              const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `timelog_${fromDate}_${toDate}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <DownloadOutlined /> Xuất CSV
          </button>
          <button
            className={`${styles.btn} ${styles.btnGhost}`}
            type="button"
            disabled={!rows.length}
            onClick={() => {
                            exportTimelogExcel({
                                rows,
                                fromDate,
                                toDate,
                                departmentName: departments.find((d) => d.id === departmentId)?.name ?? "Tất cả",
                                statusFilter: status || "Tất cả",
                                summary,
                            });
                        }}
          >
            <FileExcelOutlined /> Xuất Excel
          </button>

          <div className={styles.chips}>
            <div className={styles.chip}>
              <TeamOutlined /> {summary.totalEmployees} nhân viên
            </div>
            <div className={styles.chip}>
              <ClockCircleOutlined /> {summary.totalHours} giờ
            </div>
            <div className={styles.chip}>
              <ExclamationCircleOutlined /> {summary.lateDays} đi trễ
            </div>
            <div className={styles.chip}>
              <DeleteOutlined /> {summary.absentDays} vắng
            </div>
          </div>
        </div>
      </Card>

      <Card
        title={
          <span className={styles.cardTitle}>
            <FileTextOutlined /> Bảng chấm công
          </span>
        }
        sub={hasMore ? `Đã tải ${rows.length} bản ghi` : `${rows.length} bản ghi`}
      >
        {error ? <div className={styles.errorBox}>{error}</div> : null}
        <div className={styles.timelogTable}>
          <Table>
            <thead>
              <tr>
                <th>Mã NV</th>
                <th>Nhân viên</th>
                {/* <th>Tên nhân viên</th> */}
                <th>Phòng ban</th>
                <th>Ngày</th>
                <th>Giờ vào</th>
                <th>Giờ ra</th>
                <th>Giờ làm</th>
                <th>Tăng ca</th>
                <th>Trạng thái</th>
                <th>Phương thức</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const statusKey = r.absent ? "absent" : r.late ? "late" : "on-time";
                const statusLabel = r.absent ? "✗ Vắng mặt" : r.late ? "⚠ Đi muộn" : "✓ Đúng giờ";
                const initials = initialsFromName(r.user_name);

                const checkinHm = toHm(r.checkin_time);
                const checkoutHm = toHm(r.checkout_time);
                const workMin = Number.isFinite(r.work_hours) ? Math.max(0, Math.round((r.work_hours ?? 0) * 60)) : 0;
                const workLabel = `${Math.floor(workMin / 60)}h ${String(workMin % 60).padStart(2, "0")}m`;
                const otMin = 0;
                const otLabel = `${Math.floor(otMin / 60)}h ${String(otMin % 60).padStart(2, "0")}m`;

                return (
                  <tr key={`${r.user_id}-${r.date}`} className={styles.detailRow} onClick={() => void openDetail(r)}>
                    <td className={`${styles.mono} ${styles.colCode}`}>{r.user_code || `#${r.user_id}`}</td>
                    <td className={styles.colName}>
                      <span className={styles.empCell}>
                        <span className={styles.empAvatar}>{initials || "??"}</span>
                        <span className={styles.empName}>{r.user_name}</span>
                      </span>
                    </td>
                    <td>{r.department_name || "—"}</td>
                    <td className={styles.mono}>{r.date}</td>
                    <td className={styles.timeIn}>{checkinHm || "—"}</td>
                    <td className={styles.timeOut}>{checkoutHm || "—"}</td>
                    <td className={styles.timeWork}>{workLabel}</td>
                    <td className={styles.timeOt}>{otLabel}</td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          statusKey === "on-time" ? styles.badgeGreen : statusKey === "late" ? styles.badgeOrange : styles.badgeRed
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className={styles.note}>{r.method || "—"}</td>
                    <td className={styles.colActions}>
                      <div className={styles.rowActions}>
                        <button
                          className={`${styles.rowBtn} ${styles.rowBtnView}`}
                          type="button"
                          title="Mở bằng chứng"
                          onClick={(e) => {
                            e.stopPropagation();
                            void openDetail(r);
                          }}
                        >
                          <EyeOutlined />
                        </button>
                        <button
                        className={`${styles.rowBtn} ${styles.rowBtnEdit}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                            setEditing(r);
                            setEditCheckin(toHm(r.checkin_time));
                            setEditCheckout(toHm(r.checkout_time));
                          setEditOpen(true);
                        }}
                      >
                          <EditOutlined />
                        </button>
                        <button
                          className={`${styles.rowBtn} ${styles.rowBtnDel}`}
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!window.confirm(`Xoá giờ công ngày ${r.date} của ${r.user_name}?`)) return;
                            try {
                              setBusy(true);
                              setError(null);
                              await deleteTimelogDay({ user_id: r.user_id, day: r.date });
                              setRows((prev) => prev.filter((x) => !(x.user_id === r.user_id && x.date === r.date)));
                            } catch (e) {
                              setError(getApiErrorMessage(e));
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          <DeleteOutlined />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
        <div className={styles.pagination}>
          <div className={styles.pageHint}>{hasMore ? `Đang hiển thị ${rows.length} bản ghi gần nhất theo bộ lọc` : `Đã hiển thị ${rows.length} bản ghi theo bộ lọc`}</div>
          {hasMore ? (
            <button className={`${styles.btn} ${styles.btnGhost}`} type="button" disabled={busy} onClick={() => void refresh(offset + pageSize, true)}>
              {busy ? "Đang tải..." : "Tải thêm"}
            </button>
          ) : null}
        </div>
      </Card>

      <Modal
        open={detailOpen && !!detailRow}
        title={
          detailRow ? (
            <div>
              <div className={styles.detailModalTitle}>Bằng chứng chấm công</div>
              <div className={styles.detailModalSub}>{detailRow.user_code || `#${detailRow.user_id}`} • {detailRow.user_name}</div>
            </div>
          ) : (
            "Bằng chứng chấm công"
          )
        }
        onClose={() => {
          setDetailOpen(false);
          setDetailRow(null);
          setDetailHistory([]);
          setDetailImageUrls({});
          setDetailError(null);
          setDetailPreview(null);
        }}
        modalClassName={styles.detailModal}
      >
        {detailRow ? (
          <div className={styles.detailBody}>
            <div className={styles.empStrip}>
              <div className={styles.empStripAvatar}>{initialsFromName(detailRow.user_name) || "??"}</div>
              <div className={styles.empStripInfo}>
                <div className={styles.empStripName}>{detailRow.user_name}</div>
                <div className={styles.empStripMeta}>
                  {(detailRow.user_code || `#${detailRow.user_id}`)} · {detailRow.department_name || "Chưa có phòng ban"} · {detailRow.method || "Face"}
                </div>
              </div>
              <div className={styles.empStripDate}>
                {new Date(`${detailRow.date}T00:00:00`).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
              </div>
            </div>

            <div className={styles.timelineStrip}>
              <div className={styles.timelineItem}>
                <div className={`${styles.timelineDot} ${detailRow.checkin_time ? styles.timelineDone : styles.timelinePending}`}>↘</div>
                <div className={styles.timelineLabel}>Check-in</div>
                <div className={styles.timelineTime}>{toHm(detailRow.checkin_time) || "—"}</div>
              </div>
              <div className={styles.timelineItem}>
                <div className={`${styles.timelineDot} ${detailEvidenceCount > 0 ? styles.timelineDone : styles.timelinePending}`}>📷</div>
                <div className={styles.timelineLabel}>Bằng chứng</div>
                <div className={styles.timelineTime}>{detailEvidenceCount} ảnh</div>
              </div>
              <div className={styles.timelineItem}>
                <div className={`${styles.timelineDot} ${detailRow.checkout_time ? styles.timelineDone : styles.timelinePending}`}>↗</div>
                <div className={styles.timelineLabel}>Check-out</div>
                <div className={styles.timelineTime}>{toHm(detailRow.checkout_time) || "—"}</div>
              </div>
              <div className={styles.timelineItem}>
                <div className={`${styles.timelineDot} ${detailRow.absent ? styles.timelinePending : styles.timelineDone}`}>⏱</div>
                <div className={styles.timelineLabel}>Giờ làm</div>
                <div className={styles.timelineTime}>{formatMinutes(detailRow.working_minutes)}</div>
              </div>
            </div>

            {detailError ? <div className={styles.errorBox}>{detailError}</div> : null}
            {detailLoading ? <div className={styles.detailLoading}>Đang tải attendance evidence...</div> : null}

            <div className={styles.evidenceGrid}>
              {([
                ["checkin", detailCheckin, "Vào ca", toHm(detailRow.checkin_time), styles.evidenceAccentIn],
                ["checkout", detailCheckout, "Ra ca", toHm(detailRow.checkout_time), styles.evidenceAccentOut]
              ] as const).map(([key, item, label, fallbackTime, accentClass]) => (
                <div key={key} className={styles.evidenceCard}>
                  <div className={styles.evidenceCardHead}>
                    <div className={styles.evidenceCardTitle}>
                      <span className={`${styles.evidenceDot} ${accentClass}`} />
                      {label}
                    </div>
                    <div className={styles.evidenceCardTime}>{item ? toHm(item.check_time) : fallbackTime || "—"}</div>
                  </div>

                  {item && detailImageUrls[item.id] ? (
                    <button
                      type="button"
                      className={styles.evidenceImageFrame}
                      onClick={() => setDetailPreview({ label, item, url: detailImageUrls[item.id] })}
                      aria-label={`Xem full ảnh bằng chứng ${label.toLowerCase()}`}
                    >
                      <img className={styles.evidenceImage} src={detailImageUrls[item.id]} alt={`${label} evidence`} />
                      <div className={styles.evidenceHoverHint}>Xem full ảnh</div>
                      <div className={styles.evidenceOverlay}>
                        <div className={styles.evidenceOverlayTitle}>Chi tiết ảnh</div>
                        <div className={styles.evidenceOverlayGrid}>
                          <div className={styles.evidenceOverlayItem}>
                            <span className={styles.evidenceOverlayKey}>Trạng thái</span>
                            <span className={styles.evidenceOverlayVal}>{uploadStatusLabel(item.upload_status)}</span>
                          </div>
                          <div className={styles.evidenceOverlayItem}>
                            <span className={styles.evidenceOverlayKey}>Độ khớp</span>
                            <span className={styles.evidenceOverlayVal}>{formatEvidenceConfidence(item.confidence_score)}</span>
                          </div>
                          <div className={styles.evidenceOverlayItem}>
                            <span className={styles.evidenceOverlayKey}>Định dạng</span>
                            <span className={styles.evidenceOverlayVal}>{item.image_format?.toUpperCase() || "—"}</span>
                          </div>
                          <div className={styles.evidenceOverlayItem}>
                            <span className={styles.evidenceOverlayKey}>Kích thước</span>
                            <span className={styles.evidenceOverlayVal}>{formatEvidenceSize(item.image_size_kb)}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div className={styles.evidenceEmpty}>
                      <div className={styles.evidenceEmptyIcon}>{item ? "🖼" : "📷"}</div>
                      <div>{item ? uploadStatusLabel(item.upload_status) : "Chưa có bản ghi evidence"}</div>
                      <div className={styles.evidenceEmptySub}>
                        {item ? "Ảnh sẽ xuất hiện ở đây khi worker upload xong." : "Ngày này chưa ghi nhận ảnh bằng chứng cho mốc này."}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className={styles.detailMetaGrid}>
              <div className={styles.detailMetaItem}>
                <div className={styles.detailMetaKey}>Trạng thái ngày công</div>
                <div className={styles.detailMetaVal}>{detailRow.absent ? "Vắng mặt" : detailRow.late ? "Đi muộn" : "Đúng giờ"}</div>
              </div>
              <div className={styles.detailMetaItem}>
                <div className={styles.detailMetaKey}>Tổng giờ làm</div>
                <div className={styles.detailMetaVal}>{formatMinutes(detailRow.working_minutes)}</div>
              </div>
              <div className={styles.detailMetaItem}>
                <div className={styles.detailMetaKey}>Tăng ca</div>
                <div className={styles.detailMetaVal}>{formatMinutes(detailRow.overtime_minutes)}</div>
              </div>
              <div className={styles.detailMetaItem}>
                <div className={styles.detailMetaKey}>Đi muộn</div>
                <div className={styles.detailMetaVal}>{detailRow.late_minutes ? `${detailRow.late_minutes} phút` : "0 phút"}</div>
              </div>
              <div className={styles.detailMetaItem}>
                <div className={styles.detailMetaKey}>Về sớm</div>
                <div className={styles.detailMetaVal}>{detailRow.early_leave_minutes ? `${detailRow.early_leave_minutes} phút` : "0 phút"}</div>
              </div>
              <div className={styles.detailMetaItem}>
                <div className={styles.detailMetaKey}>Cập nhật evidence</div>
                <div className={styles.detailMetaVal}>
                  {detailHistory.length > 0 ? formatDateTimeVi(new Date(detailHistory[detailHistory.length - 1].created_at)) : "Chưa có"}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!detailPreview}
        title={
          detailPreview ? (
            <div>
              <div className={styles.evidencePreviewTitle}>Ảnh bằng chứng</div>
              <div className={styles.evidencePreviewSub}>
                {detailPreview.label}
                {detailRow ? ` • ${detailRow.user_code || `#${detailRow.user_id}`} • ${detailRow.user_name}` : ""}
              </div>
            </div>
          ) : (
            "Ảnh bằng chứng"
          )
        }
        onClose={() => setDetailPreview(null)}
        modalClassName={styles.evidencePreviewModal}
      >
        {detailPreview ? (
          <div className={styles.evidencePreviewBody}>
            <div className={styles.evidencePreviewMeta}>
              <div className={styles.evidencePreviewChip}>{formatDateTimeVi(new Date(detailPreview.item.check_time))}</div>
              <div className={styles.evidencePreviewChip}>{uploadStatusLabel(detailPreview.item.upload_status)}</div>
              <div className={styles.evidencePreviewChip}>Độ khớp {formatEvidenceConfidence(detailPreview.item.confidence_score)}</div>
              <div className={styles.evidencePreviewChip}>{detailPreview.item.image_format?.toUpperCase() || "—"}</div>
              <div className={styles.evidencePreviewChip}>{formatEvidenceSize(detailPreview.item.image_size_kb)}</div>
            </div>
            <div className={styles.evidencePreviewImageWrap}>
              <img className={styles.evidencePreviewImage} src={detailPreview.url} alt={`${detailPreview.label} full evidence`} />
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={editOpen && !!editing}
        title={editing ? `Chỉnh giờ công • ${editing.user_name} • ${editing.date}` : "Chỉnh giờ công"}
        onClose={() => {
          setEditOpen(false);
          setEditing(null);
          setEditCheckin("");
          setEditCheckout("");
        }}
        footer={
          <div className={styles.modalFooter}>
            <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={() => setEditOpen(false)}>
              Huỷ
            </button>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              type="button"
              disabled={!editing || busy}
              onClick={async () => {
                if (!editing) return;
                try {
                  setBusy(true);
                  setError(null);
                  const updated = await upsertTimelogDay({
                    user_id: editing.user_id,
                    day: editing.date,
                    checkin_time: editCheckin ? buildIso(editing.date, editCheckin) : null,
                    checkout_time: editCheckout ? buildIso(editing.date, editCheckout) : null
                  });
                  setRows((prev) => prev.map((x) => (x.user_id === updated.user_id && x.date === updated.date ? updated : x)));
                  setEditOpen(false);
                } catch (e) {
                  setError(getApiErrorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Lưu
            </button>
          </div>
        }
      >
        <div className={styles.formGrid}>
          <div className={styles.formItem}>
            <div className={styles.filterLabel}>Giờ vào</div>
            <input className={styles.input} type="time" value={editCheckin} onChange={(e) => setEditCheckin(e.target.value)} />
          </div>
          <div className={styles.formItem}>
            <div className={styles.filterLabel}>Giờ ra</div>
            <input className={styles.input} type="time" value={editCheckout} onChange={(e) => setEditCheckout(e.target.value)} />
          </div>
        </div>
        <div className={styles.note} style={{ marginTop: 10 }}>
          Lưu ý: thao tác này sẽ ghi đè log check-in/check-out trong ngày (nếu có) và đánh dấu phương thức là Manual.
        </div>
      </Modal>
    </div>
  );
}

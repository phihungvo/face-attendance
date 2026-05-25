type Cell = string | number | null | undefined;

function escapeHtml(s?: string | number | null) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function exportExcelHtml(params: {
    filename: string; // should end with .xls
    title: string;
    meta?: Record<string, string | number | null | undefined>;
    columns: { key: string; label: string; widthPx?: number; align?: "left" | "center" | "right" }[];
    rows: Record<string, Cell>[];
}) {
    const {filename, title, meta, columns, rows} = params;

    const metaRows = meta
        ? Object.entries(meta)
            .filter(([, v]) => v != null && String(v).trim() !== "")
            .map(([k, v]) => `<tr><td class="metaKey">${escapeHtml(k)}</td><td colspan="${columns.length - 1}" class="metaVal">${escapeHtml(String(v ?? ""))}</td></tr>`)
            .join("")
        : "";

    const colgroup = `<colgroup>${columns.map((c) => `<col style="width:${c.widthPx ?? 140}px" />`).join("")}</colgroup>`;
    const thead = `<thead><tr>${columns.map((c) => `<th class="th ${c.align ? `a_${c.align}` : ""}">${escapeHtml(c.label)}</th>`).join("")}</tr></thead>`;
    const tbody = `<tbody>${rows
        .map((r) => `<tr>${columns.map((c) => `<td class="td ${c.align ? `a_${c.align}` : ""}">${escapeHtml(String(r[c.key] ?? ""))}</td>`).join("")}</tr>`)
        .join("")}</tbody>`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Calibri, Arial, sans-serif; }
    table { border-collapse: collapse; }
    .title { font-size: 16px; font-weight: 800; padding: 10px 8px; }
    .metaKey { font-weight: 700; background: #f6f7fb; border: 1px solid #e6e8f0; padding: 6px 8px; }
    .metaVal { border: 1px solid #e6e8f0; padding: 6px 8px; }
    .th { background: #111827; color: #fff; font-weight: 800; border: 1px solid #2b3346; padding: 8px 10px; }
    .td { border: 1px solid #e6e8f0; padding: 7px 10px; vertical-align: top; }
    .a_left { text-align: left; }
    .a_center { text-align: center; }
    .a_right { text-align: right; }
  </style>
</head>
<body>
  <table>
    <tr><td class="title" colspan="${columns.length}">${escapeHtml(title)}</td></tr>
    ${metaRows}
  </table>
  <br />
  <table>
    ${colgroup}
    ${thead}
    ${tbody}
  </table>
</body>
</html>`;

    const blob = new Blob([html], {type: "application/vnd.ms-excel;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
    a.click();
    URL.revokeObjectURL(url);
}

export function exportTimelogExcel({
                                       rows,
                                       fromDate,
                                       toDate,
                                       departmentName,
                                       statusFilter,
                                       summary,
                                   }: {
    rows: any[];
    fromDate: string;
    toDate: string;
    departmentName: string;
    statusFilter: string;
    summary: { totalEmployees: number; totalHours: number; lateDays: number; absentDays: number };
}) {
    const today = new Date().toLocaleDateString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric"
    });

    const toHm = (iso?: string | null): string => {
        if (!iso) return "";
        const d = new Date(iso);
        const h = String(d.getHours()).padStart(2, "0");
        const m = String(d.getMinutes()).padStart(2, "0");
        return `${h}:${m}`;
    };

    // Sort & Group
    const sorted = [...rows].sort((a, b) => {
        const nameA = (a.user_name ?? "").localeCompare(b.user_name ?? "", "vi");
        if (nameA !== 0) return nameA;
        return (a.date ?? "").localeCompare(b.date ?? "");
    });

    const groupMap = new Map<number, any>();
    for (const r of sorted) {
        if (!groupMap.has(r.user_id)) {
            groupMap.set(r.user_id, {
                user_code: r.user_code || `#${r.user_id}`,
                user_name: r.user_name,
                department_name: r.department_name || "—",
                rows: [] as any[],
            });
        }
        groupMap.get(r.user_id)!.rows.push(r);
    }
    const groups = [...groupMap.values()];

    const exportRows: any[] = [];
    for (const g of groups) {
        exportRows.push({
            _type: "header",
            user_name: `${g.user_code} • ${g.user_name}`,
            department_name: g.department_name,
            method: `${g.rows.length} ngày công`,
        });

        for (const r of g.rows) {
            const st = r.absent ? "Vắng" : r.late ? "Muộn" : "Đúng giờ";
            exportRows.push({
                _type: "data",
                user_code: r.user_code || `#${r.user_id}`,
                user_name: r.user_name,
                department_name: r.department_name || "—",
                date: r.date,
                checkin: toHm(r.checkin_time),
                checkout: toHm(r.checkout_time),
                work_hours: Number.isFinite(r.work_hours) ? Math.round((r.work_hours ?? 0) * 100) / 100 : 0,
                status: st,
                method: r.method || "Face+GPS",
            });
        }

        const totalHours = g.rows.reduce((sum: number, r: any) => sum + (Number(r.work_hours) || 0), 0);
        const lateCount = g.rows.filter((r: any) => r.late).length;
        const absentCount = g.rows.filter((r: any) => r.absent).length;

        exportRows.push({
            _type: "subtotal",
            user_name: "TỔNG CỘNG",
            date: `${g.rows.length} ngày`,
            work_hours: Math.round(totalHours * 100) / 100,
            status: lateCount ? `Muộn: ${lateCount}` : "—",
            method: absentCount ? `Vắng: ${absentCount}` : "—",
        });

        exportRows.push({_type: "blank"});
    }

    const COLS = [
        {key: "user_code", label: "Mã NV", widthPx: 100, align: "center" as const},
        {key: "user_name", label: "Nhân viên", widthPx: 220},
        {key: "department_name", label: "Phòng ban", widthPx: 170},
        {key: "date", label: "Ngày", widthPx: 110, align: "center" as const},
        {key: "checkin", label: "Giờ vào", widthPx: 90, align: "center" as const},
        {key: "checkout", label: "Giờ ra", widthPx: 90, align: "center" as const},
        {key: "work_hours", label: "Giờ làm", widthPx: 90, align: "right" as const},
        {key: "status", label: "Trạng thái", widthPx: 120, align: "center" as const},
        {key: "method", label: "Phương thức", widthPx: 110, align: "center" as const},
    ];

    const colCount = COLS.length + 1;

    const metaData: [string, string][] = [
        ["Ngày xuất dữ liệu", today],
        ["Người xuất dữ liệu", "Hùng"],
        ["Từ ngày", fromDate],
        ["Đến ngày", toDate],
        ["Phòng ban", departmentName],
        ["Trạng thái", statusFilter || "Tất cả"],
        ["Tổng nhân viên", String(summary.totalEmployees)],
        ["Tổng giờ", String(summary.totalHours)],
        ["Đi trễ", String(summary.lateDays)],
        ["Vắng", String(summary.absentDays)],
    ];

    const freezeAt = 2 + metaData.length + 1;

    const colgroupHtml = [`<col style="width:52px"/>`, ...COLS.map(c => `<col style="width:${c.widthPx}px"/>`)].join("");

    const metaHtml = metaData.map(([k, v]) => `
        <tr>
            <td colspan="${colCount}" class="meta-row">
                <span class="meta-key">${escapeHtml(k)}:</span>&nbsp;${escapeHtml(v)}
            </td>
        </tr>
    `).join("");

    let dataIdx = 0;
    const tbodyHtml = exportRows.map((r: any) => {
        if (r._type === "header") {
            return `<tr><td colspan="${colCount}" style="background:#1e3a8a;color:#fff;font-size:11.5pt;font-weight:800;padding:9px 12px;border:1.5px solid #1a3a5c;">
                ${escapeHtml(r.user_name)} &nbsp; <span style="font-weight:500;opacity:0.9;">(${escapeHtml(r.department_name)}) • ${escapeHtml(r.method)}</span>
            </td></tr>`;
        }
        if (r._type === "subtotal") {
            return `<tr>
                <td style="background:#dbeafe;color:#1e3a8a;font-weight:700;padding:8px 10px;border:1px solid #93c5fd;text-align:center;">∑</td>
                ${COLS.map(c => {
                const align = c.align || "left";
                return `<td style="background:#dbeafe;color:#1e3a8a;font-weight:700;padding:8px 10px;border:1px solid #93c5fd;text-align:${align};">${escapeHtml(r[c.key])}</td>`;
            }).join("")}
            </tr>`;
        }
        if (r._type === "blank") {
            return `<tr><td colspan="${colCount}" style="background:#f0f6fd;height:18px;border:none;"></td></tr>`;
        }

        dataIdx++;
        const rowBg = dataIdx % 2 === 0 ? "#f0f6fd" : "#ffffff";
        const statusRaw = String(r.status || "");
        const statusStyle = statusRaw === "Vắng" ? "background:#f8d7da;color:#721c24;font-weight:700;" :
            statusRaw === "Muộn" ? "background:#fff7ed;color:#9a3412;font-weight:700;" :
                "background:#d4edda;color:#155724;font-weight:700;";

        return `<tr>
            <td style="background:${rowBg};text-align:center;padding:7px 8px;border:1px solid #b8cfe8;font-size:10.5pt;">${dataIdx}</td>
            ${COLS.map(c => {
            const align = c.align || "left";
            const extra = c.key === "status" ? statusStyle : "";
            return `<td style="background:${rowBg};text-align:${align};padding:7px 8px;border:1px solid #b8cfe8;font-size:10.5pt;${extra}">${escapeHtml(r[c.key])}</td>`;
        }).join("")}
        </tr>`;
    }).join("");

    const grandTotalHours = exportRows
        .filter((r: any) => r._type === "subtotal")
        .reduce((sum: number, r: any) => sum + (Number(r.work_hours) || 0), 0);

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <!--[if gte mso 9]><xml>
    <x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
      <x:Name>Bảng giờ công</x:Name>
      <x:WorksheetOptions>
        <x:Print><x:Orientation>Landscape</x:Orientation><x:PaperSize>9</x:PaperSize></x:Print>
        <x:FreezePanes/><x:FrozenNoSplit/>
        <x:SplitHorizontal>${freezeAt}</x:SplitHorizontal>
        <x:TopRowBottomPane>${freezeAt}</x:TopRowBottomPane>
        <x:ActivePane>2</x:ActivePane>
      </x:WorksheetOptions>
    </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
  </xml><![endif]-->
  <style>
    @page { size: A4 landscape; margin: 1.5cm 1cm; }
    * { font-family: "Times New Roman", serif; box-sizing: border-box; }
    body { margin:0; padding:0; }
    table { border-collapse: collapse; width: 100%; }
    .title-row { background:#1a3a5c; color:#fff; font-size:18pt; font-weight:900; text-align:center; padding:14px 12px; letter-spacing:1px; border:2px solid #1a3a5c; }
    .meta-row { background:#eef4fb; font-size:11pt; padding:6px 12px; border:1px solid #b8cfe8; }
    .meta-key { font-weight:800; color:#1a3a5c; }
    .th { background:#2563a8; color:#fff; font-size:11pt; font-weight:700; padding:9px 10px; border:1.5px solid #1a3a5c; text-align:center; white-space:nowrap; }
  </style>
</head>
<body>
  <table>
    <colgroup>${colgroupHtml}</colgroup>
    <thead>
      <tr><td colspan="${colCount}" class="title-row">BẢNG GIỜ CÔNG NHÂN VIÊN TỪ NGÀY ${fromDate} ĐẾN NGÀY ${toDate}</td></tr>
      <tr><td colspan="${colCount}" style="background:#1a3a5c;border:2px solid #1a3a5c;font-size:1pt;">&nbsp;</td></tr>
      ${metaHtml}
      <tr><th class="th">STT</th>${COLS.map(c => `<th class="th">${escapeHtml(c.label)}</th>`).join("")}</tr>
    </thead>
    <tbody>${tbodyHtml}</tbody>
    <tfoot>
      <tr>
        <td colspan="${colCount}" style="background:#1a3a5c;color:#fff;font-size:11.5pt;font-weight:700;padding:10px 12px;text-align:right;border:1.5px solid #1a3a5c;">
          TỔNG CỘNG: ${Math.round(grandTotalHours * 100) / 100} giờ &nbsp;|&nbsp; Muộn: ${summary.lateDays} &nbsp;|&nbsp; Vắng: ${summary.absentDays}
        </td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;

    const blob = new Blob(["\uFEFF" + html], {type: "application/vnd.ms-excel;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timelog_${fromDate}_${toDate}.xls`;
    a.click();
    URL.revokeObjectURL(url);
}
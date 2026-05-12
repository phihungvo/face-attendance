type Cell = string | number | null | undefined;

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function exportExcelHtml(params: {
  filename: string; // should end with .xls
  title: string;
  meta?: Record<string, string | number | null | undefined>;
  columns: { key: string; label: string; widthPx?: number; align?: "left" | "center" | "right" }[];
  rows: Record<string, Cell>[];
}) {
  const { filename, title, meta, columns, rows } = params;

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

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}


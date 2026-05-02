import { useMemo, useState } from "react";
import Card from "../../components/Card/Card";
import Table from "../../components/Table/Table";
import { mockLeave } from "../../../shared/mock/mockData";
import styles from "./LeavePage.module.scss";

export default function LeavePage() {
  const [status, setStatus] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const rows = useMemo(() => {
    if (status === "all") return mockLeave.rows;
    return mockLeave.rows.filter((r) => r.statusKey === status);
  }, [status]);

  return (
    <div className={styles.page}>
      <div className={styles.grid2}>
        <Card title="🌴 Trạng thái duyệt" sub="Tổng quan">
          <div className={styles.kpis}>
            {mockLeave.kpis.map((k) => (
              <div key={k.label} className={styles.kpi}>
                <div className={styles.kpiLabel}>{k.label}</div>
                <div className={styles.kpiValue}>{k.value}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="🧾 Quy tắc" sub="Gợi ý xử lý đơn">
          <div className={styles.warningBox}>Đơn nghỉ phép cần đối chiếu bảng giờ công và chính sách nội bộ trước khi duyệt.</div>
        </Card>
      </div>

      <Card
        title="🌴 Đơn nghỉ phép"
        sub="Mock data hiển thị UI theo template"
        right={
          <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Từ chối</option>
            <option value="all">Tất cả</option>
          </select>
        }
      >
        <Table>
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Loại</th>
              <th>Thời gian</th>
              <th>Lý do</th>
              <th>Trạng thái</th>
              <th style={{ width: 140 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={styles.empCell}>
                  <span className={styles.empAvatar}>{r.initials}</span>
                  <span className={styles.empMain}>
                    <span className={styles.empName}>{r.name}</span>
                    <span className={styles.empSub}>{r.code}</span>
                  </span>
                </td>
                <td>{r.type}</td>
                <td className={styles.mono}>{r.range}</td>
                <td className={styles.muted}>{r.reason}</td>
                <td>
                  <span className={r.tone === "warn" ? `${styles.tag} ${styles.warn}` : r.tone === "good" ? `${styles.tag} ${styles.good}` : `${styles.tag} ${styles.bad}`}>
                    {r.status}
                  </span>
                </td>
                <td>
                  <div className={styles.rowActions}>
                    <button className={`${styles.actionBtn} ${styles.ok}`} type="button">
                      Duyệt
                    </button>
                    <button className={`${styles.actionBtn} ${styles.no}`} type="button">
                      Từ chối
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}


import Card from "../../components/Card/Card";
import Table from "../../components/Table/Table";
import { mockOvertime } from "../../../shared/mock/mockData";
import styles from "./OvertimePage.module.scss";

export default function OvertimePage() {
  return (
    <div className={styles.page}>
      <div className={styles.grid2}>
        <Card title="⏰ Tổng quan tăng ca" sub="Tháng hiện tại">
          <div className={styles.kpis}>
            {mockOvertime.kpis.map((k) => (
              <div key={k.label} className={styles.kpi}>
                <div className={styles.kpiLabel}>{k.label}</div>
                <div className={styles.kpiValue}>{k.value}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="🧾 Ghi chú" sub="Quy trình duyệt OT">
          <div className={styles.infoBox}>OT nên duyệt theo ca/đơn vị và đối chiếu bảng giờ công trước khi chốt lương.</div>
        </Card>
      </div>

      <Card title="⏰ Danh sách yêu cầu OT" sub="Mock data">
        <Table>
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Phòng ban</th>
              <th>Ngày</th>
              <th>Số giờ</th>
              <th>Lý do</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {mockOvertime.rows.map((r) => (
              <tr key={r.id}>
                <td className={styles.empCell}>
                  <span className={styles.empAvatar}>{r.initials}</span>
                  <span className={styles.empName}>{r.name}</span>
                </td>
                <td>{r.dept}</td>
                <td className={styles.mono}>{r.date}</td>
                <td className={styles.mono}>{r.hours}</td>
                <td className={styles.muted}>{r.reason}</td>
                <td>
                  <span className={r.tone === "good" ? `${styles.tag} ${styles.good}` : `${styles.tag} ${styles.warn}`}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}


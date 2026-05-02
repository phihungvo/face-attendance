import Card from "../../components/Card/Card";
import Table from "../../components/Table/Table";
import { mockPayroll } from "../../../shared/mock/mockData";
import styles from "./PayrollPage.module.scss";

export default function PayrollPage() {
  return (
    <div className={styles.page}>
      <Card
        title="💰 Bảng lương (mẫu)"
        sub="Tổng hợp từ giờ công + OT + nghỉ phép"
        right={
          <button className={styles.btnGhost} type="button">
            ⬇️ Xuất file
          </button>
        }
      >
        <div className={styles.chips}>
          <div className={styles.chip}>📅 Tháng {mockPayroll.month}</div>
          <div className={styles.chip}>👥 {mockPayroll.totalEmployees} nhân viên</div>
          <div className={styles.chip}>💸 Quỹ lương {mockPayroll.totalPayroll}</div>
        </div>
      </Card>

      <Card title="📄 Chi tiết" sub="Mock data hiển thị UI theo template">
        <Table>
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Mã</th>
              <th>Lương cơ bản</th>
              <th>Giờ công</th>
              <th>OT</th>
              <th>Khấu trừ</th>
              <th>Thực nhận</th>
            </tr>
          </thead>
          <tbody>
            {mockPayroll.rows.map((r) => (
              <tr key={r.code}>
                <td className={styles.empCell}>
                  <span className={styles.empAvatar}>{r.initials}</span>
                  <span className={styles.empName}>{r.name}</span>
                </td>
                <td className={styles.mono}>{r.code}</td>
                <td>{r.base}</td>
                <td className={styles.mono}>{r.hours}</td>
                <td className={styles.mono}>{r.ot}</td>
                <td className={styles.muted}>{r.deduct}</td>
                <td>
                  <span className={`${styles.tag} ${styles.good}`}>{r.net}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}


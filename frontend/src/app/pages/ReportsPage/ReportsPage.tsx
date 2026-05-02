import Card from "../../components/Card/Card";
import StatCard from "../../components/StatCard/StatCard";
import Table from "../../components/Table/Table";
import { mockReports } from "../../../shared/mock/mockData";
import styles from "./ReportsPage.module.scss";

export default function ReportsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.statsGrid}>
        {mockReports.stats.map((s) => (
          <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} delta={s.delta} />
        ))}
      </div>

      <div className={styles.grid2}>
        <Card title="📈 Xu hướng đi trễ 7 ngày" sub="Mock chart bar">
          <div className={styles.chartBars}>
            {mockReports.lateTrend7d.map((d) => (
              <div key={d.label} className={styles.barCol}>
                <div className={styles.bar} style={{ height: `${Math.max(10, d.value)}%` }} />
                <div className={styles.barLabel}>{d.label}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="🧠 Insight" sub="Gợi ý từ dữ liệu">
          <div className={styles.insights}>
            {mockReports.insights.map((i) => (
              <div key={i.id} className={styles.insightItem}>
                <div className={styles.insightIcon}>{i.icon}</div>
                <div>
                  <div className={styles.insightTitle}>{i.title}</div>
                  <div className={styles.insightSub}>{i.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="📋 Top phòng ban" sub="Theo tỉ lệ đúng giờ">
        <Table>
          <thead>
            <tr>
              <th>Phòng ban</th>
              <th>Nhân sự</th>
              <th>Đúng giờ</th>
              <th>Đi trễ</th>
              <th>Vắng</th>
            </tr>
          </thead>
          <tbody>
            {mockReports.deptTable.map((r) => (
              <tr key={r.dept}>
                <td className={styles.deptCell}>
                  <span className={styles.deptIcon}>{r.icon}</span>
                  <span className={styles.deptName}>{r.dept}</span>
                </td>
                <td>{r.headcount}</td>
                <td>
                  <span className={`${styles.tag} ${styles.good}`}>{r.ontime}%</span>
                </td>
                <td>
                  <span className={`${styles.tag} ${styles.warn}`}>{r.late}%</span>
                </td>
                <td>
                  <span className={`${styles.tag} ${styles.bad}`}>{r.absent}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}


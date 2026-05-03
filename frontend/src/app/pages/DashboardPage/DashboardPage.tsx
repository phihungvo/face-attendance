import Card from "../../components/Card/Card";
import StatCard from "../../components/StatCard/StatCard";
import Table from "../../components/Table/Table";
import { mockDashboard } from "../../../shared/mock/mockData";
import styles from "./DashboardPage.module.scss";

export default function DashboardPage() {
  return (
    <div className={styles.page}>
      <div className={styles.statsGrid}>
        {mockDashboard.stats.map((s) => (
          <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} delta={s.delta} variant={s.variant} />
        ))}
      </div>

      <div className={styles.grid2}>
        <Card title="📊 Tỉ lệ chấm công 7 ngày" sub="% nhân viên có mặt theo ngày">
          <div className={styles.chartBars}>
            {mockDashboard.attendance7d.map((d) => (
              <div key={d.label} className={styles.barCol}>
                <div className={styles.bar} style={{ height: `${Math.round(d.value)}%` }} />
                <div className={styles.barLabel}>{d.label}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="🔔 Hoạt động gần đây">
          <div className={styles.feed}>
            {mockDashboard.activity.map((a) => (
              <div key={a.id} className={styles.feedItem}>
                <div className={styles.feedIcon}>{a.icon}</div>
                <div className={styles.feedMain}>
                  <div className={styles.feedTitle}>{a.title}</div>
                  <div className={styles.feedSub}>
                    {a.sub} • {a.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className={styles.grid2}>
        <Card title="🌴 Đơn nghỉ phép chờ duyệt" sub="3 đơn đang chờ xử lý" right={<button className={styles.ghostBtn}>Xem tất cả</button>}>
          <div className={styles.list}>
            {mockDashboard.pendingLeaves.map((l) => (
              <div key={l.id} className={styles.listRow}>
                <div className={styles.listAvatar}>{l.initials}</div>
                <div className={styles.listMain}>
                  <div className={styles.listTitle}>{l.name}</div>
                  <div className={styles.listSub}>
                    {l.type} • {l.range}
                  </div>
                </div>
                <div className={styles.listTag}>{l.status}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="📅 Lịch tháng này">
          <div className={styles.calendarGrid}>
            {mockDashboard.miniCalendar.map((d) => (
              <div key={d.label} className={d.muted ? `${styles.calCell} ${styles.muted}` : styles.calCell}>
                {d.label}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="👤 Nhân viên vừa chấm công" sub="Cập nhật thời gian thực" right={<button className={styles.ghostBtn}>Xem hết</button>}>
        <Table>
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Phòng ban</th>
              <th>Ca làm</th>
              <th>Giờ vào</th>
              <th>Trạng thái</th>
              <th>Thiết bị</th>
            </tr>
          </thead>
          <tbody>
            {mockDashboard.recentCheckins.map((r) => (
              <tr key={r.id}>
                <td className={styles.employeeCell}>
                  <span className={styles.empAvatar}>{r.initials}</span>
                  <span className={styles.empText}>
                    <span className={styles.empName}>{r.name}</span>
                    <span className={styles.empCode}>{r.code}</span>
                  </span>
                </td>
                <td>{r.dept}</td>
                <td>{r.shift}</td>
                <td>{r.inTime}</td>
                <td>
                  <span className={r.statusTone === "good" ? `${styles.status} ${styles.good}` : `${styles.status} ${styles.warn}`}>
                    {r.status}
                  </span>
                </td>
                <td>{r.device}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  ApartmentOutlined,
  AuditOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FieldTimeOutlined,
  LoginOutlined,
  LogoutOutlined,
  NumberOutlined,
  RiseOutlined,
  TeamOutlined
} from "@ant-design/icons";
import Card from "../../components/Card/Card";
import {
  getManagerDashboardSummary,
  type ManagerDashboardSummary,
  type ManagerDashboardTrendPoint
} from "../../../shared/api/attendance";
import { viStatusLabel } from "../../../shared/i18n/vi";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import styles from "./DashboardPage.module.scss";

const LEAVE_TYPE_VI: Record<string, string> = {
  annual: "Nghỉ phép năm",
  sick: "Nghỉ ốm",
  unpaid: "Nghỉ không lương",
  personal: "Nghỉ cá nhân"
};

function formatDate(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function leaveTypeVi(type: string) {
  return LEAVE_TYPE_VI[type] ?? type;
}

function attendanceTypeVi(type: "checkin" | "checkout") {
  return type === "checkin" ? "Vào ca" : "Ra ca";
}

function attendanceIcon(type: "checkin" | "checkout") {
  return type === "checkin" ? <LoginOutlined /> : <LogoutOutlined />;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  return parts
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function averageRate(items: ManagerDashboardTrendPoint[]) {
  if (!items.length) return 0;
  return Math.round((items.reduce((sum, item) => sum + item.attendance_rate, 0) / items.length) * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ManagerDashboardSummary | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const summary = await getManagerDashboardSummary();
        if (!mounted) return;
        setData(summary);
      } catch (e) {
        if (!mounted) return;
        setError(getApiErrorMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const today = data?.today;
  const trend = data?.trend ?? [];
  const pendingLeaves = data?.pending_leaves ?? [];
  const recentLogs = data?.recent_logs ?? [];

  const averageAttendance = useMemo(() => averageRate(trend), [trend]);
  const chartGeometry = useMemo(() => {
    if (!trend.length) return null;

    const width = 640;
    const height = 260;
    const padLeft = 28;
    const padRight = 20;
    const padTop = 18;
    const padBottom = 34;
    const values = trend.map((item) => item.attendance_rate);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const lower = clamp(Math.floor((rawMin - 8) / 5) * 5, 0, 100);
    const upper = clamp(Math.ceil((rawMax + 8) / 5) * 5, 20, 100);
    const range = Math.max(upper - lower, 12);
    const usableWidth = width - padLeft - padRight;
    const usableHeight = height - padTop - padBottom;
    const stepX = trend.length > 1 ? usableWidth / (trend.length - 1) : 0;

    const points = trend.map((item, index) => {
      const x = padLeft + stepX * index;
      const normalized = (item.attendance_rate - lower) / range;
      const y = height - padBottom - normalized * usableHeight;
      return { ...item, x, y };
    });

    const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padBottom} L ${points[0].x} ${height - padBottom} Z`;
    const gridValues = [upper, lower + range * 0.66, lower + range * 0.33, lower].map((value) => Math.round(value));

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      lower,
      upper,
      usableHeight,
      points,
      linePath,
      areaPath,
      gridValues
    };
  }, [trend]);
  const latestTrend = trend[trend.length - 1] ?? null;
  const previousTrend = trend[trend.length - 2] ?? null;
  const trendDelta =
    latestTrend && previousTrend ? Math.round((latestTrend.attendance_rate - previousTrend.attendance_rate) * 10) / 10 : null;

  const statCards = [
    {
      key: "total",
      label: "Nhân sự",
      value: today?.total_users ?? 0,
      icon: <TeamOutlined />,
      metaLabel: "Ngày",
      meta: today ? formatDate(today.day) : "--",
      metaIcon: <CalendarOutlined />,
      tone: "blue"
    },
    {
      key: "present",
      label: "Có mặt",
      value: today?.present_count ?? 0,
      icon: <CheckCircleOutlined />,
      metaLabel: "Tỷ lệ",
      meta: today ? `${today.attendance_rate}%` : "--",
      metaIcon: <RiseOutlined />,
      tone: "green"
    },
    {
      key: "late",
      label: "Muộn",
      value: today?.late_count ?? 0,
      icon: <ClockCircleOutlined />,
      metaLabel: "Vắng",
      meta: today ? `${today.absent_count}` : "--",
      metaIcon: <TeamOutlined />,
      tone: "amber"
    },
    {
      key: "leave",
      label: "Chờ duyệt",
      value: data?.leave_summary.pending_count ?? 0,
      icon: <AuditOutlined />,
      metaLabel: "Đã duyệt",
      meta: data ? `${data.leave_summary.approved_count}` : "--",
      metaIcon: <CheckCircleOutlined />,
      tone: "rose"
    }
  ] as const;

  return (
    <div className={styles.page}>
      {error ? <div className={styles.errorBox}>{error}</div> : null}

      <section className={styles.statsGrid}>
        {statCards.map((item) => (
          <article
            key={item.key}
            className={`${styles.statCard} ${styles[`tone${item.tone[0].toUpperCase()}${item.tone.slice(1)}`]}`}
            title={item.label}
            aria-label={`${item.label}: ${item.value}`}
          >
            <div className={styles.statHead}>
              <div className={styles.statIcon}>{item.icon}</div>
              <div className={styles.statHint} title={item.label}>
                {item.metaIcon}
                <span>{item.metaLabel}</span>
                <strong>{item.meta}</strong>
              </div>
            </div>
            <div className={styles.statValue}>{loading && !data ? "..." : item.value}</div>
            <div className={styles.statLabel}>{item.label}</div>
          </article>
        ))}
      </section>

      <section className={styles.mainGrid}>
        <Card
          title={
            <span className={styles.sectionTitle} title="Xu hướng 7 ngày" aria-label="Xu hướng 7 ngày">
              <BarChartOutlined />
              <span>Xu hướng 7 ngày</span>
            </span>
          }
          right={<span className={styles.softBadge} title="Trung bình 7 ngày">{averageAttendance}%</span>}
        >
          <div className={styles.chartLayout}>
            <div className={styles.chartPanel}>
              {chartGeometry ? (
                <>
                  <div className={styles.chartSummary}>
                    <div className={styles.chartSummaryMain}>
                      <div className={styles.chartSummaryValue}>{Math.round(latestTrend?.attendance_rate ?? averageAttendance)}%</div>
                      <div className={styles.chartSummaryText}>
                        <span>{latestTrend?.label ?? "Hôm nay"}</span>
                        <strong>{latestTrend ? formatDate(latestTrend.day) : "--"}</strong>
                      </div>
                    </div>
                    <div className={styles.chartSummarySide}>
                      <span className={styles.summaryPill}>
                        <CheckCircleOutlined />
                        {latestTrend?.present_count ?? 0}
                      </span>
                      <span className={styles.summaryPill}>
                        <ClockCircleOutlined />
                        {latestTrend?.late_count ?? 0}
                      </span>
                      {trendDelta != null ? (
                        <span className={styles.summaryPill}>
                          <RiseOutlined />
                          {trendDelta > 0 ? "+" : ""}
                          {trendDelta}%
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.chartCanvas}>
                    <div className={styles.chartYAxis}>
                      {chartGeometry.gridValues.map((value, index) => (
                        <span key={`${value}-${index}`}>{value}%</span>
                      ))}
                    </div>

                    <svg
                      className={styles.chartSvg}
                      viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
                      role="img"
                      aria-label="Biểu đồ tỷ lệ hiện diện 7 ngày"
                    >
                      <defs>
                        <linearGradient id="dashboardTrendArea" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="rgba(22, 119, 255, 0.28)" />
                          <stop offset="100%" stopColor="rgba(20, 184, 166, 0.02)" />
                        </linearGradient>
                        <linearGradient id="dashboardTrendLine" x1="0" x2="1" y1="0" y2="0">
                          <stop offset="0%" stopColor="#1677ff" />
                          <stop offset="100%" stopColor="#14b8a6" />
                        </linearGradient>
                      </defs>

                      {chartGeometry.gridValues.map((value, index) => {
                        const y =
                          chartGeometry.height -
                          chartGeometry.padBottom -
                          ((value - chartGeometry.lower) / Math.max(chartGeometry.upper - chartGeometry.lower, 1)) *
                            chartGeometry.usableHeight;
                        return (
                          <line
                            key={`${value}-${index}`}
                            x1={chartGeometry.padLeft}
                            y1={y}
                            x2={chartGeometry.width - chartGeometry.padRight}
                            y2={y}
                            className={styles.chartGridLine}
                          />
                        );
                      })}

                      <path d={chartGeometry.areaPath} className={styles.chartArea} />
                      <path d={chartGeometry.linePath} className={styles.chartLine} />

                      {chartGeometry.points.map((point) => (
                        <g key={point.day}>
                          <circle cx={point.x} cy={point.y} r="6" className={styles.chartPointOuter} />
                          <circle cx={point.x} cy={point.y} r="3.5" className={styles.chartPointInner} />
                        </g>
                      ))}
                    </svg>
                  </div>

                  <div className={styles.chartAxisRow}>
                    {chartGeometry.points.map((point) => (
                      <div key={point.day} className={styles.chartAxisItem}>
                        <strong>{point.label}</strong>
                        <span>{formatDate(point.day)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className={styles.emptyState}>Chưa có dữ liệu xu hướng để hiển thị.</div>
              )}
            </div>

            <div className={styles.sideMetrics}>
              <div className={styles.metricCard} title="Trung bình 7 ngày">
                <span className={styles.metricIcon}>
                  <BarChartOutlined />
                </span>
                <span className={styles.metricLabel}>Trung bình</span>
                <strong className={styles.metricValue}>{averageAttendance}%</strong>
                <span className={styles.metricSub}>{trend.length} ngày gần nhất</span>
              </div>
              <div className={styles.metricCard} title="Đang trong ca">
                <span className={styles.metricIcon}>
                  <FieldTimeOutlined />
                </span>
                <span className={styles.metricLabel}>Đang trong ca</span>
                <strong className={styles.metricValue}>{today?.working_count ?? 0}</strong>
                <span className={styles.metricSub}>{today?.checked_out_count ?? 0} đã ra ca</span>
              </div>
              <div className={styles.metricCard} title="Đơn chờ duyệt">
                <span className={styles.metricIcon}>
                  <AuditOutlined />
                </span>
                <span className={styles.metricLabel}>Chờ duyệt</span>
                <strong className={styles.metricValue}>{data?.leave_summary.pending_count ?? 0}</strong>
                <span className={styles.metricSub}>{data?.leave_summary.approved_count ?? 0} đã duyệt</span>
              </div>
            </div>
          </div>
        </Card>

        <Card
          title={
            <span className={styles.sectionTitle} title="Đơn nghỉ phép" aria-label="Đơn nghỉ phép">
              <AuditOutlined />
              <span>Đơn nghỉ phép</span>
            </span>
          }
          right={<span className={styles.softBadge}>{data?.leave_summary.pending_count ?? 0}</span>}
        >
          <div className={styles.leaveList}>
            {pendingLeaves.map((item) => (
              <div key={item.id} className={styles.leaveRow}>
                <div className={styles.leaveAvatar}>{getInitials(item.user_name)}</div>
                <div className={styles.leaveMain}>
                  <div className={styles.leaveTop}>
                    <strong>{item.user_name}</strong>
                    <span className={styles.iconBadge} title={viStatusLabel(item.status)} aria-label={viStatusLabel(item.status)}>
                      <AuditOutlined />
                    </span>
                  </div>
                  <div className={styles.leaveSub}>
                    <span className={styles.metaPill} title={leaveTypeVi(item.type)}>
                      <CalendarOutlined />
                    </span>
                    <span className={styles.metaPill} title="Thời gian nghỉ">
                      <CalendarOutlined />
                      {formatDate(item.start_date)} - {formatDate(item.end_date)}
                    </span>
                  </div>
                  <div className={styles.leaveMeta}>
                    <span className={styles.metaPill} title="Mã nhân viên">
                      <NumberOutlined />
                      {item.user_code ? item.user_code : "--"}
                    </span>
                    <span className={styles.metaPill} title="Phòng ban">
                      <ApartmentOutlined />
                      {item.department_name || "--"}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {!loading && pendingLeaves.length === 0 ? <div className={styles.emptyState}>Không có đơn nghỉ phép chờ duyệt.</div> : null}
          </div>
        </Card>

        <Card
          title={
            <span className={styles.sectionTitle} title="Chấm công gần nhất" aria-label="Chấm công gần nhất">
              <FieldTimeOutlined />
              <span>Chấm công gần đây</span>
            </span>
          }
          right={<span className={styles.softBadge}>{recentLogs.length}</span>}
        >
          <div className={styles.activityList}>
            {recentLogs.map((item) => (
              <div key={item.id} className={styles.activityRow}>
                <div className={styles.activityAvatar}>{getInitials(item.user_name)}</div>
                <div className={styles.activityMain}>
                  <div className={styles.activityTop}>
                    <strong>{item.user_name}</strong>
                    <span className={styles.activityTime} title="Thời gian">
                      <ClockCircleOutlined />
                      {formatDateTime(item.timestamp)}
                    </span>
                  </div>
                  <div className={styles.activitySub}>
                    <span className={styles.metaPill} title={attendanceTypeVi(item.type)}>
                      {attendanceIcon(item.type)}
                    </span>
                    <span className={styles.metaPill} title="Mã nhân viên">
                      <NumberOutlined />
                      {item.user_code ? item.user_code : "--"}
                    </span>
                    <span className={styles.metaPill} title="Độ tin cậy">
                      <CheckCircleOutlined />
                      {item.confidence.toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {!loading && recentLogs.length === 0 ? <div className={styles.emptyState}>Chưa có log chấm công gần đây.</div> : null}
          </div>
        </Card>
      </section>
    </div>
  );
}

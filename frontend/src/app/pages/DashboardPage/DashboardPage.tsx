import { useEffect, useMemo, useState } from "react";
import {
  ApartmentOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  AuditOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
  FireOutlined,
  InfoCircleOutlined,
  LoginOutlined,
  LogoutOutlined,
  NumberOutlined,
  RiseOutlined,
  TeamOutlined,
  WarningOutlined
} from "@ant-design/icons";
import Card from "../../components/Card/Card";
import {
  getManagerDashboardSummary,
  type ManagerDashboardDepartmentRow,
  type ManagerDashboardSummary,
  type ManagerDashboardTrendPoint
} from "../../../shared/api/attendance";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import styles from "./DashboardPage.module.scss";

const LEAVE_TYPE_VI: Record<string, string> = {
  annual: "Nghỉ phép năm",
  sick: "Nghỉ ốm",
  unpaid: "Nghỉ không lương",
  personal: "Nghỉ cá nhân"
};

type DashboardAlertTone = "danger" | "warn" | "info" | "good";

type DashboardAlert = {
  key: string;
  title: string;
  sub: string;
  tone: DashboardAlertTone;
  icon: React.ReactNode;
};

function formatDate(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function formatLongDate(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
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

function absenceRate(total: number, absent: number) {
  if (!total) return 0;
  return Math.round((absent / total) * 100 * 10) / 10;
}

function queueAge(createdAt: string) {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / 3_600_000));
  if (diffHours < 24) return `${diffHours} giờ`;
  return `${Math.floor(diffHours / 24)} ngày`;
}

function departmentRiskScore(row: ManagerDashboardDepartmentRow) {
  return row.absent_count * 3 + row.late_count * 2 + (100 - row.attendance_rate);
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ManagerDashboardSummary | null>(null);
  const [activeTrendIndex, setActiveTrendIndex] = useState(0);

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

  const today = data?.today ?? null;
  const trend = data?.trend ?? [];
  const departments = data?.departments ?? [];
  const pendingLeaves = data?.pending_leaves ?? [];
  const recentLogs = data?.recent_logs ?? [];

  const averageAttendance = useMemo(() => averageRate(trend), [trend]);
  const presentRate = today?.attendance_rate ?? 0;
  const absentRate = today ? absenceRate(today.total_users, today.absent_count) : 0;
  const lateRate = today?.total_users ? Math.round((today.late_count / today.total_users) * 100 * 10) / 10 : 0;

  const chartGeometry = useMemo(() => {
    if (!trend.length) return null;

    const width = 760;
    const height = 280;
    const padLeft = 30;
    const padRight = 18;
    const padTop = 20;
    const padBottom = 36;
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
  const activeTrend = trend[activeTrendIndex] ?? latestTrend;
  const activeTrendPrev = activeTrendIndex > 0 ? trend[activeTrendIndex - 1] ?? null : null;
  const activeTrendDelta =
    activeTrend && activeTrendPrev ? Math.round((activeTrend.attendance_rate - activeTrendPrev.attendance_rate) * 10) / 10 : null;

  useEffect(() => {
    if (!trend.length) {
      setActiveTrendIndex(0);
      return;
    }
    setActiveTrendIndex((current) => (current >= 0 && current < trend.length ? current : trend.length - 1));
  }, [trend.length]);

  const bestTrendDay = useMemo(() => {
    if (!trend.length) return null;
    return [...trend].sort((a, b) => b.attendance_rate - a.attendance_rate || b.present_count - a.present_count)[0] ?? null;
  }, [trend]);

  const weakTrendDay = useMemo(() => {
    if (!trend.length) return null;
    return [...trend].sort((a, b) => a.attendance_rate - b.attendance_rate || b.absent_count - a.absent_count)[0] ?? null;
  }, [trend]);

  const departmentRanking = useMemo(() => {
    return [...departments].sort(
      (a, b) => b.attendance_rate - a.attendance_rate || b.present_count - a.present_count || a.late_count - b.late_count
    );
  }, [departments]);

  const bestDepartment = departmentRanking[0] ?? null;
  const riskDepartment = useMemo(() => {
    if (!departments.length) return null;
    return [...departments].sort((a, b) => departmentRiskScore(b) - departmentRiskScore(a))[0] ?? null;
  }, [departments]);

  const dashboardAlerts = useMemo<DashboardAlert[]>(() => {
    const items: DashboardAlert[] = [];

    if (today) {
      if (today.attendance_rate < 85) {
        items.push({
          key: "attendance-low",
          title: "Hiện diện thấp",
          sub: `${today.attendance_rate}% có mặt, vắng ${today.absent_count} người`,
          tone: "danger",
          icon: <WarningOutlined />
        });
      } else if (today.attendance_rate >= 95) {
        items.push({
          key: "attendance-good",
          title: "Tình hình ổn định",
          sub: `${today.attendance_rate}% có mặt trong hôm nay`,
          tone: "good",
          icon: <CheckCircleOutlined />
        });
      }

      if (today.late_count > 0) {
        items.push({
          key: "late-users",
          title: "Có nhân sự đi muộn",
          sub: `${today.late_count} người đi muộn, chiếm ${lateRate}%`,
          tone: "warn",
          icon: <ClockCircleOutlined />
        });
      }
    }

    if ((data?.leave_summary.pending_count ?? 0) > 0) {
      items.push({
        key: "leave-pending",
        title: "Đơn nghỉ cần duyệt",
        sub: `${data?.leave_summary.pending_count ?? 0} đơn đang chờ xử lý`,
        tone: "info",
        icon: <AuditOutlined />
      });
    }

    if (riskDepartment && (riskDepartment.absent_count > 0 || riskDepartment.late_count > 0)) {
      items.push({
        key: "dept-risk",
        title: "Phòng ban cần chú ý",
        sub: `${riskDepartment.department_name} • ${riskDepartment.attendance_rate}% hiện diện`,
        tone: "warn",
        icon: <ApartmentOutlined />
      });
    }

    if (trendDelta != null && trendDelta < 0) {
      items.push({
        key: "trend-down",
        title: "Xu hướng đang giảm",
        sub: `${trendDelta}% so với ${previousTrend?.label ?? "hôm trước"}`,
        tone: "danger",
        icon: <ArrowDownOutlined />
      });
    }

    if (!items.length) {
      items.push({
        key: "all-good",
        title: "Không có điểm nóng lớn",
        sub: "Chưa thấy tín hiệu bất thường từ dashboard hôm nay",
        tone: "good",
        icon: <InfoCircleOutlined />
      });
    }

    return items.slice(0, 4);
  }, [data?.leave_summary.pending_count, lateRate, previousTrend?.label, riskDepartment, today, trendDelta]);

  const statCards = [
    {
      key: "present",
      label: "Có mặt",
      value: today?.present_count ?? 0,
      icon: <CheckCircleOutlined />,
      foot: `${presentRate}% tổng quân số`,
      tone: "green"
    },
    {
      key: "absent",
      label: "Vắng mặt",
      value: today?.absent_count ?? 0,
      icon: <ExclamationCircleOutlined />,
      foot: `${absentRate}% tổng quân số`,
      tone: "rose"
    },
    {
      key: "late",
      label: "Đi muộn",
      value: today?.late_count ?? 0,
      icon: <ClockCircleOutlined />,
      foot: `${lateRate}% nhân sự hôm nay`,
      tone: "amber"
    },
    {
      key: "working",
      label: "Đang làm",
      value: today?.working_count ?? 0,
      icon: <FieldTimeOutlined />,
      foot: `${today?.checked_out_count ?? 0} đã ra ca`,
      tone: "blue"
    },
    {
      key: "pending",
      label: "Chờ duyệt phép",
      value: data?.leave_summary.pending_count ?? 0,
      icon: <AuditOutlined />,
      foot: `${data?.leave_summary.approved_count ?? 0} đã duyệt`,
      tone: "violet"
    },
    {
      key: "departments",
      label: "Phòng ban",
      value: departments.length,
      icon: <ApartmentOutlined />,
      foot: `${bestDepartment?.department_name ?? "--"} đang cao nhất`,
      tone: "slate"
    }
  ] as const;

  function moveTrendFocus(direction: number) {
    if (!trend.length || direction === 0) return;
    setActiveTrendIndex((current) => clamp(current + direction, 0, trend.length - 1));
  }

  return (
    <div className={styles.page}>
      {error ? <div className={styles.errorBox}>{error}</div> : null}

      <section className={styles.heroGrid}>
        {/*<article className={styles.commandCard}>*/}
        {/*  <div className={styles.commandTop}>*/}
        {/*    <div>*/}
        {/*      <div className={styles.eyebrow}>Bảng điều hành hôm nay</div>*/}
        {/*      <h1 className={styles.commandTitle}>{today ? formatLongDate(today.day) : "Đang tải dữ liệu"}</h1>*/}
        {/*    </div>*/}
        {/*    <div className={styles.generatedBadge}>*/}
        {/*      <CalendarOutlined />*/}
        {/*      {data?.generated_at ? formatDateTime(data.generated_at) : "--"}*/}
        {/*    </div>*/}
        {/*  </div>*/}

        {/*  <div className={styles.commandBody}>*/}
        {/*    <div className={styles.commandScoreBlock}>*/}
        {/*      <div className={styles.commandScore}>{loading && !data ? "..." : `${Math.round(presentRate)}%`}</div>*/}
        {/*      <div className={styles.commandScoreMeta}>*/}
        {/*        <span>Tỷ lệ hiện diện</span>*/}
        {/*        <strong>*/}
        {/*          {today?.present_count ?? 0}/{today?.total_users ?? 0} nhân sự có mặt*/}
        {/*        </strong>*/}
        {/*      </div>*/}
        {/*    </div>*/}

        {/*    <div className={styles.commandQuickStats}>*/}
        {/*      <div className={styles.quickStat}>*/}
        {/*        <span className={styles.quickLabel}>Trung bình 7 ngày</span>*/}
        {/*        <strong>{averageAttendance}%</strong>*/}
        {/*      </div>*/}
        {/*      <div className={styles.quickStat}>*/}
        {/*        <span className={styles.quickLabel}>Xu hướng hôm nay</span>*/}
        {/*        <strong>*/}
        {/*          {trendDelta == null ? "--" : `${trendDelta > 0 ? "+" : ""}${trendDelta}%`}*/}
        {/*        </strong>*/}
        {/*      </div>*/}
        {/*      <div className={styles.quickStat}>*/}
        {/*        <span className={styles.quickLabel}>Đơn cần xử lý</span>*/}
        {/*        <strong>{data?.leave_summary.pending_count ?? 0}</strong>*/}
        {/*      </div>*/}
        {/*    </div>*/}
        {/*  </div>*/}

        {/*  <div className={styles.heroMetaRow}>*/}
        {/*    <span className={styles.heroMetaPill}>*/}
        {/*      <TeamOutlined />*/}
        {/*      {today?.total_users ?? 0} nhân sự*/}
        {/*    </span>*/}
        {/*    <span className={styles.heroMetaPill}>*/}
        {/*      <FieldTimeOutlined />*/}
        {/*      {today?.working_count ?? 0} đang làm*/}
        {/*    </span>*/}
        {/*    <span className={styles.heroMetaPill}>*/}
        {/*      <ClockCircleOutlined />*/}
        {/*      {today?.late_count ?? 0} đi muộn*/}
        {/*    </span>*/}
        {/*    <span className={styles.heroMetaPill}>*/}
        {/*      <AuditOutlined />*/}
        {/*      {data?.leave_summary.pending_count ?? 0} chờ duyệt*/}
        {/*    </span>*/}
        {/*  </div>*/}
        {/*</article>*/}

        {/*<aside className={styles.attentionCard}>*/}
        {/*  <div className={styles.attentionHeader}>*/}
        {/*    <div className={styles.eyebrow}>Điểm cần chú ý</div>*/}
        {/*    <span className={styles.attentionCount}>{dashboardAlerts.length}</span>*/}
        {/*  </div>*/}

        {/*  <div className={styles.alertList}>*/}
        {/*    {dashboardAlerts.map((alert) => (*/}
        {/*      <article key={alert.key} className={`${styles.alertRow} ${styles[`alert${alert.tone[0].toUpperCase()}${alert.tone.slice(1)}`]}`}>*/}
        {/*        <div className={styles.alertIcon}>{alert.icon}</div>*/}
        {/*        <div className={styles.alertBody}>*/}
        {/*          <strong>{alert.title}</strong>*/}
        {/*          <span>{alert.sub}</span>*/}
        {/*        </div>*/}
        {/*      </article>*/}
        {/*    ))}*/}
        {/*  </div>*/}
        {/*</aside>*/}
      </section>

      <section className={styles.statsGrid}>
        {statCards.map((item) => (
          <article key={item.key} className={`${styles.statCard} ${styles[`tone${item.tone[0].toUpperCase()}${item.tone.slice(1)}`]}`}>
            <div className={styles.statTop}>
              <div className={styles.statIcon}>{item.icon}</div>
              <div className={styles.statLabel}>{item.label}</div>
            </div>
            <div className={styles.statValue}>{loading && !data ? "..." : item.value}</div>
            <div className={styles.statFoot}>{item.foot}</div>
          </article>
        ))}
      </section>

      <section className={styles.analyticsGrid}>
        <div className={styles.spanFull}>
          <Card
            title={
              <span className={styles.sectionTitle}>
                <BarChartOutlined />
                <span>Xu hướng hiện diện 7 ngày</span>
              </span>
            }
            right={<span className={styles.softBadge}>{averageAttendance}% trung bình</span>}
          >
            <div className={styles.chartLayout}>
              <div className={styles.chartPanel}>
                {chartGeometry ? (
                  <>
                    <div className={styles.chartSummary}>
                      <div className={styles.chartHeadline}>
                        <div className={styles.chartHeadlineValue}>{Math.round(activeTrend?.attendance_rate ?? averageAttendance)}%</div>
                        <div className={styles.chartHeadlineMeta}>
                          <span>{activeTrend?.label ?? "Hôm nay"}</span>
                          <strong>{activeTrend ? formatDate(activeTrend.day) : "--"}</strong>
                        </div>
                      </div>

                      <div className={styles.chartPills}>
                        <span className={styles.summaryPill}>
                          <CheckCircleOutlined />
                          {activeTrend?.present_count ?? 0} có mặt
                        </span>
                        <span className={styles.summaryPill}>
                          <ExclamationCircleOutlined />
                          {activeTrend?.absent_count ?? 0} vắng
                        </span>
                        <span className={styles.summaryPill}>
                          <ClockCircleOutlined />
                          {activeTrend?.late_count ?? 0} muộn
                        </span>
                        {activeTrendDelta != null ? (
                          <span className={styles.summaryPill}>
                            {activeTrendDelta >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                            {activeTrendDelta > 0 ? "+" : ""}
                            {activeTrendDelta}%
                          </span>
                        ) : null}
                        <span className={styles.chartWheelHint}>
                          <InfoCircleOutlined />
                          Cuộn để đổi ngày
                        </span>
                      </div>
                    </div>

                    <div
                      className={styles.chartCanvas}
                      onWheel={(event) => {
                        if (!trend.length) return;
                        event.preventDefault();
                        const direction = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? Math.sign(event.deltaX) : Math.sign(event.deltaY);
                        moveTrendFocus(direction);
                      }}
                    >
                      <div className={styles.chartYAxis}>
                        {chartGeometry.gridValues.map((value, index) => (
                          <span key={`${value}-${index}`}>{value}%</span>
                        ))}
                      </div>

                      <svg
                        className={styles.chartSvg}
                        viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
                        role="img"
                        aria-label="Biểu đồ hiện diện 7 ngày"
                      >
                        <defs>
                          <linearGradient id="dashboardTrendArea" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="rgba(14, 165, 233, 0.28)" />
                            <stop offset="100%" stopColor="rgba(14, 165, 233, 0.02)" />
                          </linearGradient>
                          <linearGradient id="dashboardTrendLine" x1="0" x2="1" y1="0" y2="0">
                            <stop offset="0%" stopColor="#0ea5e9" />
                            <stop offset="100%" stopColor="#22c55e" />
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

                        {activeTrend ? (
                          <line
                            x1={chartGeometry.points[activeTrendIndex]?.x ?? chartGeometry.padLeft}
                            y1={chartGeometry.padBottom / 2}
                            x2={chartGeometry.points[activeTrendIndex]?.x ?? chartGeometry.padLeft}
                            y2={chartGeometry.height - chartGeometry.padBottom}
                            className={styles.chartFocusLine}
                          />
                        ) : null}

                        {chartGeometry.points.map((point, index) => (
                          <g
                            key={point.day}
                            className={index === activeTrendIndex ? styles.chartPointActive : undefined}
                            onMouseEnter={() => setActiveTrendIndex(index)}
                            onFocus={() => setActiveTrendIndex(index)}
                          >
                            {index === activeTrendIndex ? <circle cx={point.x} cy={point.y} r="14" className={styles.chartPointHalo} /> : null}
                            <circle cx={point.x} cy={point.y} r="6" className={styles.chartPointOuter} />
                            <circle cx={point.x} cy={point.y} r="3.5" className={styles.chartPointInner} />
                          </g>
                        ))}
                      </svg>
                    </div>

                    <div className={styles.chartAxisRow}>
                      {chartGeometry.points.map((point, index) => (
                        <button
                          key={point.day}
                          type="button"
                          className={index === activeTrendIndex ? `${styles.chartAxisItem} ${styles.chartAxisItemActive}` : styles.chartAxisItem}
                          onMouseEnter={() => setActiveTrendIndex(index)}
                          onFocus={() => setActiveTrendIndex(index)}
                          onClick={() => setActiveTrendIndex(index)}
                        >
                          <strong>{point.label}</strong>
                          <span>{formatDate(point.day)}</span>
                        </button>
                      ))}
                    </div>

                    <div className={styles.chartDetailGrid}>
                      <article className={styles.chartDetailCard}>
                        <span className={styles.chartDetailLabel}>Ngày đang xem</span>
                        <strong className={styles.chartDetailValue}>{activeTrend ? formatLongDate(activeTrend.day) : "--"}</strong>
                      </article>
                      <article className={styles.chartDetailCard}>
                        <span className={styles.chartDetailLabel}>Hiện diện</span>
                        <strong className={styles.chartDetailValue}>{activeTrend ? `${activeTrend.attendance_rate}%` : "--"}</strong>
                        <span className={styles.chartDetailSub}>
                          {activeTrend?.present_count ?? 0} có mặt • {activeTrend?.absent_count ?? 0} vắng
                        </span>
                      </article>
                      <article className={styles.chartDetailCard}>
                        <span className={styles.chartDetailLabel}>Đi muộn</span>
                        <strong className={styles.chartDetailValue}>{activeTrend?.late_count ?? 0}</strong>
                        <span className={styles.chartDetailSub}>
                          {activeTrendDelta == null ? "Chưa đủ dữ liệu so sánh" : `${activeTrendDelta > 0 ? "+" : ""}${activeTrendDelta}% so với ngày trước`}
                        </span>
                      </article>
                    </div>
                  </>
                ) : (
                  <div className={styles.emptyState}>Chưa có dữ liệu xu hướng để hiển thị.</div>
                )}
              </div>

              <div className={styles.trendFacts}>
                <div className={styles.factCard}>
                  <span className={styles.factIcon}>
                    <RiseOutlined />
                  </span>
                  <div>
                    <div className={styles.factLabel}>Ngày tốt nhất</div>
                    <strong className={styles.factValue}>{bestTrendDay ? `${bestTrendDay.attendance_rate}%` : "--"}</strong>
                    <div className={styles.factSub}>{bestTrendDay ? `${bestTrendDay.label} • ${formatDate(bestTrendDay.day)}` : "Chưa có dữ liệu"}</div>
                  </div>
                </div>

                <div className={styles.factCard}>
                  <span className={styles.factIcon}>
                    <FireOutlined />
                  </span>
                  <div>
                    <div className={styles.factLabel}>Ngày yếu nhất</div>
                    <strong className={styles.factValue}>{weakTrendDay ? `${weakTrendDay.attendance_rate}%` : "--"}</strong>
                    <div className={styles.factSub}>{weakTrendDay ? `${weakTrendDay.label} • ${formatDate(weakTrendDay.day)}` : "Chưa có dữ liệu"}</div>
                  </div>
                </div>

                <div className={styles.factCard}>
                  <span className={styles.factIcon}>
                    <FieldTimeOutlined />
                  </span>
                  <div>
                    <div className={styles.factLabel}>Mốc đang focus</div>
                    <strong className={styles.factValue}>{activeTrend ? `${activeTrend.present_count}/${today?.total_users ?? 0}` : "--"}</strong>
                    <div className={styles.factSub}>{activeTrend ? `${activeTrend.late_count} đi muộn • ${activeTrend.absent_count} vắng` : "Chưa có dữ liệu"}</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className={styles.spanFull}>
          <Card
            title={
              <span className={styles.sectionTitle}>
                <ApartmentOutlined />
                <span>Tình hình theo phòng ban</span>
              </span>
            }
            right={<span className={styles.softBadge}>{departments.length} phòng ban</span>}
          >
            <div className={styles.departmentOverview}>
              <div className={styles.calloutGrid}>
                <div className={styles.calloutCard}>
                  <span className={styles.calloutLabel}>Phòng ban nổi bật</span>
                  <strong className={styles.calloutValue}>{bestDepartment?.department_name ?? "--"}</strong>
                  <span className={styles.calloutSub}>{bestDepartment ? `${bestDepartment.attendance_rate}% hiện diện` : "Chưa có dữ liệu"}</span>
                </div>
                <div className={styles.calloutCard}>
                  <span className={styles.calloutLabel}>Phòng ban cần theo dõi</span>
                  <strong className={styles.calloutValue}>{riskDepartment?.department_name ?? "--"}</strong>
                  <span className={styles.calloutSub}>
                    {riskDepartment ? `${riskDepartment.absent_count} vắng • ${riskDepartment.late_count} muộn` : "Chưa có dữ liệu"}
                  </span>
                </div>
              </div>

              <div className={styles.departmentList}>
                {departmentRanking.slice(0, 8).map((dept) => (
                  <article key={`${dept.department_id ?? "none"}-${dept.department_name}`} className={styles.departmentRow}>
                    <div className={styles.departmentHead}>
                      <div>
                        <strong className={styles.departmentName}>{dept.department_name}</strong>
                        <div className={styles.departmentMeta}>
                          <span className={styles.metaPill}>
                            <TeamOutlined />
                            {dept.total_users} người
                          </span>
                          <span className={styles.metaPill}>
                            <CheckCircleOutlined />
                            {dept.present_count} có mặt
                          </span>
                          <span className={styles.metaPill}>
                            <ClockCircleOutlined />
                            {dept.late_count} muộn
                          </span>
                          <span className={styles.metaPill}>
                            <ExclamationCircleOutlined />
                            {dept.absent_count} vắng
                          </span>
                        </div>
                      </div>
                      <span
                        className={`${styles.rateBadge} ${
                          dept.attendance_rate >= 95 ? styles.rateGood : dept.attendance_rate >= 85 ? styles.rateWarn : styles.rateBad
                        }`}
                      >
                        {dept.attendance_rate}%
                      </span>
                    </div>
                    <div className={styles.progressTrack}>
                      <span className={styles.progressFill} style={{ width: `${clamp(dept.attendance_rate, 0, 100)}%` }} />
                    </div>
                  </article>
                ))}

                {!loading && !departmentRanking.length ? <div className={styles.emptyState}>Chưa có dữ liệu phòng ban để hiển thị.</div> : null}
              </div>
            </div>
          </Card>
        </div>

        <Card
          title={
            <span className={styles.sectionTitle}>
              <AuditOutlined />
              <span>Hàng đợi nghỉ phép</span>
            </span>
          }
          right={<span className={styles.softBadge}>{data?.leave_summary.pending_count ?? 0} chờ duyệt</span>}
        >
          <div className={styles.leaveSummaryStrip}>
            <div className={styles.summaryMini}>
              <span>Chờ duyệt</span>
              <strong>{data?.leave_summary.pending_count ?? 0}</strong>
            </div>
            <div className={styles.summaryMini}>
              <span>Đã duyệt</span>
              <strong>{data?.leave_summary.approved_count ?? 0}</strong>
            </div>
            <div className={styles.summaryMini}>
              <span>Từ chối</span>
              <strong>{data?.leave_summary.rejected_count ?? 0}</strong>
            </div>
          </div>

          <div className={styles.queueList}>
            {pendingLeaves.map((item) => (
              <article key={item.id} className={styles.queueRow}>
                <div className={styles.queueAvatar}>{getInitials(item.user_name)}</div>
                <div className={styles.queueMain}>
                  <div className={styles.queueTop}>
                    <strong>{item.user_name}</strong>
                    <span className={styles.timeBadge}>{queueAge(item.created_at)}</span>
                  </div>
                  <div className={styles.queueSub}>{leaveTypeVi(item.type)}</div>
                  <div className={styles.queueMeta}>
                    <span className={styles.metaPill}>
                      <CalendarOutlined />
                      {formatDate(item.start_date)} - {formatDate(item.end_date)}
                    </span>
                    <span className={styles.metaPill}>
                      <NumberOutlined />
                      {item.user_code || "--"}
                    </span>
                    <span className={styles.metaPill}>
                      <ApartmentOutlined />
                      {item.department_name || "Chưa phân phòng ban"}
                    </span>
                  </div>
                </div>
              </article>
            ))}

            {!loading && !pendingLeaves.length ? <div className={styles.emptyState}>Không có đơn nghỉ phép đang chờ duyệt.</div> : null}
          </div>
        </Card>

        <Card
          title={
            <span className={styles.sectionTitle}>
              <FieldTimeOutlined />
              <span>Chấm công gần nhất</span>
            </span>
          }
          right={<span className={styles.softBadge}>{recentLogs.length} bản ghi</span>}
        >
          <div className={styles.queueList}>
            {recentLogs.map((item) => (
              <article key={item.id} className={styles.queueRow}>
                <div className={styles.queueAvatar}>{getInitials(item.user_name)}</div>
                <div className={styles.queueMain}>
                  <div className={styles.queueTop}>
                    <strong>{item.user_name}</strong>
                    <span className={styles.timeBadge}>{formatDateTime(item.timestamp)}</span>
                  </div>
                  <div className={styles.queueSub}>{attendanceTypeVi(item.type)}</div>
                  <div className={styles.queueMeta}>
                    <span className={styles.metaPill}>
                      {attendanceIcon(item.type)}
                      {attendanceTypeVi(item.type)}
                    </span>
                    <span className={styles.metaPill}>
                      <NumberOutlined />
                      {item.user_code || "--"}
                    </span>
                    <span className={styles.metaPill}>
                      <CheckCircleOutlined />
                      {item.confidence.toFixed(3)}
                    </span>
                  </div>
                </div>
              </article>
            ))}

            {!loading && !recentLogs.length ? <div className={styles.emptyState}>Chưa có log chấm công gần đây.</div> : null}
          </div>
        </Card>
      </section>
    </div>
  );
}

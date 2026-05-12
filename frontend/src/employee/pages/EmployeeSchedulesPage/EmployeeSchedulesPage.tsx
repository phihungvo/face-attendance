import { useEffect, useMemo, useState, type ReactNode } from "react";
import Card from "../../../app/components/Card/Card";
import Modal from "../../../app/components/Modal/Modal";
import Table from "../../../app/components/Table/Table";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";
import {
  cancelMyScheduleRegistration,
  createMyScheduleRegistrationRequest,
  listMyScheduleRegistrations,
  listSchedules,
  type WorkSchedule,
  type WorkScheduleRegistration
} from "../../../shared/api/schedules";
import styles from "./EmployeeSchedulesPage.module.scss";

function todayYmd() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateVi(ymd: string) {
  const dt = new Date(`${ymd}T00:00:00`);
  return dt.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

function normalizeYmd(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") {
    // Accept both "YYYY-MM-DD" and ISO strings with time.
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const dt = new Date(v);
    if (!Number.isNaN(dt.getTime())) {
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    }
    return v;
  }
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  return String(v);
}

type TabKey = "register" | "calendar" | "details";
type CartMode = "single" | "range";
type CartItem = { schedule_id: number; mode: CartMode; from: string; to: string; weekdays: number[] };

const DOW_LABEL: Record<number, string> = { 0: "T2", 1: "T3", 2: "T4", 3: "T5", 4: "T6", 5: "T7", 6: "CN" };

function weekdayMon0(ymd: string) {
  const d = new Date(`${ymd}T00:00:00`);
  const js = d.getDay(); // Sun=0
  return (js + 6) % 7; // Mon=0
}

function inRange(ymd: string, start?: string | null, end?: string | null) {
  if (start && ymd < start) return false;
  if (end && ymd > end) return false;
  return true;
}

function nextApplicableDay(s: WorkSchedule, fromYmd: string) {
  const days = s.days_of_week?.length ? [...s.days_of_week].sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6];
  const start = s.date_start ?? null;
  const end = s.date_end ?? null;

  const startFrom = start && start > fromYmd ? start : fromYmd;
  for (let i = 0; i < 400; i++) {
    const dt = new Date(`${startFrom}T00:00:00`);
    dt.setDate(dt.getDate() + i);
    const ymd = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    if (!inRange(ymd, start, end)) continue;
    if (days.includes(weekdayMon0(ymd))) return ymd;
  }
  return startFrom;
}

function clampRange(from: string, to: string) {
  return from <= to ? { from, to } : { from: to, to: from };
}

function listDaysInRange(from: string, to: string, limit = 186) {
  const r = clampRange(from, to);
  const out: string[] = [];
  const start = new Date(`${r.from}T00:00:00`);
  for (let i = 0; i < limit; i++) {
    const dt = new Date(start);
    dt.setDate(dt.getDate() + i);
    const ymd = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    out.push(ymd);
    if (ymd >= r.to) break;
  }
  return out;
}

export default function EmployeeSchedulesPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [regs, setRegs] = useState<WorkScheduleRegistration[]>([]);

  const [tab, setTab] = useState<TabKey>("register");
  const [note, setNote] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);

  const [calYear, setCalYear] = useState<number>(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState<number>(() => new Date().getMonth()); // 0-index
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const scheduleOptions = useMemo(() => schedules.filter((s) => s.status === "active"), [schedules]);
  const scheduleById = useMemo(() => new Map(schedules.map((s) => [s.id, s])), [schedules]);

  const isScheduleApplicable = (s: WorkSchedule | undefined, day: string) => {
    if (!s) return true;
    const days = s.days_of_week?.length ? s.days_of_week : [0, 1, 2, 3, 4, 5, 6];
    if (!inRange(day, s.date_start ?? null, s.date_end ?? null)) return false;
    return days.includes(weekdayMon0(day));
  };

  const shiftVisual = (hhmm: string | undefined) => {
    const h = Number(String(hhmm ?? "09:00").slice(0, 2));
    if (h < 12) return { icon: "🌅", cls: styles.vMorning, label: "Sáng" };
    if (h < 18) return { icon: "☀️", cls: styles.vAfternoon, label: "Chiều" };
    return { icon: "🌙", cls: styles.vNight, label: "Tối" };
  };

  const regsSorted = useMemo(() => {
    const items = [...regs];
    items.sort((a, b) => {
      const da = normalizeYmd(a.day);
      const db = normalizeYmd(b.day);
      // Newest first (closest dates first) for better UX + pagination.
      return da === db ? b.id - a.id : db.localeCompare(da);
    });
    return items;
  }, [regs]);

  const regsByDay = useMemo(() => {
    const m = new Map<string, WorkScheduleRegistration[]>();
    for (const r of regs) {
      const key = normalizeYmd(r.day);
      if (!key) continue;
      const arr = m.get(key) ?? [];
      arr.push(r);
      m.set(key, arr);
    }
    for (const [, arr] of m) arr.sort((a, b) => a.id - b.id);
    return m;
  }, [regs]);

  const reload = async (opts?: { keepError?: boolean }) => {
    setLoading(true);
    if (!opts?.keepError) setError(null);
    try {
      const [sch, my] = await Promise.all([listSchedules({ limit: 500, offset: 0, status: "active" }), listMyScheduleRegistrations({ limit: 200, offset: 0 })]);
      setSchedules(sch);
      setRegs(my);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addToCart = (schedule_id: number) => {
    const s = schedules.find((x) => x.id === schedule_id);
    const day = s ? nextApplicableDay(s, todayYmd()) : todayYmd();
    const weekdays = s?.days_of_week?.length ? [...s.days_of_week].sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6];
    setCart((prev) => {
      if (prev.some((x) => x.schedule_id === schedule_id && x.from === day && x.to === day)) return prev;
      return [...prev, { schedule_id, mode: "single", from: day, to: day, weekdays }];
    });
  };

  const removeFromCart = (idx: number) => setCart((prev) => prev.filter((_, i) => i !== idx));

  const setCartMode = (idx: number, mode: CartMode) =>
    setCart((prev) =>
      prev.map((x, i) => {
        if (i !== idx) return x;
        if (mode === "single") return { ...x, mode: "single", to: x.from };
        return { ...x, mode: "range", to: x.to || x.from };
      })
    );

  const updateCartFrom = (idx: number, from: string) => setCart((prev) => prev.map((x, i) => (i === idx ? { ...x, from } : x)));
  const updateCartTo = (idx: number, to: string) => setCart((prev) => prev.map((x, i) => (i === idx ? { ...x, to } : x)));
  const toggleCartWeekday = (idx: number, wd: number) =>
    setCart((prev) =>
      prev.map((x, i) => {
        if (i !== idx) return x;
        const set = new Set(x.weekdays ?? []);
        if (set.has(wd)) set.delete(wd);
        else set.add(wd);
        const next = [...set].sort((a, b) => a - b);
        return { ...x, weekdays: next.length ? next : [wd] };
      })
    );

  const cartPreview = useMemo(() => {
    return cart.map((it) => {
      const s = scheduleById.get(it.schedule_id);
      const selectedWeekdays = it.weekdays?.length ? it.weekdays : [0, 1, 2, 3, 4, 5, 6];
      const raw = it.mode === "range" ? listDaysInRange(it.from, it.to) : [it.from];
      const included: string[] = [];
      let skipped = 0;
      for (const d of raw) {
        if (!selectedWeekdays.includes(weekdayMon0(d))) {
          skipped++;
          continue;
        }
        if (!isScheduleApplicable(s, d)) {
          skipped++;
          continue;
        }
        included.push(d);
      }
      return { included, skipped, rawTotal: raw.length };
    });
  }, [cart, scheduleById]);

  const submitCart = async () => {
    if (!cart.length) {
      setError("Chưa chọn ca nào.");
      return;
    }
    setError(null);
    try {
      const bySchedule = new Map<number, Set<string>>();
      cartPreview.forEach((pv, idx) => {
        const it = cart[idx];
        const set = bySchedule.get(it.schedule_id) ?? new Set<string>();
        for (const d of pv.included) set.add(d);
        bySchedule.set(it.schedule_id, set);
      });
      const noteVal = note.trim() || null;
      let totalDays = 0;
      for (const [schedule_id, daySet] of bySchedule) {
        const days = [...daySet].sort();
        if (!days.length) continue;
        totalDays += days.length;
        await createMyScheduleRegistrationRequest({ schedule_id, days, note: noteVal });
      }
      if (totalDays === 0) {
        throw new Error("Không có ngày hợp lệ để đăng ký (kiểm tra khoảng ngày/thu trong tuần).");
      }
      setCart([]);
      setNote("");
      await reload();
      setTab("calendar");
    } catch (e) {
      setError(getApiErrorMessage(e));
      await reload({ keepError: true });
    }
  };

  const cancel = async (r: WorkScheduleRegistration) => {
    // eslint-disable-next-line no-alert
    if (!confirm(`Huỷ đăng ký ngày ${normalizeYmd(r.day)}?`)) return;
    setError(null);
    try {
      await cancelMyScheduleRegistration(r.id);
      await reload();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  const statusTag = (s: string) => {
    if (s === "approved") return `${styles.tag} ${styles.good}`;
    if (s === "pending") return `${styles.tag} ${styles.warn}`;
    if (s === "cancelled") return styles.tag;
    return `${styles.tag} ${styles.bad}`;
  };

  const selectedRegs = useMemo(() => {
    if (!selectedDay) return [];
    return regsSorted.filter((r) => normalizeYmd(r.day) === selectedDay);
  }, [regsSorted, selectedDay]);

  const [detailPage, setDetailPage] = useState(1);
  const detailPageSize = 12;
  const detailTotalPages = Math.max(1, Math.ceil(regsSorted.length / detailPageSize));
  const detailPageSafe = Math.min(Math.max(1, detailPage), detailTotalPages);
  const detailItems = useMemo(() => {
    const start = (detailPageSafe - 1) * detailPageSize;
    return regsSorted.slice(start, start + detailPageSize);
  }, [regsSorted, detailPageSafe]);

  useEffect(() => {
    setDetailPage(1);
  }, [regsSorted.length]);

  return (
    <div className={styles.page}>
      {error && tab !== "register" ? <div className={styles.errorBox}>⚠️ {error}</div> : null}

      <div className={styles.tabs}>
        <button type="button" className={tab === "register" ? `${styles.tab} ${styles.active}` : styles.tab} onClick={() => setTab("register")}>
          ➕ Đăng ký ca
        </button>
        <button type="button" className={tab === "calendar" ? `${styles.tab} ${styles.active}` : styles.tab} onClick={() => setTab("calendar")}>
          📅 Lịch của tôi
        </button>
        <button type="button" className={tab === "details" ? `${styles.tab} ${styles.active}` : styles.tab} onClick={() => setTab("details")}>
          📋 Chi tiết
        </button>
      </div>

      {tab === "register" ? (
        <div className={styles.gridRegister}>
          <Card title="🗓️ Chọn ca làm" sub={loading ? "Đang tải..." : `${scheduleOptions.length} ca khả dụng`}>
            <div className={styles.shiftList}>
              {scheduleOptions.map((s) => (
                <div key={s.id} className={styles.shiftItem}>
                  <div className={[styles.shiftIcon, shiftVisual(s.shift_start).cls].join(" ")} title={shiftVisual(s.shift_start).label}>
                    {shiftVisual(s.shift_start).icon}
                  </div>
                  <div className={styles.shiftMain}>
                    <div className={styles.shiftName}>{s.name}</div>
                    <div className={styles.shiftMeta}>
                      <span className={styles.mono}>
                        {s.shift_start}–{s.shift_end}
                      </span>
                      <span className={styles.dot}>•</span>
                      <span className={styles.mono}>#{s.code}</span>
                    </div>
                    <div className={styles.shiftMeta}>
                      <span className={styles.muted}>
                        Áp dụng: {(s.days_of_week?.length ? s.days_of_week : [0, 1, 2, 3, 4, 5, 6]).map((d) => DOW_LABEL[d]).join(", ")}
                      </span>
                      {s.date_start || s.date_end ? (
                        <>
                          <span className={styles.dot}>•</span>
                          <span className={styles.muted}>
                            {s.date_start ? s.date_start : "…"} → {s.date_end ? s.date_end : "…"}
                          </span>
                        </>
                      ) : null}
                      {Number(s.max_registrations ?? 0) > 0 ? (
                        <>
                          <span className={styles.dot}>•</span>
                          <span className={styles.muted}>Tối đa: {Number(s.max_registrations)}</span>
                        </>
                      ) : null}
                      {s.note ? (
                        <>
                          <span className={styles.dot}>•</span>
                          <span className={styles.muted}>{s.note}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <button type="button" className={styles.btnGhost} onClick={() => addToCart(s.id)} disabled={loading}>
                    + Chọn ca
                  </button>
                </div>
              ))}
              {!loading && scheduleOptions.length === 0 ? <div className={styles.empty}>Chưa có ca làm.</div> : null}
            </div>
          </Card>

          <Card title="🧺 Giỏ đăng ký" sub={cart.length ? `${cart.length} mục` : "Chưa chọn ca nào"}>
            <div className={styles.cart}>
              {cart.length ? (
                cart.map((it, idx) => {
                  const s = scheduleById.get(it.schedule_id);
                  const pv = cartPreview[idx] ?? { included: [], skipped: 0, rawTotal: 0 };
                  const applicableSingle = it.mode === "single" ? isScheduleApplicable(s, it.from) : true;
                  const allowedWds = s?.days_of_week?.length ? s.days_of_week : [0, 1, 2, 3, 4, 5, 6];
                  return (
                    <div key={`${it.schedule_id}-${idx}`} className={styles.cartItem}>
                      <div className={[styles.cartIcon, shiftVisual(s?.shift_start).cls].join(" ")}>{shiftVisual(s?.shift_start).icon}</div>
                      <div className={styles.cartLeft}>
                        <div className={styles.cartName}>{s ? s.name : `#${it.schedule_id}`}</div>
                        <div className={styles.cartMeta}>
                          <span className={styles.mono}>{s ? `${s.shift_start}–${s.shift_end}` : "—"}</span>
                          {!applicableSingle ? <span className={styles.badgeWarn}>Không áp dụng ngày này</span> : null}
                        </div>
                        <div className={styles.cartMeta}>
                          <div className={styles.cartMode}>
                            <button
                              type="button"
                              className={it.mode === "single" ? `${styles.modeBtn} ${styles.modeActive}` : styles.modeBtn}
                              onClick={() => setCartMode(idx, "single")}
                            >
                              1 ngày
                            </button>
                            <button
                              type="button"
                              className={it.mode === "range" ? `${styles.modeBtn} ${styles.modeActive}` : styles.modeBtn}
                              onClick={() => setCartMode(idx, "range")}
                            >
                              Nhiều ngày
                            </button>
                          </div>
                          <span className={styles.muted}>
                            {pv.included.length ? `Sẽ đăng ký: ${pv.included.length} ngày` : "Chưa có ngày hợp lệ"}
                            {pv.skipped ? ` • Bỏ qua: ${pv.skipped}` : ""}
                          </span>
                        </div>
                        {it.mode === "range" ? (
                          <div className={styles.weekdays}>
                            {[0, 1, 2, 3, 4, 5, 6].map((wd) => {
                              const disabled = !allowedWds.includes(wd);
                              const active = (it.weekdays ?? []).includes(wd);
                              const cls = disabled
                                ? `${styles.weekdayChip} ${styles.weekdayDisabled}`
                                : active
                                  ? `${styles.weekdayChip} ${styles.weekdayActive}`
                                  : styles.weekdayChip;
                              return (
                                <button key={wd} type="button" className={cls} disabled={disabled} onClick={() => toggleCartWeekday(idx, wd)}>
                                  {DOW_LABEL[wd]}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                      <div className={styles.cartDates}>
                        <input className={styles.cartDate} type="date" value={it.from} onChange={(e) => updateCartFrom(idx, e.target.value)} />
                        {it.mode === "range" ? <input className={styles.cartDate} type="date" value={it.to} onChange={(e) => updateCartTo(idx, e.target.value)} /> : null}
                      </div>
                      <button type="button" className={styles.cartRemove} onClick={() => removeFromCart(idx)} aria-label="Remove">
                        ×
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className={styles.empty}>Chưa chọn ca nào.</div>
              )}

              <label className={styles.note}>
                <div className={styles.noteLabel}>Ghi chú (tuỳ chọn)</div>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Ghi chú thêm cho quản lý..." />
              </label>

              <div className={styles.actions}>
                <button className={styles.btnPrimary} type="button" onClick={submitCart} disabled={loading || !cart.length}>
                  Gửi đăng ký →
                </button>
              </div>
              {error ? <div className={styles.inlineError}>⚠️ {error}</div> : null}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "calendar" ? (
        <>
          <Card
            title="📅 Lịch làm của tôi"
            sub={loading ? "Đang tải..." : `${regs.length} đăng ký`}
            right={
              <div className={styles.calNav}>
                <button
                  className={styles.calNavBtn}
                  type="button"
                  onClick={() => {
                    const d = new Date(calYear, calMonth, 1);
                    d.setMonth(d.getMonth() - 1);
                    setCalYear(d.getFullYear());
                    setCalMonth(d.getMonth());
                  }}
                >
                  ‹
                </button>
                <div className={styles.calLabel}>{new Date(calYear, calMonth, 1).toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}</div>
                <button
                  className={styles.calNavBtn}
                  type="button"
                  onClick={() => {
                    const d = new Date(calYear, calMonth, 1);
                    d.setMonth(d.getMonth() + 1);
                    setCalYear(d.getFullYear());
                    setCalMonth(d.getMonth());
                  }}
                >
                  ›
                </button>
              </div>
            }
          >
            <div className={styles.legend}>
              <div className={styles.legendItem}>
                <div className={[styles.legendIcon, styles.vMorning].join(" ")}>🌅</div>
                <div className={styles.legendText}>Ca sáng</div>
              </div>
              <div className={styles.legendItem}>
                <div className={[styles.legendIcon, styles.vAfternoon].join(" ")}>☀️</div>
                <div className={styles.legendText}>Ca chiều</div>
              </div>
              <div className={styles.legendItem}>
                <div className={[styles.legendIcon, styles.vNight].join(" ")}>🌙</div>
                <div className={styles.legendText}>Ca tối</div>
              </div>
              <div className={styles.legendHint}>Nhấn vào một ngày để xem chi tiết.</div>
            </div>
            <div className={styles.calendar}>
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((l) => (
                <div key={l} className={styles.calDay}>
                  {l}
                </div>
              ))}
              {(() => {
                const first = new Date(calYear, calMonth, 1);
                const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                const firstDay = (first.getDay() + 6) % 7; // Mon=0
                const total = firstDay + daysInMonth;
                const pad = (7 - (total % 7)) % 7;
                const totalCells = total + pad;
                const startCell = new Date(calYear, calMonth, 1 - firstDay);

                const today = new Date();
                const cells: ReactNode[] = [];
                for (let i = 0; i < totalCells; i++) {
                  const dt = new Date(startCell);
                  dt.setDate(dt.getDate() + i);
                  const ymd = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
                  const inMonth = dt.getMonth() === calMonth;
                  const isToday = dt.toDateString() === today.toDateString();
                  const isWeekend = ((dt.getDay() + 6) % 7) >= 5;
                  const dayRegs = regsByDay.get(ymd) ?? [];

                  cells.push(
                    <button
                      key={ymd}
                      type="button"
                      className={`${styles.calCell} ${!inMonth ? styles.otherMonth : ""} ${isToday ? styles.today : ""} ${isWeekend ? styles.weekend : ""}`}
                      onClick={() => setSelectedDay(ymd)}
                      aria-label={`Xem chi tiết ngày ${formatDateVi(ymd)}`}
                    >
                      <div className={styles.calDate}>{dt.getDate()}</div>
                      <div className={styles.calEvents}>
                        {dayRegs.slice(0, 2).map((r) => {
                          const s = scheduleById.get(r.schedule_id);
                          const label = s?.name ? s.name.slice(0, 10) : `#${r.schedule_id}`;
                          const vis = shiftVisual(s?.shift_start);
                          return (
                            <div key={r.id} className={`${styles.calEvent} ${styles[`st_${r.status}` as keyof typeof styles] ?? ""}`}>
                              <span className={styles.calEventIcon} title={vis.label}>
                                {vis.icon}
                              </span>
                              <span className={styles.calEventText}>{label}</span>
                            </div>
                          );
                        })}
                        {dayRegs.length > 2 ? <div className={styles.more}>+{dayRegs.length - 2}</div> : null}
                      </div>
                    </button>
                  );
                }
                return cells;
              })()}
            </div>
          </Card>

          <Modal
            open={!!selectedDay}
            title={selectedDay ? `🗓️ ${formatDateVi(selectedDay)}` : "🗓️ Chi tiết"}
            onClose={() => setSelectedDay(null)}
            modalClassName={styles.dayModal}
            footer={
              <button className={styles.btnGhost} type="button" onClick={() => setSelectedDay(null)}>
                Đóng
              </button>
            }
          >
            {selectedDay ? (
              <div className={styles.dayDetail}>
                {selectedRegs.length ? (
                  selectedRegs.map((r) => {
                    const sch = scheduleById.get(r.schedule_id);
                    const vis = shiftVisual(sch?.shift_start);
                    return (
                      <div key={r.id} className={styles.dayRow}>
                        <div className={[styles.dayIcon, vis.cls].join(" ")} title={vis.label}>
                          {vis.icon}
                        </div>
                        <div className={styles.dayMain}>
                          <div className={styles.dayName}>{sch ? sch.name : `#${r.schedule_id}`}</div>
                          <div className={styles.dayMeta}>
                            <span className={styles.mono}>
                              {sch?.shift_start ?? "??:??"}–{sch?.shift_end ?? "??:??"}
                            </span>
                            <span className={styles.dot}>•</span>
                            <span className={styles.muted}>#{sch?.code ?? r.schedule_id}</span>
                          </div>
                          {r.note ? <div className={styles.dayNote}>Ghi chú: {r.note}</div> : null}
                          {r.response_note ? <div className={styles.dayResponse}>Phản hồi: {r.response_note}</div> : null}
                        </div>
                        <div className={styles.dayRight}>
                          <div>
                            <span className={statusTag(r.status)}>{r.status}</span>
                          </div>
                          <button
                            className={styles.smallBtn}
                            type="button"
                            disabled={!(r.status === "pending" || r.status === "approved")}
                            onClick={() => cancel(r)}
                          >
                            Huỷ
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.empty}>Không có ca đã đăng ký trong ngày này.</div>
                )}
              </div>
            ) : null}
          </Modal>
        </>
      ) : null}

      {tab === "details" ? (
        <Card
          title="📋 Chi tiết ca làm đã đăng ký"
          sub={loading ? "Đang tải..." : `${regs.length} mục`}
          right={
            regsSorted.length ? (
              <div className={styles.pager} aria-label="Phân trang">
                <button className={styles.pageBtn} type="button" onClick={() => setDetailPage((p) => Math.max(1, p - 1))} disabled={detailPageSafe <= 1}>
                  ←
                </button>
                <div className={styles.pageHint}>
                  Trang {detailPageSafe}/{detailTotalPages}
                </div>
                <button
                  className={styles.pageBtn}
                  type="button"
                  onClick={() => setDetailPage((p) => Math.min(detailTotalPages, p + 1))}
                  disabled={detailPageSafe >= detailTotalPages}
                >
                  →
                </button>
              </div>
            ) : null
          }
        >
          <Table>
            <thead>
              <tr>
                <th style={{ width: 120 }}>Ngày</th>
                <th>Ca</th>
                <th style={{ width: 120 }}>Trạng thái</th>
                <th style={{ width: 140 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {detailItems.map((r) => {
                const sch = scheduleById.get(r.schedule_id);
                return (
                  <tr key={r.id}>
                    <td className={styles.mono} title={formatDateVi(normalizeYmd(r.day))}>
                      {normalizeYmd(r.day)}
                    </td>
                    <td>{sch ? `${sch.name} (${sch.shift_start}–${sch.shift_end})` : `#${r.schedule_id}`}</td>
                    <td>
                      <span className={statusTag(r.status)}>{r.status}</span>
                    </td>
                    <td>
                      <button className={styles.smallBtn} type="button" onClick={() => setSelectedDay(normalizeYmd(r.day))}>
                        Xem ngày
                      </button>
                      <span style={{ margin: "0 8px" }} />
                      <button className={styles.smallBtn} type="button" disabled={!(r.status === "pending" || r.status === "approved")} onClick={() => cancel(r)}>
                        Huỷ
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && regsSorted.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 14, textAlign: "center", color: "var(--text3)", fontWeight: 900 }}>
                    Chưa có dữ liệu
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </Card>
      ) : null}
    </div>
  );
}

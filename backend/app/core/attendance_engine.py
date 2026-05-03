from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta


@dataclass(frozen=True)
class AttendanceConfig:
    shift_start: str  # HH:MM
    shift_end: str  # HH:MM
    late_grace_minutes: int
    early_leave_grace_minutes: int
    break_start: str  # HH:MM
    break_end: str  # HH:MM
    break_duration_minutes: int
    break_threshold_hours: float
    auto_checkout_time: str  # HH:MM


@dataclass(frozen=True)
class AttendanceComputed:
    total_minutes: int
    break_minutes: int
    working_minutes: int
    late_minutes: int
    early_leave_minutes: int
    overtime_minutes: int
    auto_checkout_applied: bool


def decide_scan_action(
    *,
    in_checkin_window: bool,
    in_checkout_window: bool,
    has_checkin: bool,
    has_checkout: bool,
) -> str:
    """
    Decide what action to take on a scan.
    Rules (simple UX-first):
    - If no check-in yet: allow check-in if in either window (check-in OR check-out).
    - If checked in but not checked out: allow checkout only in checkout window.
    - If already has both: reject.
    """
    if not in_checkin_window and not in_checkout_window:
        raise ValueError("Ngoài khung giờ check-in/check-out")
    if not has_checkin:
        return "checkin"
    if has_checkin and not has_checkout:
        if not in_checkout_window:
            raise ValueError("Đã check-in rồi (chưa đến giờ check-out)")
        return "checkout"
    raise ValueError("Đã check-in và check-out rồi")


def parse_hhmm(value: str) -> time:
    hh, mm = value.split(":", 1)
    return time(int(hh), int(mm))


def is_overnight(*, shift_start: str, shift_end: str) -> bool:
    return parse_hhmm(shift_end) < parse_hhmm(shift_start)


def _resolve_ts_for_day(*, day: date, hhmm: str, shift_start: str, shift_end: str) -> datetime:
    """
    Map an HH:MM to a datetime relative to an attendance day.
    For overnight shifts, HH:MM that is "before shift_start" is treated as next day.
    """
    t = parse_hhmm(hhmm)
    base = datetime.combine(day, t)
    if not is_overnight(shift_start=shift_start, shift_end=shift_end):
        return base
    # Overnight: if time is before shift_start, it belongs to next calendar day
    if t < parse_hhmm(shift_start):
        return base + timedelta(days=1)
    return base


def compute_attendance(
    *,
    day: date,
    checkin_time: datetime | None,
    checkout_time: datetime | None,
    cfg: AttendanceConfig,
) -> AttendanceComputed:
    if checkin_time is None:
        return AttendanceComputed(
            total_minutes=0,
            break_minutes=0,
            working_minutes=0,
            late_minutes=0,
            early_leave_minutes=0,
            overtime_minutes=0,
            auto_checkout_applied=False,
        )

    auto_checkout_applied = False
    cout = checkout_time
    if cout is None:
        cout = _resolve_ts_for_day(day=day, hhmm=cfg.auto_checkout_time, shift_start=cfg.shift_start, shift_end=cfg.shift_end)
        if cout < checkin_time:
            cout = checkin_time
        auto_checkout_applied = True

    if cout < checkin_time:
        cout = checkin_time

    total_minutes = int((cout - checkin_time).total_seconds() // 60)

    break_minutes = 0
    if total_minutes >= int(round(float(cfg.break_threshold_hours) * 60)):
        b_start = _resolve_ts_for_day(day=day, hhmm=cfg.break_start, shift_start=cfg.shift_start, shift_end=cfg.shift_end)
        b_end = _resolve_ts_for_day(day=day, hhmm=cfg.break_end, shift_start=cfg.shift_start, shift_end=cfg.shift_end)
        # break window can itself be overnight
        if b_end < b_start:
            b_end = b_end + timedelta(days=1)
        overlap_start = max(checkin_time, b_start)
        overlap_end = min(cout, b_end)
        overlap = max(0, int((overlap_end - overlap_start).total_seconds() // 60))
        if overlap > 0 and cfg.break_duration_minutes > 0:
            break_minutes = min(overlap, int(cfg.break_duration_minutes))

    working_minutes = max(0, total_minutes - break_minutes)

    shift_start_ts = _resolve_ts_for_day(day=day, hhmm=cfg.shift_start, shift_start=cfg.shift_start, shift_end=cfg.shift_end)
    shift_end_ts = _resolve_ts_for_day(day=day, hhmm=cfg.shift_end, shift_start=cfg.shift_start, shift_end=cfg.shift_end)
    if is_overnight(shift_start=cfg.shift_start, shift_end=cfg.shift_end) and shift_end_ts <= shift_start_ts:
        shift_end_ts = shift_end_ts + timedelta(days=1)

    late_cutoff = shift_start_ts + timedelta(minutes=int(cfg.late_grace_minutes))
    late_minutes = max(0, int((checkin_time - late_cutoff).total_seconds() // 60))

    early_cutoff = shift_end_ts - timedelta(minutes=int(cfg.early_leave_grace_minutes))
    early_leave_minutes = max(0, int((early_cutoff - cout).total_seconds() // 60))

    overtime_minutes = max(0, int((cout - shift_end_ts).total_seconds() // 60))

    return AttendanceComputed(
        total_minutes=total_minutes,
        break_minutes=break_minutes,
        working_minutes=working_minutes,
        late_minutes=late_minutes,
        early_leave_minutes=early_leave_minutes,
        overtime_minutes=overtime_minutes,
        auto_checkout_applied=auto_checkout_applied,
    )

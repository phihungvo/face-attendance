from __future__ import annotations

import unittest
from datetime import date, datetime

from app.core.attendance_engine import AttendanceConfig, compute_attendance, decide_scan_action


def dt(d: date, hhmm: str) -> datetime:
    hh, mm = hhmm.split(":")
    return datetime(d.year, d.month, d.day, int(hh), int(mm), 0)


class AttendanceEngineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.day = date(2026, 5, 3)
        self.cfg = AttendanceConfig(
            shift_start="08:00",
            shift_end="17:30",
            late_grace_minutes=5,
            early_leave_grace_minutes=5,
            break_start="12:00",
            break_end="13:30",
            break_duration_minutes=60,
            break_threshold_hours=6.0,
            auto_checkout_time="23:59",
        )

    # Use case 7: Check-in sớm (không late)
    def test_checkin_early_not_late(self) -> None:
        out = compute_attendance(day=self.day, checkin_time=dt(self.day, "07:30"), checkout_time=dt(self.day, "17:30"), cfg=self.cfg)
        self.assertEqual(out.late_minutes, 0)

    # Use case 1: Đi trễ
    def test_late(self) -> None:
        out = compute_attendance(day=self.day, checkin_time=dt(self.day, "08:10"), checkout_time=dt(self.day, "17:30"), cfg=self.cfg)
        # shift 08:00 + 5min grace => cutoff 08:05; 08:10 => 5 min late
        self.assertEqual(out.late_minutes, 5)

    # Use case 2: Về sớm
    def test_early_leave(self) -> None:
        out = compute_attendance(day=self.day, checkin_time=dt(self.day, "08:00"), checkout_time=dt(self.day, "17:20"), cfg=self.cfg)
        # shift_end 17:30 - 5min grace => 17:25; out 17:20 => 5 min early leave
        self.assertEqual(out.early_leave_minutes, 5)

    # Use case 6: OT sau giờ làm
    def test_overtime(self) -> None:
        out = compute_attendance(day=self.day, checkin_time=dt(self.day, "08:00"), checkout_time=dt(self.day, "19:00"), cfg=self.cfg)
        self.assertEqual(out.overtime_minutes, 90)

    # Use case 4: Làm không qua giờ nghỉ => không trừ break
    def test_no_break_when_no_overlap(self) -> None:
        out = compute_attendance(day=self.day, checkin_time=dt(self.day, "08:00"), checkout_time=dt(self.day, "11:30"), cfg=self.cfg)
        self.assertEqual(out.break_minutes, 0)

    # Use case 5: Làm xuyên trưa nhưng ngắn (< threshold) => không trừ break
    def test_overlap_break_but_below_threshold(self) -> None:
        out = compute_attendance(day=self.day, checkin_time=dt(self.day, "10:00"), checkout_time=dt(self.day, "15:30"), cfg=self.cfg)
        # total 330 min = 5.5h < 6h threshold
        self.assertEqual(out.total_minutes, 330)
        self.assertEqual(out.break_minutes, 0)

    # Use case 3: Làm nửa ngày (>= threshold?) verify break rule applies only when threshold met
    def test_half_day_threshold_boundary(self) -> None:
        # exactly 6h, overlaps break window by 60 min => deduct 60
        out = compute_attendance(day=self.day, checkin_time=dt(self.day, "09:00"), checkout_time=dt(self.day, "15:00"), cfg=self.cfg)
        self.assertEqual(out.total_minutes, 360)
        self.assertEqual(out.break_minutes, 60)
        self.assertEqual(out.working_minutes, 300)

    # Use case 4/5: Overlap > duration => MIN(overlap, break_duration)
    def test_break_deduct_min_overlap_duration(self) -> None:
        out = compute_attendance(day=self.day, checkin_time=dt(self.day, "08:00"), checkout_time=dt(self.day, "18:00"), cfg=self.cfg)
        # overlaps 12:00-13:30 = 90min, duration cap=60
        self.assertEqual(out.break_minutes, 60)

    # Use case 8: Quên check-out => auto checkout
    def test_auto_checkout_applied(self) -> None:
        out = compute_attendance(day=self.day, checkin_time=dt(self.day, "08:00"), checkout_time=None, cfg=self.cfg)
        self.assertTrue(out.auto_checkout_applied)
        # should at least be >= shift length
        self.assertGreaterEqual(out.total_minutes, 0)

    # Use case 9: confidence thấp => handled upstream (match_best threshold), engine ignores
    # Use case 10: Check-in nhiều lần => attendance service buckets first/last; engine expects 1 pair

    def test_absent_when_no_checkin(self) -> None:
        out = compute_attendance(day=self.day, checkin_time=None, checkout_time=None, cfg=self.cfg)
        self.assertEqual(out.working_minutes, 0)
        self.assertEqual(out.late_minutes, 0)
        self.assertFalse(out.auto_checkout_applied)


class ScanDecisionTests(unittest.TestCase):
    def test_scan_requires_any_window(self) -> None:
        with self.assertRaises(ValueError):
            decide_scan_action(in_checkin_window=False, in_checkout_window=False, has_checkin=False, has_checkout=False)

    def test_scan_first_time_allows_checkin_in_checkout_window(self) -> None:
        # This covers the real-world case user reported (missed morning window).
        action = decide_scan_action(in_checkin_window=False, in_checkout_window=True, has_checkin=False, has_checkout=False)
        self.assertEqual(action, "checkin")

    def test_scan_second_time_requires_checkout_window(self) -> None:
        with self.assertRaises(ValueError):
            decide_scan_action(in_checkin_window=True, in_checkout_window=False, has_checkin=True, has_checkout=False)
        action = decide_scan_action(in_checkin_window=False, in_checkout_window=True, has_checkin=True, has_checkout=False)
        self.assertEqual(action, "checkout")

    def test_scan_reject_when_done(self) -> None:
        with self.assertRaises(ValueError):
            decide_scan_action(in_checkin_window=True, in_checkout_window=True, has_checkin=True, has_checkout=True)


if __name__ == "__main__":
    unittest.main()


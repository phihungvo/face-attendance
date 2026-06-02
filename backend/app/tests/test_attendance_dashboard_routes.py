from __future__ import annotations

from datetime import datetime
import unittest
from unittest.mock import patch

from app.api.v1.routes import attendance


class TestAttendanceDashboardRoutes(unittest.TestCase):
    @patch("app.api.v1.routes.attendance.service")
    def test_dashboard_today_returns_split_payload(self, service) -> None:
        service.manager_dashboard_today.return_value = {
            "day": "2026-06-02",
            "total_users": 10,
            "present_count": 8,
            "absent_count": 2,
            "late_count": 1,
            "checked_out_count": 3,
            "working_count": 5,
            "attendance_rate": 80.0,
        }

        res = attendance.dashboard_today(db=object(), company_id=7, _=object())

        self.assertEqual(res.result.day, "2026-06-02")
        self.assertEqual(res.result.present_count, 8)
        service.manager_dashboard_today.assert_called_once()
        self.assertEqual(service.manager_dashboard_today.call_args.kwargs["company_id"], 7)

    @patch("app.api.v1.routes.attendance.service")
    def test_dashboard_trend_accepts_days(self, service) -> None:
        service.manager_dashboard_trend.return_value = [
            {
                "day": "2026-05-27",
                "label": "T4",
                "present_count": 8,
                "absent_count": 2,
                "late_count": 1,
                "attendance_rate": 80.0,
            }
        ]

        res = attendance.dashboard_trend(days=14, db=object(), company_id=7, _=object())

        self.assertEqual(len(res.result), 1)
        self.assertEqual(res.result[0].label, "T4")
        service.manager_dashboard_trend.assert_called_once()
        self.assertEqual(service.manager_dashboard_trend.call_args.kwargs["company_id"], 7)
        self.assertEqual(service.manager_dashboard_trend.call_args.kwargs["days"], 14)

    @patch("app.api.v1.routes.attendance.service")
    def test_dashboard_departments_returns_rows(self, service) -> None:
        service.manager_dashboard_departments.return_value = [
            {
                "department_id": 3,
                "department_name": "Kinh doanh",
                "total_users": 5,
                "present_count": 4,
                "absent_count": 1,
                "late_count": 0,
                "attendance_rate": 80.0,
            }
        ]

        res = attendance.dashboard_departments(db=object(), company_id=7, _=object())

        self.assertEqual(res.result[0].department_name, "Kinh doanh")
        service.manager_dashboard_departments.assert_called_once()

    @patch("app.api.v1.routes.attendance.service")
    def test_dashboard_leave_endpoints_return_split_payloads(self, service) -> None:
        service.manager_dashboard_leave_summary.return_value = {
            "pending_count": 2,
            "approved_count": 5,
            "rejected_count": 1,
        }
        service.manager_dashboard_pending_leaves.return_value = [
            {
                "id": 11,
                "user_id": 4,
                "user_name": "Nguyen Van A",
                "user_code": "NV004",
                "department_name": "Van phong",
                "type": "annual",
                "start_date": "2026-06-03",
                "end_date": "2026-06-04",
                "status": "pending",
                "created_at": datetime(2026, 6, 2, 8, 30),
            }
        ]

        summary = attendance.dashboard_leave_summary(db=object(), company_id=7, _=object())
        pending = attendance.dashboard_pending_leaves(limit=10, db=object(), company_id=7, _=object())

        self.assertEqual(summary.result.pending_count, 2)
        self.assertEqual(pending.result[0].user_name, "Nguyen Van A")
        self.assertEqual(service.manager_dashboard_pending_leaves.call_args.kwargs["limit"], 10)

    @patch("app.api.v1.routes.attendance.service")
    def test_dashboard_recent_logs_accepts_limit(self, service) -> None:
        service.manager_dashboard_recent_logs.return_value = [
            {
                "id": 20,
                "user_id": 4,
                "user_name": "Nguyen Van A",
                "user_code": "NV004",
                "type": "checkin",
                "confidence": 0.923,
                "timestamp": datetime(2026, 6, 2, 8, 1),
            }
        ]

        res = attendance.dashboard_recent_logs(limit=12, db=object(), company_id=7, _=object())

        self.assertEqual(res.result[0].type, "checkin")
        self.assertEqual(service.manager_dashboard_recent_logs.call_args.kwargs["limit"], 12)


if __name__ == "__main__":
    unittest.main()

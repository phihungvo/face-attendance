from __future__ import annotations

from datetime import datetime
import unittest
from unittest.mock import patch

from app.api.v1.routes.attendance import _notify_attendance_success


class TestAttendanceNotificationRoutes(unittest.TestCase):
    @patch("app.api.v1.routes.attendance.notification_service")
    def test_checkin_late_emits_employee_and_manager_notifications(self, notification_service) -> None:
        _notify_attendance_success(
            object(),
            user_id=12,
            company_id=3,
            actor_user_id=12,
            action="checkin",
            ts=datetime(2026, 5, 19, 9, 17, 0),
            user_name="Nguyen Van A",
            late_minutes=12,
        )

        notification_service.create_for_users.assert_called_once()
        notification_service.create_for_permission.assert_called_once()
        self.assertEqual(notification_service.create_for_permission.call_args.kwargs["type"], "attendance.late_detected")
        self.assertEqual(notification_service.create_for_permission.call_args.kwargs["permission_key"], "attendance.read")
        self.assertEqual(notification_service.create_for_permission.call_args.kwargs["exclude_user_ids"], [12])

    @patch("app.api.v1.routes.attendance.notification_service")
    def test_on_time_checkin_does_not_emit_manager_late_alert(self, notification_service) -> None:
        _notify_attendance_success(
            object(),
            user_id=12,
            company_id=3,
            actor_user_id=12,
            action="checkin",
            ts=datetime(2026, 5, 19, 8, 59, 0),
            user_name="Nguyen Van A",
            late_minutes=0,
        )

        notification_service.create_for_users.assert_called_once()
        notification_service.create_for_permission.assert_not_called()

    @patch("app.api.v1.routes.attendance.notification_service")
    def test_checkout_does_not_emit_manager_late_alert(self, notification_service) -> None:
        _notify_attendance_success(
            object(),
            user_id=12,
            company_id=3,
            actor_user_id=12,
            action="checkout",
            ts=datetime(2026, 5, 19, 17, 30, 0),
            user_name="Nguyen Van A",
            late_minutes=18,
        )

        notification_service.create_for_users.assert_called_once()
        notification_service.create_for_permission.assert_not_called()

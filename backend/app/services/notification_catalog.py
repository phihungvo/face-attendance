from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class NotificationEventSpec:
    key: str
    category: str
    severity: str


EVENT_SPECS: dict[str, NotificationEventSpec] = {
    "attendance.checkin.success": NotificationEventSpec("attendance.checkin.success", "attendance", "success"),
    "attendance.checkout.success": NotificationEventSpec("attendance.checkout.success", "attendance", "success"),
    "attendance.face_mismatch": NotificationEventSpec("attendance.face_mismatch", "attendance", "warning"),
    "attendance.geo_rejected": NotificationEventSpec("attendance.geo_rejected", "attendance", "warning"),
    "attendance.time_window_rejected": NotificationEventSpec("attendance.time_window_rejected", "attendance", "warning"),
    "attendance.timelog.updated": NotificationEventSpec("attendance.timelog.updated", "attendance", "info"),
    "attendance.timelog.deleted": NotificationEventSpec("attendance.timelog.deleted", "attendance", "warning"),
    "leave.created": NotificationEventSpec("leave.created", "leave", "info"),
    "leave.updated": NotificationEventSpec("leave.updated", "leave", "info"),
    "leave.cancelled": NotificationEventSpec("leave.cancelled", "leave", "warning"),
    "leave.approved": NotificationEventSpec("leave.approved", "leave", "success"),
    "leave.rejected": NotificationEventSpec("leave.rejected", "leave", "warning"),
    "schedule.request.created": NotificationEventSpec("schedule.request.created", "schedule", "info"),
    "schedule.request.approved": NotificationEventSpec("schedule.request.approved", "schedule", "success"),
    "schedule.request.rejected": NotificationEventSpec("schedule.request.rejected", "schedule", "warning"),
    "schedule.registration.created": NotificationEventSpec("schedule.registration.created", "schedule", "info"),
    "schedule.registration.approved": NotificationEventSpec("schedule.registration.approved", "schedule", "success"),
    "schedule.registration.rejected": NotificationEventSpec("schedule.registration.rejected", "schedule", "warning"),
    "schedule.registration.cancelled": NotificationEventSpec("schedule.registration.cancelled", "schedule", "warning"),
    "settings.attendance_policy.updated": NotificationEventSpec("settings.attendance_policy.updated", "settings", "info"),
    "company.gps_policy.updated": NotificationEventSpec("company.gps_policy.updated", "settings", "warning"),
    "user.invite.sent": NotificationEventSpec("user.invite.sent", "iam", "info"),
    "user.account.activated": NotificationEventSpec("user.account.activated", "iam", "success"),
    "user.permissions.changed": NotificationEventSpec("user.permissions.changed", "iam", "warning"),
    "user.password.changed": NotificationEventSpec("user.password.changed", "iam", "info"),
}


CATEGORY_PREFERENCE_FIELD = {
    "attendance": "attendance_enabled",
    "leave": "leave_enabled",
    "schedule": "schedule_enabled",
    "settings": "settings_enabled",
    "iam": "iam_enabled",
    "system": "system_enabled",
}


COMPANY_POLICY_EVENT_FIELD = {
    "attendance.late_detected": "late_attendance_enabled",
    "attendance.absent_detected": "absent_attendance_enabled",
    "leave.created": "new_leave_request_enabled",
    "report.daily.summary": "daily_report_enabled",
    "overtime.request.created": "overtime_request_enabled",
    "settings.attendance_policy.updated": "attendance_policy_change_enabled",
    "company.gps_policy.updated": "gps_policy_change_enabled",
}

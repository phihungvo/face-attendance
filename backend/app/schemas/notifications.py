from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notification_id: int
    company_id: int | None = None
    type: str
    category: str
    severity: str
    title: str
    body: str | None = None
    entity_type: str | None = None
    entity_id: int | None = None
    action_url: str | None = None
    is_read: bool
    read_at: datetime | None = None
    is_archived: bool = False
    archived_at: datetime | None = None
    created_at: datetime


class NotificationListResponse(BaseModel):
    items: list[NotificationOut]
    total: int


class NotificationUnreadCountOut(BaseModel):
    unread_count: int


class NotificationPreferenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    realtime_toast_enabled: bool
    attendance_enabled: bool
    leave_enabled: bool
    schedule_enabled: bool
    settings_enabled: bool
    iam_enabled: bool
    system_enabled: bool


class NotificationPreferenceUpdateRequest(BaseModel):
    realtime_toast_enabled: bool
    attendance_enabled: bool
    leave_enabled: bool
    schedule_enabled: bool
    settings_enabled: bool
    iam_enabled: bool
    system_enabled: bool


class CompanyNotificationPolicyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    late_attendance_enabled: bool
    absent_attendance_enabled: bool
    new_leave_request_enabled: bool
    daily_report_enabled: bool
    overtime_request_enabled: bool
    attendance_policy_change_enabled: bool
    gps_policy_change_enabled: bool


class CompanyNotificationPolicyUpdateRequest(BaseModel):
    late_attendance_enabled: bool
    absent_attendance_enabled: bool
    new_leave_request_enabled: bool
    daily_report_enabled: bool
    overtime_request_enabled: bool
    attendance_policy_change_enabled: bool
    gps_policy_change_enabled: bool

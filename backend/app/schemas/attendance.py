from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AttendanceLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    user_name: str | None = None
    type: str
    confidence: float
    latitude: float | None = None
    longitude: float | None = None
    distance_meters: float | None = None
    geo_ok: bool | None = None
    timestamp: datetime


class CheckInResponse(BaseModel):
    user_name: str
    confidence: float
    time: datetime


class CheckOutResponse(BaseModel):
    user_name: str
    confidence: float
    time: datetime


class ScanResponse(BaseModel):
    user_name: str
    confidence: float
    time: datetime
    action: str  # "checkin" | "checkout"


class AttendanceHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    employee_name: str | None = None
    employee_code: str | None = None
    type: str
    check_time: datetime
    confidence_score: float
    image_url: str | None = None
    image_size_kb: int | None = None
    image_format: str | None = None
    upload_status: str
    created_at: datetime


class AttendanceEvidenceUrlOut(BaseModel):
    history_id: int
    url: str
    expires_in_seconds: int


class DailyAttendanceRow(BaseModel):
    user_id: int
    user_name: str
    date: str  # YYYY-MM-DD
    checkin_time: datetime | None
    checkout_time: datetime | None
    work_hours: float
    late: bool
    absent: bool


class MonthlyReportRow(BaseModel):
    user_id: int
    user_name: str
    month: str  # YYYY-MM
    total_work_hours: float
    late_days: int
    absent_days: int


class TimelogRow(BaseModel):
    user_id: int
    user_name: str
    user_code: str | None = None
    department_id: int | None = None
    department_name: str | None = None
    date: str  # YYYY-MM-DD
    checkin_time: datetime | None
    checkout_time: datetime | None
    work_hours: float
    late: bool
    absent: bool
    break_minutes: int | None = None
    working_minutes: int | None = None
    late_minutes: int | None = None
    early_leave_minutes: int | None = None
    overtime_minutes: int | None = None
    auto_checkout_applied: bool | None = None
    method: str = "Face"


class TimelogUpsertRequest(BaseModel):
    checkin_time: datetime | None = None
    checkout_time: datetime | None = None


class AttendanceStats(BaseModel):
    from_date: str  # YYYY-MM-DD
    to_date: str  # YYYY-MM-DD (inclusive)
    total_users: int
    total_checkins: int
    total_checkouts: int
    late_count: int


class ManagerDashboardTodaySummary(BaseModel):
    day: str
    total_users: int
    present_count: int
    absent_count: int
    late_count: int
    checked_out_count: int
    working_count: int
    attendance_rate: float


class ManagerDashboardTrendPoint(BaseModel):
    day: str
    label: str
    present_count: int
    absent_count: int
    late_count: int
    attendance_rate: float


class ManagerDashboardDepartmentRow(BaseModel):
    department_id: int | None = None
    department_name: str
    total_users: int
    present_count: int
    absent_count: int
    late_count: int
    attendance_rate: float


class ManagerDashboardLeaveSummary(BaseModel):
    pending_count: int
    approved_count: int
    rejected_count: int


class ManagerDashboardPendingLeaveItem(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_code: str | None = None
    department_name: str | None = None
    type: str
    start_date: str
    end_date: str
    status: str
    created_at: datetime


class ManagerDashboardRecentLogItem(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_code: str | None = None
    type: str
    confidence: float
    timestamp: datetime


class ManagerDashboardWorkHoursEmployee(BaseModel):
    rank: int
    user_id: int
    user_name: str
    user_code: str | None = None
    department_id: int | None = None
    department_name: str | None = None
    total_work_hours: float
    working_days: int
    late_days: int
    absent_days: int
    average_hours_per_day: float


class ManagerDashboardWorkHoursSummary(BaseModel):
    period: str
    from_date: str
    to_date: str
    total_work_hours: float
    average_work_hours: float
    employee_count: int
    top_employee_name: str | None = None
    employees: list[ManagerDashboardWorkHoursEmployee]


class ManagerDashboardSummary(BaseModel):
    generated_at: datetime
    today: ManagerDashboardTodaySummary
    trend: list[ManagerDashboardTrendPoint]
    departments: list[ManagerDashboardDepartmentRow]
    leave_summary: ManagerDashboardLeaveSummary
    pending_leaves: list[ManagerDashboardPendingLeaveItem]
    recent_logs: list[ManagerDashboardRecentLogItem]

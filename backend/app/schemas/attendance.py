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
    timestamp: datetime


class CheckInResponse(BaseModel):
    user_name: str
    confidence: float
    time: datetime


class CheckOutResponse(BaseModel):
    user_name: str
    confidence: float
    time: datetime


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

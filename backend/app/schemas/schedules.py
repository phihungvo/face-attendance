from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


def _days_mask_to_list(mask: int) -> list[int]:
    out: list[int] = []
    for i in range(7):
        if int(mask or 0) & (1 << i):
            out.append(i)
    return out


def _days_list_to_mask(days: list[int] | None) -> int:
    if not days:
        return 0
    m = 0
    for d in days:
        if int(d) < 0 or int(d) > 6:
            continue
        m |= 1 << int(d)
    return m


class WorkScheduleOut(BaseModel):
    id: int
    company_id: int
    code: str
    name: str
    status: str
    shift_start: str
    shift_end: str
    late_grace_minutes: int
    early_leave_grace_minutes: int
    break_start: str
    break_end: str
    break_duration_minutes: int
    break_threshold_hours: float
    auto_checkout_time: str
    department_id: int | None = None
    max_registrations: int = 0
    days_of_week: list[int] = Field(default_factory=list, description="0=Mon..6=Sun")
    date_start: date | None = None
    date_end: date | None = None
    note: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @staticmethod
    def from_orm_row(obj: object) -> "WorkScheduleOut":
        data = WorkScheduleOut.model_validate(obj).model_dump()
        mask = int(getattr(obj, "days_of_week_mask", 0) or 0)
        data["days_of_week"] = _days_mask_to_list(mask)
        return WorkScheduleOut(**data)


class WorkScheduleCreateRequest(BaseModel):
    code: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=2, max_length=255)
    status: str | None = Field(default="active", max_length=16)

    shift_start: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    shift_end: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    late_grace_minutes: int = Field(default=0, ge=0, le=600)
    early_leave_grace_minutes: int = Field(default=0, ge=0, le=600)

    break_start: str = Field(default="12:00", pattern=r"^\d{2}:\d{2}$")
    break_end: str = Field(default="13:00", pattern=r"^\d{2}:\d{2}$")
    break_duration_minutes: int = Field(default=60, ge=0, le=600)
    break_threshold_hours: float = Field(default=6.0, ge=0.0, le=24.0)

    auto_checkout_time: str = Field(default="23:59", pattern=r"^\d{2}:\d{2}$")

    department_id: int | None = Field(default=None)
    max_registrations: int = Field(default=0, ge=0, le=100000)
    days_of_week: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 5, 6], description="0=Mon..6=Sun")
    date_start: date | None = Field(default=None)
    date_end: date | None = Field(default=None)
    note: str | None = Field(default=None, max_length=255)


class WorkScheduleUpdateRequest(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=64)
    name: str | None = Field(default=None, min_length=2, max_length=255)
    status: str | None = Field(default=None, max_length=16)

    shift_start: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    shift_end: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    late_grace_minutes: int | None = Field(default=None, ge=0, le=600)
    early_leave_grace_minutes: int | None = Field(default=None, ge=0, le=600)

    break_start: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    break_end: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    break_duration_minutes: int | None = Field(default=None, ge=0, le=600)
    break_threshold_hours: float | None = Field(default=None, ge=0.0, le=24.0)

    auto_checkout_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")

    department_id: int | None = Field(default=None)
    max_registrations: int | None = Field(default=None, ge=0, le=100000)
    days_of_week: list[int] | None = Field(default=None, description="0=Mon..6=Sun")
    date_start: date | None = Field(default=None)
    date_end: date | None = Field(default=None)
    note: str | None = Field(default=None, max_length=255)


class WorkScheduleRegistrationOut(BaseModel):
    id: int
    company_id: int
    user_id: int
    schedule_id: int
    day: date
    status: str
    note: str | None = None
    response_note: str | None = None
    approved_by_user_id: int | None = None
    approved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkScheduleRegistrationCreateMeRequest(BaseModel):
    schedule_id: int
    day: date
    note: str | None = Field(default=None, max_length=255)


class WorkScheduleRegistrationBulkCreateMeRequest(BaseModel):
    schedule_id: int
    days: list[date] = Field(min_length=1, max_length=186)
    note: str | None = Field(default=None, max_length=255)


class WorkScheduleRegistrationRequestCreateMeRequest(BaseModel):
    schedule_id: int
    days: list[date] = Field(min_length=1, max_length=186)
    note: str | None = Field(default=None, max_length=255)


class WorkScheduleRegistrationRequestOut(BaseModel):
    id: int
    company_id: int
    user_id: int
    schedule_id: int
    date_from: date
    date_to: date
    days_of_week_mask: int
    status: str
    note: str | None = None
    response_note: str | None = None
    approved_by_user_id: int | None = None
    approved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkScheduleRegistrationRequestListItem(BaseModel):
    id: int
    date_from: date
    date_to: date
    days_of_week_mask: int
    status: str
    note: str | None
    response_note: str | None = None
    user_id: int
    user_name: str
    user_code: str | None = None
    schedule_id: int
    schedule_code: str
    schedule_name: str
    approved_by_user_id: int | None = None
    approved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class WorkScheduleRegistrationRequestListResponse(BaseModel):
    items: list[WorkScheduleRegistrationRequestListItem]
    total: int


class WorkScheduleRegistrationAssignRequest(BaseModel):
    user_id: int
    schedule_id: int
    day: date
    status: str | None = Field(default="approved", max_length=16)  # approved|pending
    note: str | None = Field(default=None, max_length=255, description="Ghi chú của quản lý (response_note)")


class WorkScheduleRegistrationListItem(BaseModel):
    id: int
    day: date
    status: str
    note: str | None
    response_note: str | None = None
    user_id: int
    user_name: str
    user_code: str | None = None
    department_id: int | None = None
    schedule_id: int
    schedule_code: str
    schedule_name: str
    approved_by_user_id: int | None = None
    approved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class WorkScheduleRegistrationListResponse(BaseModel):
    items: list[WorkScheduleRegistrationListItem]
    total: int

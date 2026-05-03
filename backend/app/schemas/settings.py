from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class AttendancePolicyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    timezone: str = Field(..., min_length=1, max_length=64)
    face_match_threshold: float = Field(..., ge=0.1, le=0.99)

    shift_start: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    shift_end: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    late_grace_minutes: int = Field(..., ge=0, le=240)
    early_leave_grace_minutes: int = Field(..., ge=0, le=240)

    break_start: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    break_end: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    break_duration_minutes: int = Field(..., ge=0, le=240)
    break_threshold_hours: float = Field(..., ge=0, le=24)

    auto_checkout_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")

    checkin_from: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    checkin_to: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    checkout_from: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    checkout_to: str = Field(..., pattern=r"^\d{2}:\d{2}$")

    min_minutes_between_same_type: int = Field(..., ge=0, le=120)


class AttendancePolicyUpdateRequest(BaseModel):
    timezone: str = Field(..., min_length=1, max_length=64)
    face_match_threshold: float = Field(..., ge=0.1, le=0.99)

    shift_start: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    shift_end: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    late_grace_minutes: int = Field(..., ge=0, le=240)
    early_leave_grace_minutes: int = Field(..., ge=0, le=240)

    break_start: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    break_end: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    break_duration_minutes: int = Field(..., ge=0, le=240)
    break_threshold_hours: float = Field(..., ge=0, le=24)

    auto_checkout_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")

    checkin_from: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    checkin_to: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    checkout_from: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    checkout_to: str = Field(..., pattern=r"^\d{2}:\d{2}$")

    min_minutes_between_same_type: int = Field(..., ge=0, le=120)

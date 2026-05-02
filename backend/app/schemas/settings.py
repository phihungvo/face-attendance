from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class AttendancePolicyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    shift_start: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    late_grace_minutes: int = Field(..., ge=0, le=240)

    checkin_from: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    checkin_to: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    checkout_from: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    checkout_to: str = Field(..., pattern=r"^\d{2}:\d{2}$")

    min_minutes_between_same_type: int = Field(..., ge=0, le=120)


class AttendancePolicyUpdateRequest(BaseModel):
    shift_start: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    late_grace_minutes: int = Field(..., ge=0, le=240)

    checkin_from: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    checkin_to: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    checkout_from: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    checkout_to: str = Field(..., pattern=r"^\d{2}:\d{2}$")

    min_minutes_between_same_type: int = Field(..., ge=0, le=120)


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


class AttendanceEvidenceSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    enable_evidence_image: bool
    image_quality: int = Field(..., ge=30, le=95)
    image_max_width: int = Field(..., ge=240, le=4096)
    image_format: str = Field(..., pattern=r"^(webp|jpeg)$")
    image_retention_days: int = Field(..., ge=1, le=3650)


class AttendanceEvidenceSettingsUpdateRequest(BaseModel):
    enable_evidence_image: bool
    image_quality: int = Field(..., ge=30, le=95)
    image_max_width: int = Field(..., ge=240, le=4096)
    image_format: str = Field(..., pattern=r"^(webp|jpeg)$")
    image_retention_days: int = Field(..., ge=1, le=3650)


class AuthRegistrationSettingsOut(BaseModel):
    public_registration_enabled: bool
    account_onboarding_mode: str


class AuthRegistrationSettingsUpdateRequest(BaseModel):
    public_registration_enabled: bool

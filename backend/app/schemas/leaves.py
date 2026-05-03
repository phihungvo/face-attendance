from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class LeaveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    user_name: str | None = None
    user_code: str | None = None
    department_id: int | None = None

    type: str
    start_date: date
    end_date: date
    reason: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime


class LeaveCreateRequest(BaseModel):
    user_id: int
    type: str = Field(..., min_length=1, max_length=32)
    start_date: date
    end_date: date
    reason: str | None = Field(default=None, max_length=2000)


class LeaveUpdateRequest(BaseModel):
    user_id: int
    type: str = Field(..., min_length=1, max_length=32)
    start_date: date
    end_date: date
    reason: str | None = Field(default=None, max_length=2000)
    status: str | None = Field(default=None, max_length=16)


class LeaveListResponse(BaseModel):
    items: list[LeaveOut]
    total: int


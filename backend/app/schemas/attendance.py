from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AttendanceLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    type: str
    confidence: float
    timestamp: datetime


class CheckInResponse(BaseModel):
    user_name: str
    confidence: float
    time: datetime

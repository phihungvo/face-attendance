from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime


class EnrollResponse(BaseModel):
    user_id: int = Field(..., description="Created user id")
    status: str = Field(..., description="enrolled")

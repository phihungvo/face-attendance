from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str | None = None
    code: str | None = None
    name: str
    email: str | None = None
    role: str | None = None
    status: str
    auth_status: str | None = None
    invite_sent_at: datetime | None = None
    invite_accepted_at: datetime | None = None
    department_id: int | None = None
    created_at: datetime


class UserMeOut(UserOut):
    department_name: str | None = None


class UserUpdateRequest(BaseModel):
    code: str | None = Field(default=None, max_length=32)
    name: str = Field(..., min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    role: str | None = Field(default=None, max_length=64)
    status: str | None = Field(default=None, max_length=16)
    department_id: int | None = None


class UserCreateRequest(BaseModel):
    code: str | None = Field(default=None, max_length=32)
    name: str = Field(..., min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    role: str | None = Field(default=None, max_length=64)
    status: str | None = Field(default=None, max_length=16)
    department_id: int | None = None
    create_login: bool = Field(default=True, description="Tạo account đăng nhập + gửi email kích hoạt")


class EnrollResponse(BaseModel):
    user_id: int = Field(..., description="Created user id")
    status: str = Field(..., description="enrolled")


class FaceEnrollStatusOut(BaseModel):
    last_enrolled_at: datetime | None
    next_allowed_at: datetime | None

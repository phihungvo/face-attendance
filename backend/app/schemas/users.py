from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str | None = None
    code: str | None = None
    name: str
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    citizen_id: str | None = None
    citizen_id_place: str | None = None
    hire_date: date | None = None
    role: str | None = None
    status: str
    auth_status: str | None = None
    invite_sent_at: datetime | None = None
    invite_accepted_at: datetime | None = None
    department_id: int | None = None
    created_at: datetime


class UserMeOut(UserOut):
    department_name: str | None = None


class UserSelfUpdateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    address: str | None = Field(default=None, max_length=255)
    citizen_id: str | None = Field(default=None, max_length=32)
    citizen_id_place: str | None = Field(default=None, max_length=255)


class UserUpdateRequest(BaseModel):
    code: str | None = Field(default=None, max_length=32)
    name: str = Field(..., min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    address: str | None = Field(default=None, max_length=255)
    citizen_id: str | None = Field(default=None, max_length=32)
    citizen_id_place: str | None = Field(default=None, max_length=255)
    hire_date: date | None = None
    role: str | None = Field(default=None, max_length=64)
    status: str | None = Field(default=None, max_length=16)
    department_id: int | None = None


class UserCreateRequest(BaseModel):
    code: str | None = Field(default=None, max_length=32)
    name: str = Field(..., min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    address: str | None = Field(default=None, max_length=255)
    citizen_id: str | None = Field(default=None, max_length=32)
    citizen_id_place: str | None = Field(default=None, max_length=255)
    hire_date: date | None = None
    role: str | None = Field(default=None, max_length=64)
    status: str | None = Field(default=None, max_length=16)
    department_id: int | None = None
    create_login: bool = Field(default=True, description="Tạo account đăng nhập + gửi email kích hoạt")
    portal_role_key: str | None = Field(default=None, max_length=64, description="RBAC role key for portal access (employee/manager)")


class EnrollResponse(BaseModel):
    user_id: int = Field(..., description="Created user id")
    status: str = Field(..., description="enrolled")


class FaceEnrollStatusOut(BaseModel):
    last_enrolled_at: datetime | None
    next_allowed_at: datetime | None

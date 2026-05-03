from __future__ import annotations

from pydantic import BaseModel, Field


class PermissionOut(BaseModel):
    id: int
    key: str
    label: str
    description: str | None = None

    model_config = {"from_attributes": True}


class RoleOut(BaseModel):
    id: int
    key: str
    label: str
    description: str | None = None
    permission_keys: list[str]


class RoleCreateRequest(BaseModel):
    key: str = Field(min_length=2, max_length=64)
    label: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)
    permission_keys: list[str] = Field(default_factory=list)


class RoleUpdateRequest(BaseModel):
    label: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)
    permission_keys: list[str] = Field(default_factory=list)


class AccountOut(BaseModel):
    id: int
    username: str
    role_keys: list[str]
    permission_keys: list[str]

    model_config = {"from_attributes": True}


class AccountCreateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    role_keys: list[str] = Field(default_factory=list)


class AccountUpdateRequest(BaseModel):
    role_keys: list[str] = Field(default_factory=list)
    permission_keys: list[str] = Field(default_factory=list)


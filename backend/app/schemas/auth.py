from __future__ import annotations

from pydantic import BaseModel, Field, AliasChoices


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    role: str = Field(default="employee", max_length=64)


class LoginRequest(BaseModel):
    # Allow login by username/email/employee code.
    # Accept both legacy `username` and new `identifier` keys.
    identifier: str = Field(validation_alias=AliasChoices("identifier", "username"), min_length=3, max_length=255)
    password: str = Field(min_length=6, max_length=128)


class ActivateRequest(BaseModel):
    token: str = Field(min_length=10, max_length=512)
    password: str = Field(min_length=6, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=6, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"


class MeResponse(BaseModel):
    user_id: int
    username: str
    company_id: int | None = None
    company_name: str | None = None
    company_logo_data_url: str | None = None
    role_keys: list[str]
    permission_keys: list[str]

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CompanyMiniOut(BaseModel):
    id: int
    code: str
    name: str


class MemberMiniOut(BaseModel):
    id: int
    name: str
    email: str | None = None


class CompanyInvitationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int
    email: str
    status: str
    invited_by_user_id: int | None = None
    responded_by_user_id: int | None = None
    responded_at: datetime | None = None
    expires_at: datetime | None = None
    created_at: datetime
    company: CompanyMiniOut | None = None


class CompanyJoinRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int
    user_id: int
    status: str
    reviewed_by_user_id: int | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    company: CompanyMiniOut | None = None
    user: MemberMiniOut | None = None


class CompanyMembershipMeOut(BaseModel):
    company: CompanyMiniOut | None = None
    membership_status: str | None = None
    invitations: list[CompanyInvitationOut] = Field(default_factory=list)
    pending_request: CompanyJoinRequestOut | None = None


class CompanyInviteCreateRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)


class CompanyJoinRequestCreateRequest(BaseModel):
    company_code: str = Field(min_length=2, max_length=64)

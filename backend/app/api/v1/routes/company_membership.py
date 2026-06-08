from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_company_scope_id, get_current_user, require_permission
from app.core.errors import BAD_REQUEST, AppException
from app.core.response import ok
from app.db.session import get_db
from app.schemas.common import ApiResponse
from app.schemas.company_membership import (
    CompanyInvitationOut,
    CompanyInviteCreateRequest,
    CompanyJoinRequestCreateRequest,
    CompanyJoinRequestOut,
    CompanyMembershipMeOut,
)
from app.services.company_membership import CompanyMembershipService

router = APIRouter()
service = CompanyMembershipService()


def _require_company_scope(company_id: int | None) -> int:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Chưa chọn công ty")
    return int(company_id)


@router.get("/me", response_model=ApiResponse[CompanyMembershipMeOut])
def my_company_membership(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> ApiResponse[CompanyMembershipMeOut]:
    try:
        return ok(CompanyMembershipMeOut(**service.get_my_membership(db, user_id=int(user.id))))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/invitations", response_model=ApiResponse[CompanyInvitationOut])
def create_invitation(
    payload: CompanyInviteCreateRequest,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    user=Depends(require_permission("employees.manage")),
) -> ApiResponse[CompanyInvitationOut]:
    try:
        result = service.invite_employee(db, company_id=_require_company_scope(company_id), actor_user_id=int(user.id), email=payload.email)
        return ok(CompanyInvitationOut(**result))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.get("/invitations", response_model=ApiResponse[list[CompanyInvitationOut]])
def list_invitations(
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("employees.read")),
) -> ApiResponse[list[CompanyInvitationOut]]:
    result = service.list_company_invitations(db, company_id=_require_company_scope(company_id), status=status.strip().upper() if status else None)
    return ok([CompanyInvitationOut(**row) for row in result])


@router.post("/invitations/{invitation_id:int}/accept", response_model=ApiResponse[CompanyInvitationOut])
def accept_invitation(
    invitation_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> ApiResponse[CompanyInvitationOut]:
    try:
        return ok(CompanyInvitationOut(**service.accept_invitation(db, user_id=int(user.id), invitation_id=invitation_id)))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/invitations/{invitation_id:int}/decline", response_model=ApiResponse[CompanyInvitationOut])
def decline_invitation(
    invitation_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> ApiResponse[CompanyInvitationOut]:
    try:
        return ok(CompanyInvitationOut(**service.decline_invitation(db, user_id=int(user.id), invitation_id=invitation_id)))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/join-requests", response_model=ApiResponse[CompanyJoinRequestOut])
def create_join_request(
    payload: CompanyJoinRequestCreateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> ApiResponse[CompanyJoinRequestOut]:
    try:
        return ok(CompanyJoinRequestOut(**service.create_join_request(db, user_id=int(user.id), company_code=payload.company_code)))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.get("/join-requests", response_model=ApiResponse[list[CompanyJoinRequestOut]])
def list_join_requests(
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("employees.read")),
) -> ApiResponse[list[CompanyJoinRequestOut]]:
    result = service.list_join_requests(db, company_id=_require_company_scope(company_id), status=status.strip().upper() if status else None)
    return ok([CompanyJoinRequestOut(**row) for row in result])


@router.post("/join-requests/{request_id:int}/approve", response_model=ApiResponse[CompanyJoinRequestOut])
def approve_join_request(
    request_id: int,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    user=Depends(require_permission("employees.manage")),
) -> ApiResponse[CompanyJoinRequestOut]:
    try:
        result = service.approve_join_request(db, company_id=_require_company_scope(company_id), actor_user_id=int(user.id), request_id=request_id)
        return ok(CompanyJoinRequestOut(**result))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/join-requests/{request_id:int}/reject", response_model=ApiResponse[CompanyJoinRequestOut])
def reject_join_request(
    request_id: int,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    user=Depends(require_permission("employees.manage")),
) -> ApiResponse[CompanyJoinRequestOut]:
    try:
        result = service.reject_join_request(db, company_id=_require_company_scope(company_id), actor_user_id=int(user.id), request_id=request_id)
        return ok(CompanyJoinRequestOut(**result))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))

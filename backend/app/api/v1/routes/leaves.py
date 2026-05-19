from __future__ import annotations

from datetime import date
import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_company_scope_id, get_current_user, require_permission
from app.core.errors import BAD_REQUEST, AppException
from app.core.response import ok
from app.db.session import get_db
from app.schemas.common import ApiResponse
from app.schemas.leaves import LeaveBalanceOut, LeaveCreateRequest, LeaveListResponse, LeaveMeCreateRequest, LeaveOut, LeaveUpdateRequest
from app.services.leaves import LeaveService
from app.services.notifications import NotificationService

router = APIRouter()
service = LeaveService()
notification_service = NotificationService()
logger = logging.getLogger(__name__)


def _safe_notify(fn) -> None:
    try:
        fn()
    except Exception as exc:  # pragma: no cover
        logger.warning("leave notification emit failed: %r", exc)

@router.get("/me", response_model=ApiResponse[LeaveListResponse])
def list_my_leaves(
    status: str | None = Query(default=None, description="pending|approved|rejected"),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> ApiResponse[LeaveListResponse]:
    if status and status not in {"pending", "approved", "rejected"}:
        raise AppException(BAD_REQUEST, detail="Invalid status")
    result = service.list(db, limit=limit, offset=offset, user_id=int(user.id), status=status, from_date=from_date, to_date=to_date)
    return ok(LeaveListResponse(**result))


@router.post("/me", response_model=ApiResponse[LeaveOut])
def create_my_leave(
    payload: LeaveMeCreateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> ApiResponse[LeaveOut]:
    """
    Employee self-service: always uses current user.
    """
    try:
        item = service.create(
            db,
            user_id=int(user.id),
            type=payload.type,
            start_date=payload.start_date,
            end_date=payload.end_date,
            reason=payload.reason,
        )
        company_id = int(getattr(user, "company_id", 0) or 0)
        if company_id > 0:
            _safe_notify(
                lambda: notification_service.create_for_permission(
                    db,
                    company_id=company_id,
                    permission_key="leave.approve",
                    type="leave.created",
                    category="leave",
                    severity="info",
                    title=f"Đơn nghỉ mới từ {item.get('user_name') or getattr(user, 'name', 'Nhân viên')}",
                    body=f"{item['type']} • {item['start_date']} → {item['end_date']}",
                    entity_type="leave_request",
                    entity_id=int(item["id"]),
                    action_url="/leave",
                    created_by_user_id=int(user.id),
                    exclude_user_ids=[int(user.id)],
                )
            )
        return ok(LeaveOut(**item))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.get("/me/balance", response_model=ApiResponse[LeaveBalanceOut])
def my_leave_balance(
    year: int | None = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> ApiResponse[LeaveBalanceOut]:
    y = year or date.today().year
    data = service.my_balance(db, user_id=int(user.id), year=int(y))
    return ok(LeaveBalanceOut(**data))


@router.get("", response_model=ApiResponse[LeaveListResponse])
def list_leaves(
    q: str | None = Query(default=None, description="Search by employee name/code"),
    status: str | None = Query(default=None, description="pending|approved|rejected"),
    user_id: int | None = Query(default=None),
    department_id: int | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("leave.read")),
) -> ApiResponse[LeaveListResponse]:
    if status and status not in {"pending", "approved", "rejected"}:
        raise AppException(BAD_REQUEST, detail="Invalid status")
    result = service.list(
        db,
        company_id=company_id,
        limit=limit,
        offset=offset,
        q=q.strip() if q else None,
        status=status,
        user_id=user_id,
        department_id=department_id,
        from_date=from_date,
        to_date=to_date,
    )
    return ok(LeaveListResponse(**result))


@router.get("/{leave_id}", response_model=ApiResponse[LeaveOut])
def get_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("leave.read")),
) -> ApiResponse[LeaveOut]:
    try:
        return ok(LeaveOut(**service.get(db, leave_id=leave_id, company_id=company_id)))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("", response_model=ApiResponse[LeaveOut])
def create_leave(
    payload: LeaveCreateRequest,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    actor=Depends(get_current_user),
    _: object = Depends(require_permission("leave.read")),
) -> ApiResponse[LeaveOut]:
    try:
        item = service.create(
            db,
            company_id=company_id,
            user_id=payload.user_id,
            type=payload.type,
            start_date=payload.start_date,
            end_date=payload.end_date,
            reason=payload.reason,
        )
        if int(payload.user_id) != int(actor.id):
            _safe_notify(
                lambda: notification_service.create_for_users(
                    db,
                    company_id=company_id,
                    type="leave.created",
                    category="leave",
                    severity="info",
                    title="Đơn nghỉ của bạn đã được tạo",
                    body=f"{item['type']} • {item['start_date']} → {item['end_date']}",
                    entity_type="leave_request",
                    entity_id=int(item["id"]),
                    action_url="/employee/leave",
                    created_by_user_id=int(actor.id),
                    user_ids=[int(payload.user_id)],
                )
            )
        return ok(LeaveOut(**item))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.put("/{leave_id}", response_model=ApiResponse[LeaveOut])
def update_leave(
    leave_id: int,
    payload: LeaveUpdateRequest,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    actor=Depends(get_current_user),
    _: object = Depends(require_permission("leave.read")),
) -> ApiResponse[LeaveOut]:
    try:
        item = service.update(
            db,
            leave_id=leave_id,
            company_id=company_id,
            user_id=payload.user_id,
            type=payload.type,
            start_date=payload.start_date,
            end_date=payload.end_date,
            reason=payload.reason,
            status=payload.status,
        )
        if int(item["user_id"]) == int(actor.id):
            if company_id is not None:
                _safe_notify(
                    lambda: notification_service.create_for_permission(
                        db,
                        company_id=int(company_id),
                        permission_key="leave.approve",
                        type="leave.updated",
                        category="leave",
                        severity="info",
                        title=f"Đơn nghỉ đã được cập nhật bởi {item.get('user_name') or getattr(actor, 'name', 'Nhân viên')}",
                        body=f"{item['type']} • {item['start_date']} → {item['end_date']}",
                        entity_type="leave_request",
                        entity_id=int(item["id"]),
                        action_url="/leave",
                        created_by_user_id=int(actor.id),
                        exclude_user_ids=[int(actor.id)],
                    )
                )
        else:
            _safe_notify(
                lambda: notification_service.create_for_users(
                    db,
                    company_id=company_id,
                    type="leave.updated",
                    category="leave",
                    severity="info",
                    title="Đơn nghỉ của bạn vừa được cập nhật",
                    body=f"{item['type']} • {item['start_date']} → {item['end_date']}",
                    entity_type="leave_request",
                    entity_id=int(item["id"]),
                    action_url="/employee/leave",
                    created_by_user_id=int(actor.id),
                    user_ids=[int(item["user_id"])],
                )
            )
        return ok(LeaveOut(**item))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.delete("/{leave_id}", response_model=ApiResponse[dict[str, object]])
def delete_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    actor=Depends(get_current_user),
    _: object = Depends(require_permission("leave.read")),
) -> ApiResponse[dict[str, object]]:
    try:
        item = service.get(db, leave_id=leave_id, company_id=company_id)
        service.delete(db, leave_id=leave_id, company_id=company_id)
        if int(item["user_id"]) == int(actor.id):
            if company_id is not None:
                _safe_notify(
                    lambda: notification_service.create_for_permission(
                        db,
                        company_id=int(company_id),
                        permission_key="leave.approve",
                        type="leave.cancelled",
                        category="leave",
                        severity="warning",
                        title=f"Đơn nghỉ đã bị hủy bởi {item.get('user_name') or getattr(actor, 'name', 'Nhân viên')}",
                        body=f"{item['type']} • {item['start_date']} → {item['end_date']}",
                        entity_type="leave_request",
                        entity_id=int(item["id"]),
                        action_url="/leave",
                        created_by_user_id=int(actor.id),
                        exclude_user_ids=[int(actor.id)],
                    )
                )
        else:
            _safe_notify(
                lambda: notification_service.create_for_users(
                    db,
                    company_id=company_id,
                    type="leave.cancelled",
                    category="leave",
                    severity="warning",
                    title="Đơn nghỉ của bạn vừa bị hủy",
                    body=f"{item['type']} • {item['start_date']} → {item['end_date']}",
                    entity_type="leave_request",
                    entity_id=int(item["id"]),
                    action_url="/employee/leave",
                    created_by_user_id=int(actor.id),
                    user_ids=[int(item["user_id"])],
                )
            )
        return ok({"deleted": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/{leave_id}/approve", response_model=ApiResponse[LeaveOut])
def approve_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    actor=Depends(get_current_user),
    _: object = Depends(require_permission("leave.approve")),
) -> ApiResponse[LeaveOut]:
    try:
        item = service.approve(db, leave_id=leave_id, company_id=company_id)
        _safe_notify(
            lambda: notification_service.create_for_users(
                db,
                company_id=company_id,
                type="leave.approved",
                category="leave",
                severity="success",
                title="Đơn nghỉ đã được duyệt",
                body=f"{item['type']} • {item['start_date']} → {item['end_date']}",
                entity_type="leave_request",
                entity_id=int(item["id"]),
                action_url="/employee/leave",
                created_by_user_id=int(actor.id),
                user_ids=[int(item["user_id"])],
            )
        )
        return ok(LeaveOut(**item))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/{leave_id}/reject", response_model=ApiResponse[LeaveOut])
def reject_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    actor=Depends(get_current_user),
    _: object = Depends(require_permission("leave.approve")),
) -> ApiResponse[LeaveOut]:
    try:
        item = service.reject(db, leave_id=leave_id, company_id=company_id)
        _safe_notify(
            lambda: notification_service.create_for_users(
                db,
                company_id=company_id,
                type="leave.rejected",
                category="leave",
                severity="warning",
                title="Đơn nghỉ đã bị từ chối",
                body=f"{item['type']} • {item['start_date']} → {item['end_date']}",
                entity_type="leave_request",
                entity_id=int(item["id"]),
                action_url="/employee/leave",
                created_by_user_id=int(actor.id),
                user_ids=[int(item["user_id"])],
            )
        )
        return ok(LeaveOut(**item))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))

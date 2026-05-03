from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.errors import BAD_REQUEST, AppException
from app.core.response import ok
from app.db.session import get_db
from app.schemas.common import ApiResponse
from app.schemas.leaves import LeaveCreateRequest, LeaveListResponse, LeaveOut, LeaveUpdateRequest
from app.services.leaves import LeaveService

router = APIRouter()
service = LeaveService()


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
    _: object = Depends(require_permission("leave.read")),
) -> ApiResponse[LeaveListResponse]:
    if status and status not in {"pending", "approved", "rejected"}:
        raise AppException(BAD_REQUEST, detail="Invalid status")
    result = service.list(
        db,
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
    _: object = Depends(require_permission("leave.read")),
) -> ApiResponse[LeaveOut]:
    try:
        return ok(LeaveOut(**service.get(db, leave_id=leave_id)))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("", response_model=ApiResponse[LeaveOut])
def create_leave(
    payload: LeaveCreateRequest,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("leave.read")),
) -> ApiResponse[LeaveOut]:
    try:
        item = service.create(
            db,
            user_id=payload.user_id,
            type=payload.type,
            start_date=payload.start_date,
            end_date=payload.end_date,
            reason=payload.reason,
        )
        return ok(LeaveOut(**item))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.put("/{leave_id}", response_model=ApiResponse[LeaveOut])
def update_leave(
    leave_id: int,
    payload: LeaveUpdateRequest,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("leave.read")),
) -> ApiResponse[LeaveOut]:
    try:
        item = service.update(
            db,
            leave_id=leave_id,
            user_id=payload.user_id,
            type=payload.type,
            start_date=payload.start_date,
            end_date=payload.end_date,
            reason=payload.reason,
            status=payload.status,
        )
        return ok(LeaveOut(**item))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.delete("/{leave_id}", response_model=ApiResponse[dict[str, object]])
def delete_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("leave.read")),
) -> ApiResponse[dict[str, object]]:
    try:
        service.delete(db, leave_id=leave_id)
        return ok({"deleted": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/{leave_id}/approve", response_model=ApiResponse[LeaveOut])
def approve_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("leave.approve")),
) -> ApiResponse[LeaveOut]:
    try:
        return ok(LeaveOut(**service.approve(db, leave_id=leave_id)))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/{leave_id}/reject", response_model=ApiResponse[LeaveOut])
def reject_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("leave.approve")),
) -> ApiResponse[LeaveOut]:
    try:
        return ok(LeaveOut(**service.reject(db, leave_id=leave_id)))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))

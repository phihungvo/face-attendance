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
from app.schemas.schedules import (
    WorkScheduleCreateRequest,
    WorkScheduleOut,
    WorkScheduleRegistrationAssignRequest,
    WorkScheduleRegistrationBulkCreateMeRequest,
    WorkScheduleRegistrationCreateMeRequest,
    WorkScheduleRegistrationRequestCreateMeRequest,
    WorkScheduleRegistrationRequestListResponse,
    WorkScheduleRegistrationRequestOut,
    WorkScheduleRegistrationListResponse,
    WorkScheduleRegistrationOut,
    WorkScheduleUpdateRequest,
)
from app.services.notifications import NotificationService
from app.services.schedules import ScheduleService

router = APIRouter()
service = ScheduleService()
notification_service = NotificationService()
logger = logging.getLogger(__name__)


def _safe_notify(fn) -> None:
    try:
        fn()
    except Exception as exc:  # pragma: no cover
        logger.warning("schedule notification emit failed: %r", exc)


# ---- schedule templates ----
@router.get("", response_model=ApiResponse[list[WorkScheduleOut]])
def list_schedules(
    q: str | None = Query(default=None, description="Search by name/code"),
    status: str | None = Query(default=None, description="active|inactive"),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("schedules.read")),
) -> ApiResponse[list[WorkScheduleOut]]:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Thiếu company scope (X-Company-Id)")
    rows = service.list_schedules(db, company_id=int(company_id), limit=limit, offset=offset, q=q.strip() if q else None, status=status.strip() if status else None)
    return ok([WorkScheduleOut.from_orm_row(x) for x in rows])


@router.get("/{schedule_id:int}", response_model=ApiResponse[WorkScheduleOut])
def get_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("schedules.read")),
) -> ApiResponse[WorkScheduleOut]:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Thiếu company scope (X-Company-Id)")
    try:
        s = service.get_schedule(db, company_id=int(company_id), schedule_id=schedule_id)
        return ok(WorkScheduleOut.from_orm_row(s))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("", response_model=ApiResponse[WorkScheduleOut])
def create_schedule(
    payload: WorkScheduleCreateRequest,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("schedules.manage")),
) -> ApiResponse[WorkScheduleOut]:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Thiếu company scope (X-Company-Id)")
    try:
        s = service.create_schedule(
                db,
                company_id=int(company_id),
                code=payload.code,
                name=payload.name,
                status=payload.status,
                shift_start=payload.shift_start,
                shift_end=payload.shift_end,
                late_grace_minutes=payload.late_grace_minutes,
                early_leave_grace_minutes=payload.early_leave_grace_minutes,
                break_start=payload.break_start,
                break_end=payload.break_end,
                break_duration_minutes=payload.break_duration_minutes,
                break_threshold_hours=payload.break_threshold_hours,
                auto_checkout_time=payload.auto_checkout_time,
                department_id=payload.department_id,
                max_registrations=payload.max_registrations,
                days_of_week=payload.days_of_week,
                date_start=payload.date_start,
                date_end=payload.date_end,
                note=payload.note,
            )
        return ok(WorkScheduleOut.from_orm_row(s))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.put("/{schedule_id:int}", response_model=ApiResponse[WorkScheduleOut])
def update_schedule(
    schedule_id: int,
    payload: WorkScheduleUpdateRequest,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("schedules.manage")),
) -> ApiResponse[WorkScheduleOut]:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Thiếu company scope (X-Company-Id)")
    try:
        data = payload.model_dump()
        s = service.update_schedule(db, company_id=int(company_id), schedule_id=schedule_id, data=data)
        return ok(WorkScheduleOut.from_orm_row(s))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.delete("/{schedule_id:int}", response_model=ApiResponse[dict[str, object]])
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("schedules.manage")),
) -> ApiResponse[dict[str, object]]:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Thiếu company scope (X-Company-Id)")
    try:
        service.delete_schedule(db, company_id=int(company_id), schedule_id=schedule_id)
        return ok({"deleted": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


# ---- employee self-service ----
@router.get("/me/registrations", response_model=ApiResponse[list[WorkScheduleRegistrationOut]])
def list_my_registrations(
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    status: str | None = Query(default=None, description="pending|approved|rejected|cancelled"),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user=Depends(require_permission("employee.portal")),
) -> ApiResponse[list[WorkScheduleRegistrationOut]]:
    company_id = int(getattr(user, "company_id", 0) or 0)
    return ok(service.list_my_registrations(db, company_id=company_id, user_id=int(user.id), from_date=from_date, to_date=to_date, status=status, limit=limit, offset=offset))


@router.post("/me/registrations", response_model=ApiResponse[WorkScheduleRegistrationOut])
def create_my_registration(
    payload: WorkScheduleRegistrationCreateMeRequest,
    db: Session = Depends(get_db),
    user=Depends(require_permission("employee.portal")),
    _: object = Depends(require_permission("schedules.register")),
) -> ApiResponse[WorkScheduleRegistrationOut]:
    company_id = int(getattr(user, "company_id", 0) or 0)
    try:
        return ok(service.register_my_schedule(db, company_id=company_id, user_id=int(user.id), day=payload.day, schedule_id=payload.schedule_id, note=payload.note))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/me/registrations/bulk", response_model=ApiResponse[list[WorkScheduleRegistrationOut]])
def create_my_registrations_bulk(
    payload: WorkScheduleRegistrationBulkCreateMeRequest,
    db: Session = Depends(get_db),
    user=Depends(require_permission("employee.portal")),
    _: object = Depends(require_permission("schedules.register")),
) -> ApiResponse[list[WorkScheduleRegistrationOut]]:
    company_id = int(getattr(user, "company_id", 0) or 0)
    try:
        rows = service.register_my_schedules_bulk(
            db,
            company_id=company_id,
            user_id=int(user.id),
            schedule_id=int(payload.schedule_id),
            days=list(payload.days or []),
            note=payload.note,
        )
        return ok([WorkScheduleRegistrationOut.model_validate(x) for x in rows])
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/me/registration-requests", response_model=ApiResponse[WorkScheduleRegistrationRequestOut])
def create_my_registration_request(
    payload: WorkScheduleRegistrationRequestCreateMeRequest,
    db: Session = Depends(get_db),
    user=Depends(require_permission("employee.portal")),
    _: object = Depends(require_permission("schedules.register")),
) -> ApiResponse[WorkScheduleRegistrationRequestOut]:
    company_id = int(getattr(user, "company_id", 0) or 0)
    try:
        req = service.create_my_registration_request(
            db,
            company_id=company_id,
            user_id=int(user.id),
            schedule_id=int(payload.schedule_id),
            days=list(payload.days or []),
            note=payload.note,
        )
        _safe_notify(
            lambda: notification_service.create_for_permission(
                db,
                company_id=company_id,
                permission_key="schedules.approve",
                type="schedule.request.created",
                category="schedule",
                severity="info",
                title=f"Yêu cầu đăng ký ca mới từ {getattr(user, 'name', 'Nhân viên')}",
                body=f"Ca #{req.schedule_id} • {req.date_from} → {req.date_to}",
                entity_type="schedule_registration_request",
                entity_id=int(req.id),
                action_url="/schedules",
                created_by_user_id=int(user.id),
                exclude_user_ids=[int(user.id)],
            )
        )
        return ok(WorkScheduleRegistrationRequestOut.model_validate(req))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.get("/me/registration-requests", response_model=ApiResponse[list[WorkScheduleRegistrationRequestOut]])
def list_my_registration_requests(
    status: str | None = Query(default=None, description="pending|approved|rejected|cancelled"),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user=Depends(require_permission("employee.portal")),
) -> ApiResponse[list[WorkScheduleRegistrationRequestOut]]:
    company_id = int(getattr(user, "company_id", 0) or 0)
    rows = service.list_my_registration_requests(db, company_id=company_id, user_id=int(user.id), status=status, limit=limit, offset=offset)
    return ok([WorkScheduleRegistrationRequestOut.model_validate(x) for x in rows])


@router.delete("/me/registration-requests/{request_id:int}", response_model=ApiResponse[dict[str, object]])
def cancel_my_registration_request(
    request_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_permission("employee.portal")),
) -> ApiResponse[dict[str, object]]:
    company_id = int(getattr(user, "company_id", 0) or 0)
    try:
        req = service.cancel_my_registration_request(db, company_id=company_id, user_id=int(user.id), request_id=request_id)
        if req is not None:
            _safe_notify(
                lambda: notification_service.create_for_permission(
                    db,
                    company_id=company_id,
                    permission_key="schedules.approve",
                    type="schedule.registration.cancelled",
                    category="schedule",
                    severity="warning",
                    title=f"Yêu cầu đăng ký ca đã bị hủy bởi {getattr(user, 'name', 'Nhân viên')}",
                    body=f"Ca #{getattr(req, 'schedule_id')} • {getattr(req, 'date_from')} → {getattr(req, 'date_to')}",
                    entity_type="schedule_registration_request",
                    entity_id=int(getattr(req, "id")),
                    action_url="/schedules",
                    created_by_user_id=int(user.id),
                    exclude_user_ids=[int(user.id)],
                )
            )
        return ok({"cancelled": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.delete("/me/registrations/{reg_id:int}", response_model=ApiResponse[dict[str, object]])
def cancel_my_registration(
    reg_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_permission("employee.portal")),
) -> ApiResponse[dict[str, object]]:
    company_id = int(getattr(user, "company_id", 0) or 0)
    try:
        item = service.cancel_my_registration(db, company_id=company_id, user_id=int(user.id), reg_id=reg_id)
        if item is not None:
            _safe_notify(
                lambda: notification_service.create_for_permission(
                    db,
                    company_id=company_id,
                    permission_key="schedules.approve",
                    type="schedule.registration.cancelled",
                    category="schedule",
                    severity="warning",
                    title=f"Lịch làm đã bị hủy bởi {getattr(user, 'name', 'Nhân viên')}",
                    body=f"Ca #{getattr(item, 'schedule_id')} • {getattr(item, 'day')}",
                    entity_type="schedule_registration",
                    entity_id=int(getattr(item, "id")),
                    action_url="/schedules",
                    created_by_user_id=int(user.id),
                    exclude_user_ids=[int(user.id)],
                )
            )
        return ok({"cancelled": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


# ---- manager/admin: registrations management ----
@router.get("/registrations", response_model=ApiResponse[WorkScheduleRegistrationListResponse])
def list_registrations(
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    status: str | None = Query(default=None, description="pending|approved|rejected|cancelled"),
    user_id: int | None = Query(default=None),
    department_id: int | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("schedules.read")),
) -> ApiResponse[WorkScheduleRegistrationListResponse]:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Thiếu company scope (X-Company-Id)")
    data = service.list_registrations(db, company_id=int(company_id), from_date=from_date, to_date=to_date, status=status, user_id=user_id, department_id=department_id, limit=limit, offset=offset)
    return ok(WorkScheduleRegistrationListResponse(**data))


@router.get("/registration-requests", response_model=ApiResponse[WorkScheduleRegistrationRequestListResponse])
def list_registration_requests(
    status: str | None = Query(default=None, description="pending|approved|rejected|cancelled"),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("schedules.read")),
) -> ApiResponse[WorkScheduleRegistrationRequestListResponse]:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Thiếu company scope (X-Company-Id)")
    data = service.list_registration_requests(db, company_id=int(company_id), status=status, limit=limit, offset=offset)
    return ok(WorkScheduleRegistrationRequestListResponse(**data))


@router.post("/registration-requests/{request_id:int}/approve", response_model=ApiResponse[WorkScheduleRegistrationRequestOut])
def approve_registration_request(
    request_id: int,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    actor=Depends(get_current_user),
    _: object = Depends(require_permission("schedules.approve")),
) -> ApiResponse[WorkScheduleRegistrationRequestOut]:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Thiếu company scope (X-Company-Id)")
    try:
        req = service.approve_registration_request(db, company_id=int(company_id), approver_user_id=int(actor.id), request_id=request_id)
        _safe_notify(
            lambda: notification_service.create_for_users(
                db,
                company_id=int(company_id),
                type="schedule.request.approved",
                category="schedule",
                severity="success",
                title="Yêu cầu đăng ký ca đã được duyệt",
                body=f"Ca #{req.schedule_id} • {req.date_from} → {req.date_to}",
                entity_type="schedule_registration_request",
                entity_id=int(req.id),
                action_url="/employee/schedules",
                created_by_user_id=int(actor.id),
                user_ids=[int(req.user_id)],
            )
        )
        return ok(WorkScheduleRegistrationRequestOut.model_validate(req))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/registration-requests/{request_id:int}/reject", response_model=ApiResponse[WorkScheduleRegistrationRequestOut])
def reject_registration_request(
    request_id: int,
    note: str | None = Query(default=None, max_length=255),
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    actor=Depends(get_current_user),
    _: object = Depends(require_permission("schedules.approve")),
) -> ApiResponse[WorkScheduleRegistrationRequestOut]:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Thiếu company scope (X-Company-Id)")
    try:
        req = service.reject_registration_request(db, company_id=int(company_id), approver_user_id=int(actor.id), request_id=request_id, note=note)
        _safe_notify(
            lambda: notification_service.create_for_users(
                db,
                company_id=int(company_id),
                type="schedule.request.rejected",
                category="schedule",
                severity="warning",
                title="Yêu cầu đăng ký ca đã bị từ chối",
                body=f"Ca #{req.schedule_id} • {req.date_from} → {req.date_to}",
                entity_type="schedule_registration_request",
                entity_id=int(req.id),
                action_url="/employee/schedules",
                created_by_user_id=int(actor.id),
                user_ids=[int(req.user_id)],
            )
        )
        return ok(WorkScheduleRegistrationRequestOut.model_validate(req))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/registrations", response_model=ApiResponse[WorkScheduleRegistrationOut])
def assign_registration(
    payload: WorkScheduleRegistrationAssignRequest,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    actor=Depends(get_current_user),
    _: object = Depends(require_permission("schedules.approve")),
) -> ApiResponse[WorkScheduleRegistrationOut]:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Thiếu company scope (X-Company-Id)")
    try:
        item = service.assign_schedule(
            db,
            company_id=int(company_id),
            actor_user_id=int(actor.id),
            user_id=payload.user_id,
            day=payload.day,
            schedule_id=payload.schedule_id,
            status=payload.status or "approved",
            note=payload.note,
        )
        _safe_notify(
            lambda: notification_service.create_for_users(
                db,
                company_id=int(company_id),
                type="schedule.registration.created",
                category="schedule",
                severity="info",
                title="Bạn vừa được gán vào một ca làm",
                body=f"Ca #{getattr(item, 'schedule_id')} • {getattr(item, 'day')}",
                entity_type="schedule_registration",
                entity_id=int(getattr(item, "id")),
                action_url="/employee/schedules",
                created_by_user_id=int(actor.id),
                user_ids=[int(getattr(item, "user_id"))],
            )
        )
        return ok(item)
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/registrations/{reg_id:int}/approve", response_model=ApiResponse[WorkScheduleRegistrationOut])
def approve_registration(
    reg_id: int,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    actor=Depends(get_current_user),
    _: object = Depends(require_permission("schedules.approve")),
) -> ApiResponse[WorkScheduleRegistrationOut]:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Thiếu company scope (X-Company-Id)")
    try:
        item = service.approve_registration(db, company_id=int(company_id), approver_user_id=int(actor.id), reg_id=reg_id)
        _safe_notify(
            lambda: notification_service.create_for_users(
                db,
                company_id=int(company_id),
                type="schedule.registration.approved",
                category="schedule",
                severity="success",
                title="Lịch làm của bạn đã được duyệt",
                body=f"Ca #{getattr(item, 'schedule_id')} • {getattr(item, 'day')}",
                entity_type="schedule_registration",
                entity_id=int(getattr(item, "id")),
                action_url="/employee/schedules",
                created_by_user_id=int(actor.id),
                user_ids=[int(getattr(item, "user_id"))],
            )
        )
        return ok(item)
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/registrations/{reg_id:int}/reject", response_model=ApiResponse[WorkScheduleRegistrationOut])
def reject_registration(
    reg_id: int,
    note: str | None = Query(default=None, max_length=255),
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    actor=Depends(get_current_user),
    _: object = Depends(require_permission("schedules.approve")),
) -> ApiResponse[WorkScheduleRegistrationOut]:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Thiếu company scope (X-Company-Id)")
    try:
        item = service.reject_registration(db, company_id=int(company_id), approver_user_id=int(actor.id), reg_id=reg_id, note=note)
        _safe_notify(
            lambda: notification_service.create_for_users(
                db,
                company_id=int(company_id),
                type="schedule.registration.rejected",
                category="schedule",
                severity="warning",
                title="Lịch làm của bạn đã bị từ chối",
                body=f"Ca #{getattr(item, 'schedule_id')} • {getattr(item, 'day')}",
                entity_type="schedule_registration",
                entity_id=int(getattr(item, "id")),
                action_url="/employee/schedules",
                created_by_user_id=int(actor.id),
                user_ids=[int(getattr(item, "user_id"))],
            )
        )
        return ok(item)
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.delete("/registrations/{reg_id:int}", response_model=ApiResponse[dict[str, object]])
def delete_registration(
    reg_id: int,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    actor=Depends(get_current_user),
    _: object = Depends(require_permission("schedules.approve")),
) -> ApiResponse[dict[str, object]]:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Thiếu company scope (X-Company-Id)")
    try:
        item = service.delete_registration(db, company_id=int(company_id), reg_id=reg_id)
        if item is not None:
            _safe_notify(
                lambda: notification_service.create_for_users(
                    db,
                    company_id=int(company_id),
                    type="schedule.registration.cancelled",
                    category="schedule",
                    severity="warning",
                    title="Lịch làm của bạn vừa bị gỡ khỏi hệ thống",
                    body=f"Ca #{getattr(item, 'schedule_id')} • {getattr(item, 'day')}",
                    entity_type="schedule_registration",
                    entity_id=int(getattr(item, "id")),
                    action_url="/employee/schedules",
                    created_by_user_id=int(actor.id),
                    user_ids=[int(getattr(item, "user_id"))],
                )
            )
        return ok({"deleted": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))

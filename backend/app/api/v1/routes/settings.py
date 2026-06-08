from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_company_scope_id, get_current_user, is_admin, require_permission
from app.core.errors import BAD_REQUEST, FORBIDDEN, AppException
from app.core.response import ok
from app.db.session import get_db
from app.schemas.common import ApiResponse
from app.schemas.settings import (
    AttendanceEvidenceSettingsOut,
    AttendanceEvidenceSettingsUpdateRequest,
    AttendancePolicyOut,
    AttendancePolicyUpdateRequest,
    AuthRegistrationSettingsOut,
    AuthRegistrationSettingsUpdateRequest,
)
from app.services.notifications import NotificationService
from app.services.settings import SettingsService

router = APIRouter()
service = SettingsService()
notification_service = NotificationService()


def _require_admin_user(user) -> None:
    if not is_admin(user):
        raise AppException(FORBIDDEN, detail="Chỉ admin hệ thống được cấu hình tính năng đăng ký tài khoản")


@router.get("/auth-registration", response_model=ApiResponse[AuthRegistrationSettingsOut])
def get_auth_registration_settings(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> ApiResponse[AuthRegistrationSettingsOut]:
    _require_admin_user(user)
    return ok(AuthRegistrationSettingsOut(**service.get_auth_registration_settings(db)))


@router.put("/auth-registration", response_model=ApiResponse[AuthRegistrationSettingsOut])
def update_auth_registration_settings(
    payload: AuthRegistrationSettingsUpdateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> ApiResponse[AuthRegistrationSettingsOut]:
    _require_admin_user(user)
    return ok(
        AuthRegistrationSettingsOut(
            **service.update_auth_registration_settings(
                db,
                public_registration_enabled=payload.public_registration_enabled,
                actor_user_id=int(user.id),
            )
        )
    )


@router.get("/attendance", response_model=ApiResponse[AttendancePolicyOut])
def get_attendance_policy(
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("settings.read")),
) -> ApiResponse[AttendancePolicyOut]:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Thiếu công ty. Vui lòng chọn công ty (X-Company-Id).")
    return ok(service.get_attendance_policy(db, company_id=int(company_id)))


@router.put("/attendance", response_model=ApiResponse[AttendancePolicyOut])
def update_attendance_policy(
    payload: AttendancePolicyUpdateRequest,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    actor=Depends(get_current_user),
    _: object = Depends(require_permission("settings.manage")),
) -> ApiResponse[AttendancePolicyOut]:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Thiếu công ty. Vui lòng chọn công ty (X-Company-Id).")
    try:
        data = payload.model_dump()
        result = service.update_attendance_policy(db, company_id=int(company_id), data=data)
        try:
            notification_service.create_for_permission(
                db,
                company_id=int(company_id),
                permission_key="notifications.read",
                type="settings.attendance_policy.updated",
                category="settings",
                severity="info",
                title="Chính sách chấm công vừa được cập nhật",
                body=f"Múi giờ {result.timezone} • ca {result.shift_start} - {result.shift_end}",
                entity_type="attendance_policy",
                entity_id=None,
                action_url="/settings",
                created_by_user_id=int(actor.id),
                exclude_user_ids=[],
            )
        except Exception:
            pass
        return ok(result)
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.get("/attendance-evidence", response_model=ApiResponse[AttendanceEvidenceSettingsOut])
def get_attendance_evidence_settings(
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("settings.read")),
) -> ApiResponse[AttendanceEvidenceSettingsOut]:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Thiếu công ty. Vui lòng chọn công ty (X-Company-Id).")
    return ok(service.get_attendance_evidence_settings(db, company_id=int(company_id)))


@router.put("/attendance-evidence", response_model=ApiResponse[AttendanceEvidenceSettingsOut])
def update_attendance_evidence_settings(
    payload: AttendanceEvidenceSettingsUpdateRequest,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("settings.manage")),
) -> ApiResponse[AttendanceEvidenceSettingsOut]:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Thiếu công ty. Vui lòng chọn công ty (X-Company-Id).")
    try:
        return ok(service.update_attendance_evidence_settings(db, company_id=int(company_id), data=payload.model_dump()))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))

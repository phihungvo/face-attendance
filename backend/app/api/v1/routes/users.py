from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, Request
from sqlalchemy.orm import Session

from app.api.deps import get_company_scope_id, get_current_user, get_permission_keys, is_admin, require_permission
from app.core.errors import BAD_REQUEST, FORBIDDEN, AppException
from app.core.response import ok
from app.core.settings import settings
from app.core.throttling import get_client_ip, request_rate_limiter
from app.core.uploads import read_validated_image_upload
from app.db.session import get_db
from app.schemas.users import EnrollResponse, FaceEnrollStatusOut, UserCreateRequest, UserMeOut, UserOut, UserSelfUpdateRequest, UserUpdateRequest
from app.schemas.common import ApiResponse
from app.services.users import UserService
from app.services.auth import AuthService
from app.services.notifications import NotificationService

router = APIRouter()
service = UserService()
auth_service = AuthService()
notification_service = NotificationService()


def _build_user_me_out(u) -> UserMeOut:
    dept_name = None
    dept = getattr(u, "department", None)
    if dept is not None:
        dept_name = getattr(dept, "name", None)
    base = UserOut.model_validate(u).model_dump()
    return UserMeOut(**{**base, "department_name": dept_name})


@router.post("/enroll", response_model=ApiResponse[EnrollResponse])
async def enroll_user(
    request: Request,
    name: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("employees.manage")),
) -> ApiResponse[EnrollResponse]:
    """
    Enroll a new user with a single face image.
    Route contains NO business logic; delegates to service layer.
    """
    try:
        request_rate_limiter.hit(
            scope="user-face-enroll",
            key=get_client_ip(request),
            limit=int(settings.FACE_UPLOAD_MAX_REQUESTS),
            window_seconds=int(settings.FACE_UPLOAD_WINDOW_SECONDS),
            block_seconds=int(settings.FACE_UPLOAD_BLOCK_SECONDS),
            detail="Bạn gửi ảnh khuôn mặt quá nhiều lần. Vui lòng thử lại sau.",
        )
        image_bytes, _mime = await read_validated_image_upload(
            image,
            max_bytes=int(settings.FACE_UPLOAD_MAX_BYTES),
            field_label="Ảnh khuôn mặt",
        )
        user_id = service.enroll(db, company_id=company_id, name=name, image_bytes=image_bytes)
        return ok(EnrollResponse(user_id=user_id, status="enrolled"))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=f"Không thể đăng ký khuôn mặt: {e}")


@router.post("/{user_id:int}/enroll-face", response_model=ApiResponse[dict[str, object]])
async def enroll_face_for_user(
    user_id: int,
    request: Request,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> ApiResponse[dict[str, object]]:
    try:
        keys = get_permission_keys(current_user)
        if ("employees.manage" not in keys) and (int(getattr(current_user, "id")) != int(user_id)):
            raise AppException(FORBIDDEN)
        request_rate_limiter.hit(
            scope="user-face-enroll",
            key=f"{get_client_ip(request)}:{int(getattr(current_user, 'id'))}",
            limit=int(settings.FACE_UPLOAD_MAX_REQUESTS),
            window_seconds=int(settings.FACE_UPLOAD_WINDOW_SECONDS),
            block_seconds=int(settings.FACE_UPLOAD_BLOCK_SECONDS),
            detail="Bạn gửi ảnh khuôn mặt quá nhiều lần. Vui lòng thử lại sau.",
        )
        image_bytes, _mime = await read_validated_image_upload(
            image,
            max_bytes=int(settings.FACE_UPLOAD_MAX_BYTES),
            field_label="Ảnh khuôn mặt",
        )
        service.enroll_face(db, user_id=user_id, image_bytes=image_bytes)
        return ok({"enrolled": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=f"Không thể đăng ký khuôn mặt: {e}")


@router.post("/{user_id:int}/reset-face", response_model=ApiResponse[dict[str, object]])
def reset_face_for_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> ApiResponse[dict[str, object]]:
    try:
        keys = get_permission_keys(current_user)
        if ("employees.manage" not in keys) and (int(getattr(current_user, "id")) != int(user_id)):
            raise AppException(FORBIDDEN)
        service.reset_face(db, user_id=user_id)
        return ok({"reset": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=f"Không thể reset khuôn mặt: {e}")


@router.get("/me/face-status", response_model=ApiResponse[FaceEnrollStatusOut])
def my_face_status(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> ApiResponse[FaceEnrollStatusOut]:
    try:
        data = service.get_face_enroll_status(db, user_id=int(user.id))
        return ok(FaceEnrollStatusOut(**data))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/me/enroll-face", response_model=ApiResponse[dict[str, object]])
async def enroll_my_face(
    request: Request,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> ApiResponse[dict[str, object]]:
    try:
        request_rate_limiter.hit(
            scope="user-face-enroll-self",
            key=f"{get_client_ip(request)}:{int(user.id)}",
            limit=int(settings.FACE_UPLOAD_MAX_REQUESTS),
            window_seconds=int(settings.FACE_UPLOAD_WINDOW_SECONDS),
            block_seconds=int(settings.FACE_UPLOAD_BLOCK_SECONDS),
            detail="Bạn gửi ảnh khuôn mặt quá nhiều lần. Vui lòng thử lại sau.",
        )
        image_bytes, _mime = await read_validated_image_upload(
            image,
            max_bytes=int(settings.FACE_UPLOAD_MAX_BYTES),
            field_label="Ảnh khuôn mặt",
        )
        data = service.enroll_face_self(db, user_id=int(user.id), image_bytes=image_bytes)
        return ok(data)
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=f"Không thể đăng ký khuôn mặt: {e}")


@router.get("/me", response_model=ApiResponse[UserMeOut])
def my_profile(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> ApiResponse[UserMeOut]:
    u = service.get_user(db, user_id=int(user.id))
    return ok(_build_user_me_out(u))


@router.put("/me", response_model=ApiResponse[UserMeOut])
def update_my_profile(
    payload: UserSelfUpdateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> ApiResponse[UserMeOut]:
    try:
        updated = service.update_my_profile(
            db,
            user_id=int(user.id),
            name=payload.name,
            email=payload.email,
            phone=payload.phone,
            address=payload.address,
            citizen_id=payload.citizen_id,
            citizen_id_place=payload.citizen_id_place,
        )
        return ok(_build_user_me_out(updated))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.get("", response_model=ApiResponse[list[UserOut]])
def list_users(
    q: str | None = Query(default=None, description="Search by name/code/email/phone/address/CCCD"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    deleted: str = Query(default="active", description="active, deleted hoặc all. Chỉ admin được xem deleted/all."),
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    current_user=Depends(require_permission("employees.read")),
) -> ApiResponse[list[UserOut]]:
    try:
        deleted_filter = deleted if is_admin(current_user) else "active"
        return ok(service.list_users(db, company_id=company_id, limit=limit, offset=offset, q=q.strip() if q else None, deleted=deleted_filter))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.get("/{user_id:int}", response_model=ApiResponse[UserOut])
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("employees.read")),
) -> ApiResponse[UserOut]:
    try:
        return ok(service.get_user(db, user_id=user_id, company_id=company_id))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("", response_model=ApiResponse[UserOut])
def create_user(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    actor=Depends(get_current_user),
    _: object = Depends(require_permission("employees.manage")),
) -> ApiResponse[UserOut]:
    try:
        user = service.create_user(
            db,
            company_id=company_id,
            name=payload.name,
            code=payload.code,
            email=payload.email,
            phone=payload.phone,
            address=payload.address,
            citizen_id=payload.citizen_id,
            citizen_id_place=payload.citizen_id_place,
            hire_date=payload.hire_date,
            role=payload.role,
            status=payload.status,
            department_id=payload.department_id,
            create_login=payload.create_login,
            portal_role_key=payload.portal_role_key,
        )
        if payload.create_login:
            try:
                notification_service.create_for_users(
                    db,
                    company_id=company_id,
                    type="user.invite.sent",
                    category="iam",
                    severity="info",
                    title="Tài khoản của bạn đã được tạo",
                    body="Kiểm tra email để kích hoạt tài khoản và đặt mật khẩu.",
                    entity_type="user",
                    entity_id=int(user.id),
                    action_url="/activate",
                    created_by_user_id=int(actor.id),
                    user_ids=[int(user.id)],
                )
            except Exception:
                pass
        return ok(user)
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.put("/{user_id:int}", response_model=ApiResponse[UserOut])
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("employees.manage")),
) -> ApiResponse[UserOut]:
    try:
        user = service.update_user(
            db,
            user_id=user_id,
            company_id=company_id,
            name=payload.name,
            code=payload.code,
            email=payload.email,
            phone=payload.phone,
            address=payload.address,
            citizen_id=payload.citizen_id,
            citizen_id_place=payload.citizen_id_place,
            hire_date=payload.hire_date,
            role=payload.role,
            status=payload.status,
            department_id=payload.department_id,
        )
        return ok(user)
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.delete("/{user_id:int}", response_model=ApiResponse[dict[str, object]])
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("employees.manage")),
) -> ApiResponse[dict[str, object]]:
    try:
        service.delete_user(db, user_id=user_id, company_id=company_id)
        return ok({"deleted": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/{user_id:int}/restore", response_model=ApiResponse[dict[str, object]])
def restore_user(
    user_id: int,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    current_user=Depends(require_permission("employees.manage")),
) -> ApiResponse[dict[str, object]]:
    if not is_admin(current_user):
        raise AppException(FORBIDDEN, detail="Chỉ admin được khôi phục nhân viên đã xoá mềm")
    try:
        service.restore_user(db, user_id=user_id, company_id=company_id)
        return ok({"restored": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.delete("/{user_id:int}/hard", response_model=ApiResponse[dict[str, object]])
def hard_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    current_user=Depends(require_permission("employees.manage")),
) -> ApiResponse[dict[str, object]]:
    if not is_admin(current_user):
        raise AppException(FORBIDDEN, detail="Chỉ admin được xoá vĩnh viễn nhân viên")
    try:
        service.hard_delete_user(db, user_id=user_id, company_id=company_id)
        return ok({"deleted": True, "hard_deleted": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/{user_id}/resend-invite", response_model=ApiResponse[dict[str, object]])
def resend_invite(
    user_id: int,
    db: Session = Depends(get_db),
    actor=Depends(get_current_user),
    _: object = Depends(require_permission("employees.manage")),
) -> ApiResponse[dict[str, object]]:
    try:
        auth_service.invite_pending_user(db, user_id=user_id)
        try:
            target = service.get_user(db, user_id=user_id)
            notification_service.create_for_users(
                db,
                company_id=int(getattr(target, "company_id", 0) or 0) or None,
                type="user.invite.sent",
                category="iam",
                severity="info",
                title="Lời mời kích hoạt tài khoản vừa được gửi lại",
                body="Kiểm tra email để kích hoạt tài khoản và đặt mật khẩu.",
                entity_type="user",
                entity_id=int(user_id),
                action_url="/activate",
                created_by_user_id=int(actor.id),
                user_ids=[int(user_id)],
            )
        except Exception:
            pass
        return ok({"sent": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))

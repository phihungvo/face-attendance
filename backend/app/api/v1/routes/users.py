from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_company_scope_id, get_current_user, get_permission_keys, require_permission
from app.core.errors import BAD_REQUEST, FORBIDDEN, AppException
from app.core.response import ok
from app.db.session import get_db
from app.schemas.users import EnrollResponse, FaceEnrollStatusOut, UserCreateRequest, UserMeOut, UserOut, UserUpdateRequest
from app.schemas.common import ApiResponse
from app.services.users import UserService
from app.services.auth import AuthService

router = APIRouter()
service = UserService()
auth_service = AuthService()


@router.post("/enroll", response_model=ApiResponse[EnrollResponse])
async def enroll_user(
    name: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("employees.read")),
) -> ApiResponse[EnrollResponse]:
    """
    Enroll a new user with a single face image.
    Route contains NO business logic; delegates to service layer.
    """
    try:
        image_bytes = await image.read()
        user_id = service.enroll(db, company_id=company_id, name=name, image_bytes=image_bytes)
        return ok(EnrollResponse(user_id=user_id, status="enrolled"))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=f"Không thể đăng ký khuôn mặt: {e}")


@router.post("/{user_id:int}/enroll-face", response_model=ApiResponse[dict[str, object]])
async def enroll_face_for_user(
    user_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> ApiResponse[dict[str, object]]:
    try:
        keys = get_permission_keys(current_user)
        if ("employees.read" not in keys) and (int(getattr(current_user, "id")) != int(user_id)):
            raise AppException(FORBIDDEN)
        image_bytes = await image.read()
        service.enroll_face(db, user_id=user_id, image_bytes=image_bytes)
        return ok({"enrolled": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=f"Không thể đăng ký khuôn mặt: {e}")


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
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> ApiResponse[dict[str, object]]:
    try:
        image_bytes = await image.read()
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
    dept_name = None
    dept = getattr(u, "department", None)
    if dept is not None:
        dept_name = getattr(dept, "name", None)
    base = UserOut.model_validate(u).model_dump()
    return ok(UserMeOut(**{**base, "department_name": dept_name}))


@router.get("", response_model=ApiResponse[list[UserOut]])
def list_users(
    q: str | None = Query(default=None, description="Search by name"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("employees.read")),
) -> ApiResponse[list[UserOut]]:
    return ok(service.list_users(db, company_id=company_id, limit=limit, offset=offset, q=q.strip() if q else None))


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
    _: object = Depends(require_permission("employees.read")),
) -> ApiResponse[UserOut]:
    try:
        user = service.create_user(
            db,
            company_id=company_id,
            name=payload.name,
            code=payload.code,
            email=payload.email,
            role=payload.role,
            status=payload.status,
            department_id=payload.department_id,
            create_login=payload.create_login,
            portal_role_key=payload.portal_role_key,
        )
        return ok(user)
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.put("/{user_id:int}", response_model=ApiResponse[UserOut])
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("employees.read")),
) -> ApiResponse[UserOut]:
    try:
        user = service.update_user(
            db,
            user_id=user_id,
            company_id=company_id,
            name=payload.name,
            code=payload.code,
            email=payload.email,
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
    _: object = Depends(require_permission("employees.read")),
) -> ApiResponse[dict[str, object]]:
    try:
        service.delete_user(db, user_id=user_id, company_id=company_id)
        return ok({"deleted": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/{user_id}/resend-invite", response_model=ApiResponse[dict[str, object]])
def resend_invite(
    user_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("employees.read")),
) -> ApiResponse[dict[str, object]]:
    try:
        auth_service.invite_pending_user(db, user_id=user_id)
        return ok({"sent": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))

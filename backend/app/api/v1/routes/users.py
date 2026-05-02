from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_account
from app.core.errors import BAD_REQUEST, AppException
from app.core.response import ok
from app.db.session import get_db
from app.schemas.users import EnrollResponse, UserCreateRequest, UserOut, UserUpdateRequest
from app.schemas.common import ApiResponse
from app.services.users import UserService

router = APIRouter()
service = UserService()


@router.post("/enroll", response_model=ApiResponse[EnrollResponse])
async def enroll_user(
    name: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: object = Depends(get_current_account),
) -> ApiResponse[EnrollResponse]:
    """
    Enroll a new user with a single face image.
    Route contains NO business logic; delegates to service layer.
    """
    try:
        image_bytes = await image.read()
        user_id = service.enroll(db, name=name, image_bytes=image_bytes)
        return ok(EnrollResponse(user_id=user_id, status="enrolled"))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=f"Không thể đăng ký khuôn mặt: {e}")


@router.post("/{user_id}/enroll-face", response_model=ApiResponse[dict[str, object]])
async def enroll_face_for_user(
    user_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: object = Depends(get_current_account),
) -> ApiResponse[dict[str, object]]:
    try:
        image_bytes = await image.read()
        service.enroll_face(db, user_id=user_id, image_bytes=image_bytes)
        return ok({"enrolled": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=f"Không thể đăng ký khuôn mặt: {e}")


@router.get("", response_model=ApiResponse[list[UserOut]])
def list_users(
    q: str | None = Query(default=None, description="Search by name"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: object = Depends(get_current_account),
) -> ApiResponse[list[UserOut]]:
    return ok(service.list_users(db, limit=limit, offset=offset, q=q.strip() if q else None))


@router.get("/{user_id}", response_model=ApiResponse[UserOut])
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_account),
) -> ApiResponse[UserOut]:
    try:
        return ok(service.get_user(db, user_id=user_id))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("", response_model=ApiResponse[UserOut])
def create_user(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_account),
) -> ApiResponse[UserOut]:
    try:
        user = service.create_user(
            db,
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


@router.put("/{user_id}", response_model=ApiResponse[UserOut])
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_account),
) -> ApiResponse[UserOut]:
    try:
        user = service.update_user(
            db,
            user_id=user_id,
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


@router.delete("/{user_id}", response_model=ApiResponse[dict[str, object]])
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_account),
) -> ApiResponse[dict[str, object]]:
    try:
        service.delete_user(db, user_id=user_id)
        return ok({"deleted": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))

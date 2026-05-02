from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_account
from app.core.errors import BAD_REQUEST, AppException
from app.core.response import ok
from app.db.session import get_db
from app.schemas.users import EnrollResponse, UserOut
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


@router.get("", response_model=ApiResponse[list[UserOut]])
def list_users(
    db: Session = Depends(get_db),
    _: object = Depends(get_current_account),
) -> ApiResponse[list[UserOut]]:
    return ok(service.list_users(db))

from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_account
from app.core.errors import BAD_REQUEST, AppException
from app.core.response import ok
from app.db.session import get_db
from app.schemas.attendance import AttendanceLogOut, CheckInResponse
from app.schemas.common import ApiResponse
from app.services.attendance import AttendanceService

router = APIRouter()
service = AttendanceService()


@router.post("/checkin", response_model=ApiResponse[CheckInResponse])
async def checkin(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: object = Depends(get_current_account),
) -> ApiResponse[CheckInResponse]:
    """
    Check-in via face recognition.
    """
    try:
        image_bytes = await image.read()
        user_name, confidence, ts = service.checkin(db, image_bytes=image_bytes)
        return ok(CheckInResponse(user_name=user_name, confidence=confidence, time=ts))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=f"Không thể check-in: {e}")


@router.get("/logs", response_model=ApiResponse[list[AttendanceLogOut]])
def list_logs(
    db: Session = Depends(get_db),
    _: object = Depends(get_current_account),
) -> ApiResponse[list[AttendanceLogOut]]:
    return ok(service.list_logs(db))

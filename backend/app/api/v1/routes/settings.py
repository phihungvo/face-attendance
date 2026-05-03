from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.errors import BAD_REQUEST, AppException
from app.core.response import ok
from app.db.session import get_db
from app.schemas.common import ApiResponse
from app.schemas.settings import AttendancePolicyOut, AttendancePolicyUpdateRequest
from app.services.settings import SettingsService

router = APIRouter()
service = SettingsService()


@router.get("/attendance", response_model=ApiResponse[AttendancePolicyOut])
def get_attendance_policy(
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("settings.read")),
) -> ApiResponse[AttendancePolicyOut]:
    return ok(service.get_attendance_policy(db))


@router.put("/attendance", response_model=ApiResponse[AttendancePolicyOut])
def update_attendance_policy(
    payload: AttendancePolicyUpdateRequest,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("settings.read")),
) -> ApiResponse[AttendancePolicyOut]:
    try:
        data = payload.model_dump()
        return ok(service.update_attendance_policy(db, data=data))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))

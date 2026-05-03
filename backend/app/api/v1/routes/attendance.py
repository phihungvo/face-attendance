from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.errors import BAD_REQUEST, AppException
from app.core.response import ok
from app.db.session import get_db
from app.schemas.attendance import (
    AttendanceLogOut,
    AttendanceStats,
    CheckInResponse,
    CheckOutResponse,
    DailyAttendanceRow,
    MonthlyReportRow,
    TimelogRow,
    TimelogUpsertRequest,
)
from app.schemas.common import ApiResponse
from app.services.attendance import AttendanceService

router = APIRouter()
service = AttendanceService()


@router.post("/checkin", response_model=ApiResponse[CheckInResponse])
async def checkin(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("attendance.manage")),
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


@router.post("/checkout", response_model=ApiResponse[CheckOutResponse])
async def checkout(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("attendance.manage")),
) -> ApiResponse[CheckOutResponse]:
    """
    Check-out via face recognition.
    """
    try:
        image_bytes = await image.read()
        user_name, confidence, ts = service.checkout(db, image_bytes=image_bytes)
        return ok(CheckOutResponse(user_name=user_name, confidence=confidence, time=ts))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=f"Không thể check-out: {e}")


@router.get("/logs", response_model=ApiResponse[list[AttendanceLogOut]])
def list_logs(
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("attendance.read")),
) -> ApiResponse[list[AttendanceLogOut]]:
    return ok(service.list_logs(db))


@router.get("/reports/daily", response_model=ApiResponse[list[DailyAttendanceRow]])
def daily_attendance(
    day: date,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("timesheet.read")),
) -> ApiResponse[list[DailyAttendanceRow]]:
    rows = service.daily_report(db, day=day)
    out: list[DailyAttendanceRow] = []
    for r in rows:
        out.append(
            DailyAttendanceRow(
                user_id=r.user_id,
                user_name=r.user_name,
                date=r.day.isoformat(),
                checkin_time=r.checkin_time,
                checkout_time=r.checkout_time,
                work_hours=r.work_hours,
                late=r.late,
                absent=r.absent,
            )
        )
    return ok(out)


@router.get("/reports/monthly", response_model=ApiResponse[list[MonthlyReportRow]])
def monthly_report(
    month: str,  # YYYY-MM
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("timesheet.read")),
) -> ApiResponse[list[MonthlyReportRow]]:
    try:
        year_s, month_s = month.split("-", 1)
        year = int(year_s)
        mo = int(month_s)
        if mo < 1 or mo > 12:
            raise ValueError("Invalid month")
    except Exception:
        raise AppException(BAD_REQUEST, detail="month phải theo định dạng YYYY-MM")

    rows = service.monthly_report(db, year=year, month=mo)
    return ok([MonthlyReportRow(**r) for r in rows])


@router.get("/timelog", response_model=ApiResponse[list[TimelogRow]])
def timelog_range(
    from_date: date,
    to_date: date,
    department_id: int | None = None,
    status: str | None = None,  # "on-time" | "late" | "absent"
    include_absent: bool = False,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("timesheet.read")),
) -> ApiResponse[list[TimelogRow]]:
    try:
        rows = service.timelog_range(
            db,
            from_day=from_date,
            to_day_inclusive=to_date,
            department_id=department_id,
            status=status,
            include_absent=include_absent,
        )
        return ok([TimelogRow(**r) for r in rows])
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.put("/timelog/{user_id}/{day}", response_model=ApiResponse[TimelogRow])
def timelog_upsert(
    user_id: int,
    day: date,
    payload: TimelogUpsertRequest,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("attendance.manage")),
) -> ApiResponse[TimelogRow]:
    try:
        row = service.timelog_upsert_day(
            db,
            user_id=user_id,
            day=day,
            checkin_time=payload.checkin_time,
            checkout_time=payload.checkout_time,
        )
        return ok(TimelogRow(**row))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.delete("/timelog/{user_id}/{day}", response_model=ApiResponse[dict[str, object]])
def timelog_delete(
    user_id: int,
    day: date,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("attendance.manage")),
) -> ApiResponse[dict[str, object]]:
    try:
        service.timelog_delete_day(db, user_id=user_id, day=day)
        return ok({"deleted": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.get("/stats", response_model=ApiResponse[AttendanceStats])
def stats(
    from_date: date,
    to_date: date,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("reports.read")),
) -> ApiResponse[AttendanceStats]:
    try:
        data = service.stats(db, from_day=from_date, to_day_inclusive=to_date)
        return ok(AttendanceStats(**data))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))

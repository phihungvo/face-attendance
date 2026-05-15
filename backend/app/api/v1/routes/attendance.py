from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_company_scope_id, require_permission
from app.core.errors import BAD_REQUEST, AppException
from app.core.response import ok
from app.db.session import get_db
from app.schemas.attendance import (
    AttendanceLogOut,
    AttendanceStats,
    CheckInResponse,
    CheckOutResponse,
    ScanResponse,
    DailyAttendanceRow,
    MonthlyReportRow,
    TimelogRow,
    TimelogUpsertRequest,
)
from app.schemas.common import ApiResponse
from app.services.attendance import AttendanceService
from app.notifications.publisher import publish_notification_event

router = APIRouter()
service = AttendanceService()


@router.post("/checkin", response_model=ApiResponse[CheckInResponse])
async def checkin(
    image: UploadFile = File(...),
    latitude: float | None = Form(default=None),
    longitude: float | None = Form(default=None),
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("attendance.manage")),
) -> ApiResponse[CheckInResponse]:
    """
    Check-in via face recognition.
    """
    try:
        if company_id is None:
            raise ValueError("Thiếu công ty. Vui lòng chọn công ty (X-Company-Id).")
        image_bytes = await image.read()
        user_id, user_name, confidence, ts = service.checkin(db, company_id=company_id, image_bytes=image_bytes, latitude=latitude, longitude=longitude)
        publish_notification_event({"type": "CHECKIN_SUCCESS", "companyId": int(company_id), "employeeId": int(user_id)})
        return ok(CheckInResponse(user_name=user_name, confidence=confidence, time=ts))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=f"Không thể check-in: {e}")


@router.post("/checkout", response_model=ApiResponse[CheckOutResponse])
async def checkout(
    image: UploadFile = File(...),
    latitude: float | None = Form(default=None),
    longitude: float | None = Form(default=None),
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("attendance.manage")),
) -> ApiResponse[CheckOutResponse]:
    """
    Check-out via face recognition.
    """
    try:
        if company_id is None:
            raise ValueError("Thiếu công ty. Vui lòng chọn công ty (X-Company-Id).")
        image_bytes = await image.read()
        user_id, user_name, confidence, ts = service.checkout(db, company_id=company_id, image_bytes=image_bytes, latitude=latitude, longitude=longitude)
        publish_notification_event({"type": "CHECKOUT_SUCCESS", "companyId": int(company_id), "employeeId": int(user_id)})
        return ok(CheckOutResponse(user_name=user_name, confidence=confidence, time=ts))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=f"Không thể check-out: {e}")


@router.post("/scan", response_model=ApiResponse[ScanResponse])
async def scan(
    image: UploadFile = File(...),
    latitude: float | None = Form(default=None),
    longitude: float | None = Form(default=None),
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("attendance.manage")),
) -> ApiResponse[ScanResponse]:
    """
    One-shot scan: auto decide check-in/check-out.
    """
    try:
        if company_id is None:
            raise ValueError("Thiếu công ty. Vui lòng chọn công ty (X-Company-Id).")
        image_bytes = await image.read()
        user_id, user_name, confidence, ts, action = service.scan(db, company_id=company_id, image_bytes=image_bytes, latitude=latitude, longitude=longitude)
        publish_notification_event({"type": "CHECKIN_SUCCESS" if action == "checkin" else "CHECKOUT_SUCCESS", "companyId": int(company_id), "employeeId": int(user_id)})
        return ok(ScanResponse(user_name=user_name, confidence=confidence, time=ts, action=action))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=f"Không thể quét chấm công: {e}")


@router.post("/me/scan", response_model=ApiResponse[ScanResponse])
async def scan_me(
    image: UploadFile = File(...),
    latitude: float | None = Form(default=None),
    longitude: float | None = Form(default=None),
    db: Session = Depends(get_db),
    user=Depends(require_permission("employee.portal")),
) -> ApiResponse[ScanResponse]:
    """
    Employee self-service scan (must match face with current account).
    """
    try:
        image_bytes = await image.read()
        user_id, user_name, confidence, ts, action = service.scan_for_user(db, user_id=int(user.id), image_bytes=image_bytes, latitude=latitude, longitude=longitude)
        publish_notification_event({"type": "CHECKIN_SUCCESS" if action == "checkin" else "CHECKOUT_SUCCESS", "companyId": int(getattr(user, "company_id", 0) or 0) or None, "employeeId": int(user_id)})
        return ok(ScanResponse(user_name=user_name, confidence=confidence, time=ts, action=action))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=f"Không thể quét chấm công: {e}")


@router.get("/me/logs", response_model=ApiResponse[list[AttendanceLogOut]])
def list_my_logs(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    user=Depends(require_permission("employee.portal")),
) -> ApiResponse[list[AttendanceLogOut]]:
    return ok(service.list_logs_for_user(db, user_id=int(user.id), limit=limit, offset=offset))


@router.get("/me/timelog", response_model=ApiResponse[list[TimelogRow]])
def my_timelog_range(
    from_date: date,
    to_date: date,
    db: Session = Depends(get_db),
    user=Depends(require_permission("employee.portal")),
) -> ApiResponse[list[TimelogRow]]:
    try:
        rows = service.timelog_range_for_user(db, user_id=int(user.id), from_day=from_date, to_day_inclusive=to_date)
        return ok([TimelogRow(**r) for r in rows])
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.get("/logs", response_model=ApiResponse[list[AttendanceLogOut]])
def list_logs(
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("attendance.read")),
) -> ApiResponse[list[AttendanceLogOut]]:
    return ok(service.list_logs(db, company_id=company_id))


@router.get("/reports/daily", response_model=ApiResponse[list[DailyAttendanceRow]])
def daily_attendance(
    day: date,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("timesheet.read")),
) -> ApiResponse[list[DailyAttendanceRow]]:
    rows = service.daily_report(db, company_id=company_id, day=day)
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
    company_id: int | None = Depends(get_company_scope_id),
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

    rows = service.monthly_report(db, company_id=company_id, year=year, month=mo)
    return ok([MonthlyReportRow(**r) for r in rows])


@router.get("/timelog", response_model=ApiResponse[list[TimelogRow]])
def timelog_range(
    from_date: date,
    to_date: date,
    department_id: int | None = None,
    status: str | None = None,  # "on-time" | "late" | "absent"
    include_absent: bool = False,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("timesheet.read")),
) -> ApiResponse[list[TimelogRow]]:
    try:
        rows = service.timelog_range(
            db,
            company_id=company_id,
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
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("attendance.manage")),
) -> ApiResponse[TimelogRow]:
    try:
        row = service.timelog_upsert_day(
            db,
            company_id=company_id,
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
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("attendance.manage")),
) -> ApiResponse[dict[str, object]]:
    try:
        service.timelog_delete_day(db, company_id=company_id, user_id=user_id, day=day)
        return ok({"deleted": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.get("/stats", response_model=ApiResponse[AttendanceStats])
def stats(
    from_date: date,
    to_date: date,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("reports.read")),
) -> ApiResponse[AttendanceStats]:
    try:
        data = service.stats(db, company_id=company_id, from_day=from_date, to_day_inclusive=to_date)
        return ok(AttendanceStats(**data))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))

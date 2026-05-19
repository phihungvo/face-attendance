from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_company_scope_id, get_current_user, require_permission
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
    ManagerDashboardSummary,
    MonthlyReportRow,
    TimelogRow,
    TimelogUpsertRequest,
)
from app.schemas.common import ApiResponse
from app.services.attendance import AttendanceService
from app.services.notifications import NotificationService

router = APIRouter()
service = AttendanceService()
notification_service = NotificationService()


def _safe_notify(fn) -> None:
    try:
        fn()
    except Exception:
        pass


def _notify_attendance_success(
    db: Session,
    *,
    user_id: int,
    company_id: int | None,
    actor_user_id: int | None,
    action: str,
    ts,
    user_name: str | None = None,
    late_minutes: int | None = None,
) -> None:
    event_type = "attendance.checkin.success" if action == "checkin" else "attendance.checkout.success"
    title = "Chấm công vào ca thành công" if action == "checkin" else "Chấm công ra ca thành công"
    _safe_notify(
        lambda: notification_service.create_for_users(
            db,
            company_id=company_id,
            type=event_type,
            category="attendance",
            severity="success",
            title=title,
            body=f"Thời gian: {ts}",
            entity_type="attendance_log",
            entity_id=None,
            action_url="/employee/checkin",
            created_by_user_id=actor_user_id,
            user_ids=[int(user_id)],
        )
    )
    if action != "checkin" or company_id is None or int(late_minutes or 0) <= 0:
        return
    employee_name = (user_name or f"#{user_id}").strip()
    _safe_notify(
        lambda: notification_service.create_for_permission(
            db,
            company_id=int(company_id),
            permission_key="attendance.read",
            type="attendance.late_detected",
            category="attendance",
            severity="warning",
            title=f"{employee_name} check-in muộn {int(late_minutes or 0)} phút",
            body=f"Thời gian check-in: {ts}",
            entity_type="attendance_log",
            entity_id=None,
            action_url="/timelog",
            created_by_user_id=int(actor_user_id) if actor_user_id is not None else int(user_id),
            exclude_user_ids=[int(user_id)],
        )
    )


def _notify_attendance_failure(
    db: Session,
    *,
    user_id: int,
    company_id: int | None,
    message: str,
) -> None:
    detail = message.strip()
    lowered = detail.lower()
    if "không khớp" in lowered:
        event_type = "attendance.face_mismatch"
        title = "Chấm công thất bại: khuôn mặt không khớp"
    elif "gps" in lowered or "phạm vi chấm công" in lowered or "định vị" in lowered:
        event_type = "attendance.geo_rejected"
        title = "Chấm công thất bại: vị trí GPS không hợp lệ"
    elif "khung giờ" in lowered:
        event_type = "attendance.time_window_rejected"
        title = "Chấm công thất bại: ngoài khung giờ"
    else:
        return
    _safe_notify(
        lambda: notification_service.create_for_users(
            db,
            company_id=company_id,
            type=event_type,
            category="attendance",
            severity="warning",
            title=title,
            body=detail,
            entity_type="attendance_log",
            entity_id=None,
            action_url="/employee/checkin",
            created_by_user_id=user_id,
            user_ids=[int(user_id)],
        )
    )


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
        result = service.checkin(db, company_id=company_id, image_bytes=image_bytes, latitude=latitude, longitude=longitude)
        _notify_attendance_success(
            db,
            user_id=int(result["user_id"]),
            company_id=int(result["company_id"]) if result["company_id"] is not None else None,
            actor_user_id=None,
            action="checkin",
            ts=result["time"],
            user_name=str(result["user_name"]),
            late_minutes=int(result.get("late_minutes", 0) or 0),
        )
        return ok(CheckInResponse(user_name=str(result["user_name"]), confidence=float(result["confidence"]), time=result["time"]))
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
        result = service.checkout(db, company_id=company_id, image_bytes=image_bytes, latitude=latitude, longitude=longitude)
        _notify_attendance_success(
            db,
            user_id=int(result["user_id"]),
            company_id=int(result["company_id"]) if result["company_id"] is not None else None,
            actor_user_id=None,
            action="checkout",
            ts=result["time"],
            user_name=str(result["user_name"]),
            late_minutes=int(result.get("late_minutes", 0) or 0),
        )
        return ok(CheckOutResponse(user_name=str(result["user_name"]), confidence=float(result["confidence"]), time=result["time"]))
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
        result = service.scan(db, company_id=company_id, image_bytes=image_bytes, latitude=latitude, longitude=longitude)
        _notify_attendance_success(
            db,
            user_id=int(result["user_id"]),
            company_id=int(result["company_id"]) if result["company_id"] is not None else None,
            actor_user_id=None,
            action=str(result["action"]),
            ts=result["time"],
            user_name=str(result["user_name"]),
            late_minutes=int(result.get("late_minutes", 0) or 0),
        )
        return ok(ScanResponse(user_name=str(result["user_name"]), confidence=float(result["confidence"]), time=result["time"], action=str(result["action"])))
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
        result = service.scan_for_user(db, user_id=int(user.id), image_bytes=image_bytes, latitude=latitude, longitude=longitude)
        _notify_attendance_success(
            db,
            user_id=int(result["user_id"]),
            company_id=int(result["company_id"]) if result["company_id"] is not None else None,
            actor_user_id=int(user.id),
            action=str(result["action"]),
            ts=result["time"],
            user_name=str(result["user_name"]),
            late_minutes=int(result.get("late_minutes", 0) or 0),
        )
        return ok(ScanResponse(user_name=str(result["user_name"]), confidence=float(result["confidence"]), time=result["time"], action=str(result["action"])))
    except ValueError as e:
        _notify_attendance_failure(
            db,
            user_id=int(user.id),
            company_id=int(getattr(user, "company_id", 0) or 0) or None,
            message=str(e),
        )
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
    actor=Depends(get_current_user),
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
        _safe_notify(
            lambda: notification_service.create_for_users(
                db,
                company_id=company_id,
                type="attendance.timelog.updated",
                category="attendance",
                severity="info",
                title="Bảng công của bạn vừa được chỉnh sửa",
                body=f"Ngày {day.isoformat()} đã được cập nhật bởi quản lý.",
                entity_type="attendance_log",
                entity_id=None,
                action_url="/employee/timesheet",
                created_by_user_id=int(actor.id),
                user_ids=[int(user_id)],
            )
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
    actor=Depends(get_current_user),
    _: object = Depends(require_permission("attendance.manage")),
) -> ApiResponse[dict[str, object]]:
    try:
        service.timelog_delete_day(db, company_id=company_id, user_id=user_id, day=day)
        _safe_notify(
            lambda: notification_service.create_for_users(
                db,
                company_id=company_id,
                type="attendance.timelog.deleted",
                category="attendance",
                severity="warning",
                title="Bảng công của bạn vừa bị xóa",
                body=f"Dữ liệu ngày {day.isoformat()} đã bị xóa bởi quản lý.",
                entity_type="attendance_log",
                entity_id=None,
                action_url="/employee/timesheet",
                created_by_user_id=int(actor.id),
                user_ids=[int(user_id)],
            )
        )
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


@router.get("/dashboard/summary", response_model=ApiResponse[ManagerDashboardSummary])
def dashboard_summary(
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("dashboard.read")),
) -> ApiResponse[ManagerDashboardSummary]:
    return ok(ManagerDashboardSummary(**service.manager_dashboard_summary(db, company_id=company_id)))

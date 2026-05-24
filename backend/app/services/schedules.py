from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.repositories.schedules import WorkScheduleRegistrationRepository, WorkScheduleRegistrationRequestRepository, WorkScheduleRepository
from app.repositories.users import UserRepository


def _validate_hhmm(v: str) -> str:
    v = v.strip()
    if len(v) != 5 or v[2] != ":":
        raise ValueError("Time phải theo định dạng HH:MM")
    hh = int(v[0:2])
    mm = int(v[3:5])
    if hh < 0 or hh > 23 or mm < 0 or mm > 59:
        raise ValueError("Time không hợp lệ")
    return v


def _days_list_to_mask(days: list[int]) -> int:
    m = 0
    for d in days or []:
        if int(d) < 0 or int(d) > 6:
            continue
        m |= 1 << int(d)
    return m


def _weekday_mon0(d: date) -> int:
    # Python: Monday=0..Sunday=6
    return int(d.weekday())


def _time_to_min(hhmm: str) -> int:
    hh = int(hhmm[0:2])
    mm = int(hhmm[3:5])
    return hh * 60 + mm


def _interval_for_shift(shift_start: str, shift_end: str) -> tuple[int, int]:
    st = _time_to_min(shift_start)
    en = _time_to_min(shift_end)
    if en <= st:
        en += 24 * 60
    return st, en


def _overlaps(a: tuple[int, int], b: tuple[int, int]) -> bool:
    return max(a[0], b[0]) < min(a[1], b[1])


class ScheduleService:
    def __init__(self) -> None:
        self._schedules = WorkScheduleRepository()
        self._regs = WorkScheduleRegistrationRepository()
        self._reqs = WorkScheduleRegistrationRequestRepository()
        self._users = UserRepository()

    # ---- schedule templates (manager/admin) ----
    def list_schedules(self, db: Session, *, company_id: int, q: str | None = None, status: str | None = None, limit: int = 200, offset: int = 0):
        return self._schedules.list(db, company_id=company_id, q=q, status=status, limit=limit, offset=offset)

    def get_schedule(self, db: Session, *, company_id: int, schedule_id: int):
        s = self._schedules.get(db, schedule_id, company_id=company_id)
        if s is None:
            raise ValueError("Schedule not found")
        return s

    def create_schedule(
        self,
        db: Session,
        *,
        company_id: int,
        code: str,
        name: str,
        status: str | None,
        shift_start: str,
        shift_end: str,
        late_grace_minutes: int,
        early_leave_grace_minutes: int,
        break_start: str,
        break_end: str,
        break_duration_minutes: int,
        break_threshold_hours: float,
        auto_checkout_time: str,
        department_id: int | None = None,
        max_registrations: int = 0,
        days_of_week: list[int] | None = None,
        date_start: date | None = None,
        date_end: date | None = None,
        note: str | None = None,
    ):
        code = code.strip()
        name = name.strip()
        if not code:
            raise ValueError("code is required")
        if not name:
            raise ValueError("name is required")
        if self._schedules.get_by_code(db, company_id=company_id, code=code) is not None:
            raise ValueError("Duplicate schedule code")
        st = _validate_hhmm(shift_start)
        en = _validate_hhmm(shift_end)
        bs = _validate_hhmm(break_start)
        be = _validate_hhmm(break_end)
        ac = _validate_hhmm(auto_checkout_time)
        status_v = (status or "active").strip() or "active"
        if date_start and date_end and date_end < date_start:
            raise ValueError("date_end phải >= date_start")
        days_mask = _days_list_to_mask(list(days_of_week or [0, 1, 2, 3, 4, 5, 6]))
        if days_mask == 0:
            raise ValueError("days_of_week không hợp lệ")
        try:
            s = self._schedules.create(
                db,
                company_id=company_id,
                code=code,
                name=name,
                status=status_v,
                shift_start=st,
                shift_end=en,
                late_grace_minutes=int(late_grace_minutes),
                early_leave_grace_minutes=int(early_leave_grace_minutes),
                break_start=bs,
                break_end=be,
                break_duration_minutes=int(break_duration_minutes),
                break_threshold_hours=float(break_threshold_hours),
                auto_checkout_time=ac,
                department_id=int(department_id) if department_id is not None else None,
                max_registrations=int(max_registrations or 0),
                days_of_week_mask=int(days_mask),
                date_start=date_start,
                date_end=date_end,
                note=note.strip() if note else None,
            )
            db.commit()
            db.refresh(s)
            return s
        except IntegrityError:
            db.rollback()
            raise ValueError("Không thể tạo schedule (trùng dữ liệu hoặc ràng buộc DB)")

    def update_schedule(self, db: Session, *, company_id: int, schedule_id: int, data: dict[str, object]):
        if "code" in data and data["code"] is not None:
            code = str(data["code"]).strip()
            if not code:
                raise ValueError("code is required")
            other = self._schedules.get_by_code(db, company_id=company_id, code=code)
            if other is not None and int(other.id) != int(schedule_id):
                raise ValueError("Duplicate schedule code")
            data["code"] = code
        if "name" in data and data["name"] is not None:
            name = str(data["name"]).strip()
            if not name:
                raise ValueError("name is required")
            data["name"] = name
        for k in ["shift_start", "shift_end", "break_start", "break_end", "auto_checkout_time"]:
            if k in data and data[k] is not None:
                data[k] = _validate_hhmm(str(data[k]))
        if "status" in data and data["status"] is not None:
            data["status"] = str(data["status"]).strip()
        if "note" in data and data["note"] is not None:
            data["note"] = str(data["note"]).strip() or None
        if "max_registrations" in data and data["max_registrations"] is not None:
            data["max_registrations"] = int(data["max_registrations"] or 0)
        if "department_id" in data and data["department_id"] is not None:
            data["department_id"] = int(data["department_id"])
        if "date_start" in data and "date_end" in data and data.get("date_start") and data.get("date_end"):
            if data["date_end"] < data["date_start"]:
                raise ValueError("date_end phải >= date_start")
        if "days_of_week" in data and data["days_of_week"] is not None:
            days = list(data["days_of_week"] or [])
            mask = _days_list_to_mask([int(x) for x in days])
            if mask == 0:
                raise ValueError("days_of_week không hợp lệ")
            data["days_of_week_mask"] = int(mask)
            del data["days_of_week"]
        s = self._schedules.update_fields(db, company_id=company_id, schedule_id=schedule_id, data=data)
        if s is None:
            raise ValueError("Schedule not found")
        try:
            db.commit()
            db.refresh(s)
            return s
        except IntegrityError:
            db.rollback()
            raise ValueError("Không thể cập nhật schedule (ràng buộc DB)")

    def delete_schedule(self, db: Session, *, company_id: int, schedule_id: int) -> None:
        try:
            ok = self._schedules.delete(db, company_id=company_id, schedule_id=schedule_id)
            if not ok:
                raise ValueError("Schedule not found")
            db.commit()
        except IntegrityError:
            db.rollback()
            raise ValueError("Schedule đang được sử dụng; không thể xoá")

    # ---- registrations ----
    def list_my_registrations(
        self,
        db: Session,
        *,
        company_id: int,
        user_id: int,
        from_date: date | None = None,
        to_date: date | None = None,
        status: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ):
        return self._regs.list_for_user(db, company_id=company_id, user_id=user_id, from_date=from_date, to_date=to_date, status=status, limit=limit, offset=offset)

    def _register_my_schedule_no_commit(
        self,
        db: Session,
        *,
        company_id: int,
        user_id: int,
        day: date,
        schedule_id: int,
        request_id: int | None = None,
        status: str = "pending",
        note: str | None = None,
    ):
        s = self._schedules.get(db, schedule_id, company_id=company_id)
        if s is None or getattr(s, "status", "active") != "active":
            raise ValueError("Schedule không tồn tại hoặc đang bị khoá")
        # Validate applicability: date range + weekday selection (index4).
        ds = getattr(s, "date_start", None)
        de = getattr(s, "date_end", None)
        if ds and day < ds:
            raise ValueError("Ngày đăng ký chưa nằm trong khoảng áp dụng của ca")
        if de and day > de:
            raise ValueError("Ngày đăng ký đã vượt quá khoảng áp dụng của ca")
        mask = int(getattr(s, "days_of_week_mask", 127) or 0)
        wd = _weekday_mon0(day)  # 0=Mon..6=Sun
        if (mask & (1 << wd)) == 0:
            raise ValueError("Ca làm không áp dụng cho ngày trong tuần này")

        # Capacity: count pending+approved.
        max_regs = int(getattr(s, "max_registrations", 0) or 0)
        if max_regs > 0:
            used = self._regs.count_active_for_schedule_day(db, company_id=company_id, schedule_id=int(schedule_id), day=day)
            if used >= max_regs:
                raise ValueError("Ca làm đã đủ số người tối đa cho ngày này")

        # Allow multiple shifts per day if time windows do not overlap.
        new_iv = _interval_for_shift(str(getattr(s, "shift_start")), str(getattr(s, "shift_end")))
        existing_rows = self._regs.list_active_for_user_day_with_schedule(db, company_id=company_id, user_id=user_id, day=day)
        for _, ex_sched in existing_rows:
            ex_iv = _interval_for_shift(str(getattr(ex_sched, "shift_start")), str(getattr(ex_sched, "shift_end")))
            if _overlaps(new_iv, ex_iv):
                raise ValueError("Bạn đã đăng ký ca khác bị trùng giờ trong ngày này")
        r = self._regs.create(
            db,
            company_id=company_id,
            user_id=user_id,
            schedule_id=schedule_id,
            request_id=request_id,
            day=day,
            status=status,
            note=note.strip() if note else None,
        )
        return r

    def register_my_schedule(
        self,
        db: Session,
        *,
        company_id: int,
        user_id: int,
        day: date,
        schedule_id: int,
        note: str | None = None,
    ):
        r = self._register_my_schedule_no_commit(db, company_id=company_id, user_id=user_id, day=day, schedule_id=schedule_id, note=note)
        db.commit()
        db.refresh(r)
        return r

    def register_my_schedules_bulk(
        self,
        db: Session,
        *,
        company_id: int,
        user_id: int,
        schedule_id: int,
        days: list[date],
        note: str | None = None,
        max_days: int = 186,
    ) -> list[object]:
        uniq = sorted({d for d in (days or [])})
        if not uniq:
            raise ValueError("Danh sách ngày đăng ký bị rỗng")
        if len(uniq) > max_days:
            raise ValueError(f"Quá nhiều ngày đăng ký (tối đa {max_days})")
        out: list[object] = []
        try:
            for d in uniq:
                out.append(self._register_my_schedule_no_commit(db, company_id=company_id, user_id=user_id, day=d, schedule_id=schedule_id, note=note))
            db.commit()
            return out
        except IntegrityError:
            db.rollback()
            raise ValueError("Không thể đăng ký (ràng buộc DB)")
        except ValueError:
            db.rollback()
            raise

    # ---- registration requests (batch approvals) ----
    def create_my_registration_request(
        self,
        db: Session,
        *,
        company_id: int,
        user_id: int,
        schedule_id: int,
        days: list[date],
        note: str | None = None,
        max_days: int = 186,
    ) -> object:
        uniq = sorted({d for d in (days or [])})
        if not uniq:
            raise ValueError("Danh sách ngày đăng ký bị rỗng")
        if len(uniq) > max_days:
            raise ValueError(f"Quá nhiều ngày đăng ký (tối đa {max_days})")

        # Build request shape from the provided days.
        date_from = uniq[0]
        date_to = uniq[-1]
        days_mask = _days_list_to_mask([_weekday_mon0(d) for d in uniq])

        try:
            req = self._reqs.create(
                db,
                company_id=company_id,
                user_id=user_id,
                schedule_id=schedule_id,
                date_from=date_from,
                date_to=date_to,
                days_of_week_mask=int(days_mask) or 127,
                status="pending",
                note=note.strip() if note else None,
            )
            for d in uniq:
                try:
                    self._register_my_schedule_no_commit(
                        db,
                        company_id=company_id,
                        user_id=user_id,
                        day=d,
                        schedule_id=schedule_id,
                        request_id=int(req.id),
                        status="pending",
                        note=note,
                    )
                except ValueError as e:
                    raise ValueError(f"Ngày {d.isoformat()}: {str(e)}")
            db.commit()
            db.refresh(req)
            return req
        except IntegrityError:
            db.rollback()
            raise ValueError("Không thể tạo yêu cầu đăng ký (ràng buộc DB)")
        except ValueError:
            db.rollback()
            raise

    def list_my_registration_requests(
        self,
        db: Session,
        *,
        company_id: int,
        user_id: int,
        status: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ):
        return self._reqs.list_for_user(db, company_id=company_id, user_id=user_id, status=status, limit=limit, offset=offset)

    def cancel_my_registration_request(self, db: Session, *, company_id: int, user_id: int, request_id: int) -> object:
        req = self._reqs.get_for_user(db, request_id, company_id=company_id, user_id=user_id)
        if req is None:
            raise ValueError("Request not found")
        if req.status not in {"pending", "approved"}:
            raise ValueError("Không thể huỷ trạng thái hiện tại")
        req = self._reqs.update_status(db, company_id=company_id, request_id=request_id, status="cancelled")
        self._regs.update_status_for_request(db, company_id=company_id, request_id=request_id, status="cancelled")
        db.commit()
        if req is not None:
            db.refresh(req)
        return req

    def list_registration_requests(
        self,
        db: Session,
        *,
        company_id: int,
        status: str | None = None,
        q: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> dict[str, object]:
        total = self._reqs.count_for_company(db, company_id=company_id, status=status, q=q)
        rows = self._reqs.list_for_company(db, company_id=company_id, status=status, q=q, limit=limit, offset=offset)
        items = []
        for req, user, sched in rows:
            items.append(
                {
                    "id": req.id,
                    "status": req.status,
                    "note": req.note,
                    "response_note": getattr(req, "response_note", None),
                    "date_from": req.date_from,
                    "date_to": req.date_to,
                    "days_of_week_mask": req.days_of_week_mask,
                    "user_id": user.id,
                    "user_name": user.name,
                    "user_code": getattr(user, "code", None),
                    "schedule_id": sched.id,
                    "schedule_code": sched.code,
                    "schedule_name": sched.name,
                    "approved_by_user_id": req.approved_by_user_id,
                    "approved_at": req.approved_at,
                    "created_at": req.created_at,
                    "updated_at": req.updated_at,
                }
            )
        return {"items": items, "total": total}

    def approve_registration_request(self, db: Session, *, company_id: int, approver_user_id: int, request_id: int) -> object:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        req = self._reqs.update_status(db, company_id=company_id, request_id=request_id, status="approved", approved_by_user_id=approver_user_id, approved_at=now)
        if req is None:
            raise ValueError("Request not found")
        self._regs.update_status_for_request(db, company_id=company_id, request_id=request_id, status="approved", approved_by_user_id=approver_user_id, approved_at=now)
        db.commit()
        db.refresh(req)
        return req

    def reject_registration_request(self, db: Session, *, company_id: int, approver_user_id: int, request_id: int, note: str | None = None) -> object:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        req = self._reqs.update_status(
            db,
            company_id=company_id,
            request_id=request_id,
            status="rejected",
            approved_by_user_id=approver_user_id,
            approved_at=now,
            response_note=note.strip() if note else None,
        )
        if req is None:
            raise ValueError("Request not found")
        self._regs.update_status_for_request(db, company_id=company_id, request_id=request_id, status="rejected", approved_by_user_id=approver_user_id, approved_at=now, response_note=note.strip() if note else None)
        db.commit()
        db.refresh(req)
        return req

    def cancel_my_registration(self, db: Session, *, company_id: int, user_id: int, reg_id: int) -> object:
        r = self._regs.get_for_user(db, reg_id, company_id=company_id, user_id=user_id)
        if r is None:
            raise ValueError("Registration not found")
        if r.status not in {"pending", "approved"}:
            raise ValueError("Không thể huỷ trạng thái hiện tại")
        # Keep audit: mark cancelled.
        r = self._regs.update_status(db, company_id=company_id, reg_id=reg_id, status="cancelled")
        db.commit()
        if r is not None:
            db.refresh(r)
        return r

    def list_registrations(
        self,
        db: Session,
        *,
        company_id: int,
        from_date: date | None = None,
        to_date: date | None = None,
        status: str | None = None,
        user_id: int | None = None,
        q: str | None = None,
        department_id: int | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> dict[str, object]:
        total = self._regs.count_for_company(
            db,
            company_id=company_id,
            from_date=from_date,
            to_date=to_date,
            status=status,
            user_id=user_id,
            q=q,
            department_id=department_id,
        )
        rows = self._regs.list_for_company(
            db,
            company_id=company_id,
            from_date=from_date,
            to_date=to_date,
            status=status,
            user_id=user_id,
            q=q,
            department_id=department_id,
            limit=limit,
            offset=offset,
        )
        items = []
        for reg, user, sched in rows:
            items.append(
                {
                    "id": reg.id,
                    "day": reg.day,
                    "status": reg.status,
                    "note": reg.note,
                    "response_note": getattr(reg, "response_note", None),
                    "user_id": user.id,
                    "user_name": user.name,
                    "user_code": user.code,
                    "department_id": user.department_id,
                    "schedule_id": sched.id,
                    "schedule_code": sched.code,
                    "schedule_name": sched.name,
                    "approved_by_user_id": reg.approved_by_user_id,
                    "approved_at": reg.approved_at,
                    "created_at": reg.created_at,
                    "updated_at": reg.updated_at,
                }
            )
        return {"items": items, "total": total}

    def approve_registration(self, db: Session, *, company_id: int, approver_user_id: int, reg_id: int) -> object:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        r = self._regs.update_status(db, company_id=company_id, reg_id=reg_id, status="approved", approved_by_user_id=approver_user_id, approved_at=now)
        if r is None:
            raise ValueError("Registration not found")
        db.commit()
        db.refresh(r)
        return r

    def reject_registration(self, db: Session, *, company_id: int, approver_user_id: int, reg_id: int, note: str | None = None) -> object:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        r = self._regs.update_status(
            db,
            company_id=company_id,
            reg_id=reg_id,
            status="rejected",
            approved_by_user_id=approver_user_id,
            approved_at=now,
            response_note=note.strip() if note else None,
        )
        if r is None:
            raise ValueError("Registration not found")
        db.commit()
        db.refresh(r)
        return r

    def delete_registration(self, db: Session, *, company_id: int, reg_id: int) -> object:
        r = self._regs.get(db, reg_id, company_id=company_id)
        if r is None:
            raise ValueError("Registration not found")
        # Safety: only allow deleting non-pending to avoid accidental data loss.
        if r.status == "pending":
            raise ValueError("Không thể xoá khi đang pending; hãy duyệt/từ chối trước")
        db.delete(r)
        db.commit()
        return r

    def assign_schedule(
        self,
        db: Session,
        *,
        company_id: int,
        actor_user_id: int,
        user_id: int,
        day: date,
        schedule_id: int,
        status: str = "approved",
        note: str | None = None,
    ):
        if self._users.get(db, user_id, company_id=company_id) is None:
            raise ValueError("User not found")
        status_v = status.strip() if status else "approved"
        if status_v not in {"approved", "pending"}:
            raise ValueError("Invalid status")
        approved_at = datetime.now(timezone.utc).replace(tzinfo=None) if status_v == "approved" else None
        approved_by = actor_user_id if status_v == "approved" else None
        try:
            r = self._register_my_schedule_no_commit(
                db,
                company_id=company_id,
                user_id=user_id,
                day=day,
                schedule_id=schedule_id,
                status=status_v,
                note=None,
            )
            if note:
                r.response_note = note.strip()
            if approved_by is not None:
                r.approved_by_user_id = approved_by
            if approved_at is not None:
                r.approved_at = approved_at
            db.commit()
            db.refresh(r)
            return r
        except IntegrityError:
            db.rollback()
            raise ValueError("Không thể gán ca làm (ràng buộc DB)")
        except ValueError:
            db.rollback()
            raise

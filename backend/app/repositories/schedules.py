from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.work_schedule import WorkSchedule
from app.models.work_schedule_registration import WorkScheduleRegistration
from app.models.work_schedule_registration_request import WorkScheduleRegistrationRequest


class WorkScheduleRepository:
    def create(
        self,
        db: Session,
        *,
        company_id: int,
        code: str,
        name: str,
        status: str,
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
        days_of_week_mask: int = 127,
        date_start: date | None = None,
        date_end: date | None = None,
        note: str | None = None,
    ) -> WorkSchedule:
        s = WorkSchedule(
            company_id=company_id,
            code=code,
            name=name,
            status=status,
            shift_start=shift_start,
            shift_end=shift_end,
            late_grace_minutes=late_grace_minutes,
            early_leave_grace_minutes=early_leave_grace_minutes,
            break_start=break_start,
            break_end=break_end,
            break_duration_minutes=break_duration_minutes,
            break_threshold_hours=break_threshold_hours,
            auto_checkout_time=auto_checkout_time,
            department_id=department_id,
            max_registrations=max_registrations,
            days_of_week_mask=days_of_week_mask,
            date_start=date_start,
            date_end=date_end,
            note=note,
        )
        db.add(s)
        db.flush()
        return s

    def list(
        self,
        db: Session,
        *,
        company_id: int,
        q: str | None = None,
        status: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> list[WorkSchedule]:
        stmt = select(WorkSchedule).where(WorkSchedule.company_id == company_id)
        if status:
            stmt = stmt.where(WorkSchedule.status == status)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(or_(WorkSchedule.name.ilike(like), WorkSchedule.code.ilike(like)))
        stmt = stmt.order_by(WorkSchedule.id.desc()).limit(limit).offset(offset)
        return list(db.execute(stmt).scalars().all())

    def get(self, db: Session, schedule_id: int, *, company_id: int) -> WorkSchedule | None:
        stmt = select(WorkSchedule).where(WorkSchedule.id == schedule_id, WorkSchedule.company_id == company_id).limit(1)
        return db.execute(stmt).scalars().first()

    def get_by_code(self, db: Session, *, company_id: int, code: str) -> WorkSchedule | None:
        stmt = select(WorkSchedule).where(WorkSchedule.company_id == company_id, WorkSchedule.code == code).limit(1)
        return db.execute(stmt).scalars().first()

    def update_fields(
        self,
        db: Session,
        *,
        company_id: int,
        schedule_id: int,
        data: dict[str, object],
    ) -> WorkSchedule | None:
        s = self.get(db, schedule_id, company_id=company_id)
        if s is None:
            return None
        for k, v in data.items():
            if v is None:
                continue
            if hasattr(s, k):
                setattr(s, k, v)
        db.add(s)
        db.flush()
        return s

    def delete(self, db: Session, *, company_id: int, schedule_id: int) -> bool:
        s = self.get(db, schedule_id, company_id=company_id)
        if s is None:
            return False
        db.delete(s)
        db.flush()
        return True

    def list_by_ids(self, db: Session, *, company_id: int, ids: list[int]) -> list[WorkSchedule]:
        if not ids:
            return []
        stmt = select(WorkSchedule).where(WorkSchedule.company_id == company_id, WorkSchedule.id.in_(ids))
        return list(db.execute(stmt).scalars().all())


class WorkScheduleRegistrationRepository:
    def create(
        self,
        db: Session,
        *,
        company_id: int,
        user_id: int,
        schedule_id: int,
        request_id: int | None = None,
        day: date,
        status: str,
        note: str | None = None,
        response_note: str | None = None,
        approved_by_user_id: int | None = None,
        approved_at: datetime | None = None,
    ) -> WorkScheduleRegistration:
        r = WorkScheduleRegistration(
            company_id=company_id,
            user_id=user_id,
            schedule_id=schedule_id,
            request_id=request_id,
            day=day,
            status=status,
            note=note,
            response_note=response_note,
            approved_by_user_id=approved_by_user_id,
            approved_at=approved_at,
        )
        db.add(r)
        db.flush()
        return r

    def update_status_for_request(
        self,
        db: Session,
        *,
        company_id: int,
        request_id: int,
        status: str,
        approved_by_user_id: int | None = None,
        approved_at: datetime | None = None,
        response_note: str | None = None,
    ) -> int:
        stmt = select(WorkScheduleRegistration).where(WorkScheduleRegistration.company_id == company_id, WorkScheduleRegistration.request_id == request_id)
        rows = list(db.execute(stmt).scalars().all())
        for r in rows:
            r.status = status
            if response_note is not None:
                r.response_note = response_note
            if approved_by_user_id is not None:
                r.approved_by_user_id = approved_by_user_id
            if approved_at is not None:
                r.approved_at = approved_at
            db.add(r)
        db.flush()
        return len(rows)

    def get(self, db: Session, reg_id: int, *, company_id: int) -> WorkScheduleRegistration | None:
        stmt = select(WorkScheduleRegistration).where(WorkScheduleRegistration.id == reg_id, WorkScheduleRegistration.company_id == company_id).limit(1)
        return db.execute(stmt).scalars().first()

    def get_for_user(self, db: Session, reg_id: int, *, company_id: int, user_id: int) -> WorkScheduleRegistration | None:
        stmt = (
            select(WorkScheduleRegistration)
            .where(
                WorkScheduleRegistration.id == reg_id,
                WorkScheduleRegistration.company_id == company_id,
                WorkScheduleRegistration.user_id == user_id,
            )
            .limit(1)
        )
        return db.execute(stmt).scalars().first()

    def get_for_user_day(self, db: Session, *, company_id: int, user_id: int, day: date) -> WorkScheduleRegistration | None:
        stmt = (
            select(WorkScheduleRegistration)
            .where(
                WorkScheduleRegistration.company_id == company_id,
                WorkScheduleRegistration.user_id == user_id,
                WorkScheduleRegistration.day == day,
            )
            .order_by(WorkScheduleRegistration.id.desc())
            .limit(1)
        )
        return db.execute(stmt).scalars().first()

    def list_active_for_user_day_with_schedule(
        self,
        db: Session,
        *,
        company_id: int,
        user_id: int,
        day: date,
    ) -> list[tuple[WorkScheduleRegistration, WorkSchedule]]:
        stmt: Select = (
            select(WorkScheduleRegistration, WorkSchedule)
            .join(WorkSchedule, WorkSchedule.id == WorkScheduleRegistration.schedule_id)
            .where(
                WorkScheduleRegistration.company_id == company_id,
                WorkScheduleRegistration.user_id == user_id,
                WorkScheduleRegistration.day == day,
                WorkScheduleRegistration.status.in_(["pending", "approved"]),
            )
            .order_by(WorkScheduleRegistration.id.desc())
        )
        return list(db.execute(stmt).all())

    def count_active_for_schedule_day(
        self,
        db: Session,
        *,
        company_id: int,
        schedule_id: int,
        day: date,
    ) -> int:
        stmt = select(func.count(WorkScheduleRegistration.id)).where(
            WorkScheduleRegistration.company_id == company_id,
            WorkScheduleRegistration.schedule_id == schedule_id,
            WorkScheduleRegistration.day == day,
            WorkScheduleRegistration.status.in_(["pending", "approved"]),
        )
        return int(db.execute(stmt).scalar_one() or 0)

    def list_for_user(
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
    ) -> list[WorkScheduleRegistration]:
        stmt = select(WorkScheduleRegistration).where(
            WorkScheduleRegistration.company_id == company_id,
            WorkScheduleRegistration.user_id == user_id,
        )
        if status:
            stmt = stmt.where(WorkScheduleRegistration.status == status)
        if from_date:
            stmt = stmt.where(WorkScheduleRegistration.day >= from_date)
        if to_date:
            stmt = stmt.where(WorkScheduleRegistration.day <= to_date)
        stmt = stmt.order_by(WorkScheduleRegistration.day.desc(), WorkScheduleRegistration.id.desc()).limit(limit).offset(offset)
        return list(db.execute(stmt).scalars().all())

    def list_for_company(
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
    ) -> list[tuple[WorkScheduleRegistration, User, WorkSchedule]]:
        stmt: Select = (
            select(WorkScheduleRegistration, User, WorkSchedule)
            .join(User, User.id == WorkScheduleRegistration.user_id)
            .join(WorkSchedule, WorkSchedule.id == WorkScheduleRegistration.schedule_id)
            .where(WorkScheduleRegistration.company_id == company_id)
        )
        if status:
            stmt = stmt.where(WorkScheduleRegistration.status == status)
        if user_id is not None:
            stmt = stmt.where(User.id == user_id)
        if q:
            like = f"%{q.strip()}%"
            stmt = stmt.where(or_(User.name.ilike(like), User.code.ilike(like)))
        if department_id is not None:
            stmt = stmt.where(User.department_id == department_id)
        if from_date:
            stmt = stmt.where(WorkScheduleRegistration.day >= from_date)
        if to_date:
            stmt = stmt.where(WorkScheduleRegistration.day <= to_date)
        stmt = stmt.order_by(WorkScheduleRegistration.day.desc(), WorkScheduleRegistration.id.desc()).limit(limit).offset(offset)
        return list(db.execute(stmt).all())

    def count_for_company(
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
    ) -> int:
        stmt = (
            select(func.count(WorkScheduleRegistration.id))
            .select_from(WorkScheduleRegistration)
            .join(User, User.id == WorkScheduleRegistration.user_id)
            .where(WorkScheduleRegistration.company_id == company_id)
        )
        if status:
            stmt = stmt.where(WorkScheduleRegistration.status == status)
        if user_id is not None:
            stmt = stmt.where(User.id == user_id)
        if q:
            like = f"%{q.strip()}%"
            stmt = stmt.where(or_(User.name.ilike(like), User.code.ilike(like)))
        if department_id is not None:
            stmt = stmt.where(User.department_id == department_id)
        if from_date:
            stmt = stmt.where(WorkScheduleRegistration.day >= from_date)
        if to_date:
            stmt = stmt.where(WorkScheduleRegistration.day <= to_date)
        return int(db.execute(stmt).scalar_one() or 0)

    def update_status(
        self,
        db: Session,
        *,
        company_id: int,
        reg_id: int,
        status: str,
        approved_by_user_id: int | None = None,
        approved_at: datetime | None = None,
        note: str | None = None,
        response_note: str | None = None,
    ) -> WorkScheduleRegistration | None:
        r = self.get(db, reg_id, company_id=company_id)
        if r is None:
            return None
        r.status = status
        if note is not None:
            r.note = note
        if response_note is not None:
            r.response_note = response_note
        if approved_by_user_id is not None:
            r.approved_by_user_id = approved_by_user_id
        if approved_at is not None:
            r.approved_at = approved_at
        db.add(r)
        db.flush()
        return r

    def list_approved_in_range(
        self,
        db: Session,
        *,
        company_id: int,
        from_date: date,
        to_date: date,
        user_ids: list[int] | None = None,
    ) -> list[WorkScheduleRegistration]:
        stmt = select(WorkScheduleRegistration).where(
            WorkScheduleRegistration.company_id == company_id,
            WorkScheduleRegistration.status == "approved",
            WorkScheduleRegistration.day >= from_date,
            WorkScheduleRegistration.day <= to_date,
        )
        if user_ids:
            stmt = stmt.where(WorkScheduleRegistration.user_id.in_(user_ids))
        return list(db.execute(stmt).scalars().all())

class WorkScheduleRegistrationRequestRepository:
    def create(
        self,
        db: Session,
        *,
        company_id: int,
        user_id: int,
        schedule_id: int,
        date_from: date,
        date_to: date,
        days_of_week_mask: int,
        status: str,
        note: str | None = None,
    ) -> WorkScheduleRegistrationRequest:
        r = WorkScheduleRegistrationRequest(
            company_id=company_id,
            user_id=user_id,
            schedule_id=schedule_id,
            date_from=date_from,
            date_to=date_to,
            days_of_week_mask=days_of_week_mask,
            status=status,
            note=note,
        )
        db.add(r)
        db.flush()
        return r

    def get(self, db: Session, request_id: int, *, company_id: int) -> WorkScheduleRegistrationRequest | None:
        stmt = select(WorkScheduleRegistrationRequest).where(WorkScheduleRegistrationRequest.id == request_id, WorkScheduleRegistrationRequest.company_id == company_id).limit(1)
        return db.execute(stmt).scalars().first()

    def get_for_user(self, db: Session, request_id: int, *, company_id: int, user_id: int) -> WorkScheduleRegistrationRequest | None:
        stmt = (
            select(WorkScheduleRegistrationRequest)
            .where(
                WorkScheduleRegistrationRequest.id == request_id,
                WorkScheduleRegistrationRequest.company_id == company_id,
                WorkScheduleRegistrationRequest.user_id == user_id,
            )
            .limit(1)
        )
        return db.execute(stmt).scalars().first()

    def list_for_user(
        self,
        db: Session,
        *,
        company_id: int,
        user_id: int,
        status: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> list[WorkScheduleRegistrationRequest]:
        stmt = select(WorkScheduleRegistrationRequest).where(WorkScheduleRegistrationRequest.company_id == company_id, WorkScheduleRegistrationRequest.user_id == user_id)
        if status:
            stmt = stmt.where(WorkScheduleRegistrationRequest.status == status)
        stmt = stmt.order_by(WorkScheduleRegistrationRequest.id.desc()).limit(limit).offset(offset)
        return list(db.execute(stmt).scalars().all())

    def count_for_company(self, db: Session, *, company_id: int, status: str | None = None, q: str | None = None) -> int:
        stmt = (
            select(func.count(WorkScheduleRegistrationRequest.id))
            .select_from(WorkScheduleRegistrationRequest)
            .join(User, User.id == WorkScheduleRegistrationRequest.user_id)
            .where(WorkScheduleRegistrationRequest.company_id == company_id)
        )
        if status:
            stmt = stmt.where(WorkScheduleRegistrationRequest.status == status)
        if q:
            like = f"%{q.strip()}%"
            stmt = stmt.where(or_(User.name.ilike(like), User.code.ilike(like)))
        return int(db.execute(stmt).scalar_one() or 0)

    def list_for_company(
        self,
        db: Session,
        *,
        company_id: int,
        status: str | None = None,
        q: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> list[tuple[WorkScheduleRegistrationRequest, User, WorkSchedule]]:
        stmt: Select = (
            select(WorkScheduleRegistrationRequest, User, WorkSchedule)
            .join(User, User.id == WorkScheduleRegistrationRequest.user_id)
            .join(WorkSchedule, WorkSchedule.id == WorkScheduleRegistrationRequest.schedule_id)
            .where(WorkScheduleRegistrationRequest.company_id == company_id)
        )
        if status:
            stmt = stmt.where(WorkScheduleRegistrationRequest.status == status)
        if q:
            like = f"%{q.strip()}%"
            stmt = stmt.where(or_(User.name.ilike(like), User.code.ilike(like)))
        stmt = stmt.order_by(WorkScheduleRegistrationRequest.id.desc()).limit(limit).offset(offset)
        return list(db.execute(stmt).all())

    def update_status(
        self,
        db: Session,
        *,
        company_id: int,
        request_id: int,
        status: str,
        approved_by_user_id: int | None = None,
        approved_at: datetime | None = None,
        response_note: str | None = None,
    ) -> WorkScheduleRegistrationRequest | None:
        r = self.get(db, request_id, company_id=company_id)
        if r is None:
            return None
        r.status = status
        if response_note is not None:
            r.response_note = response_note
        if approved_by_user_id is not None:
            r.approved_by_user_id = approved_by_user_id
        if approved_at is not None:
            r.approved_at = approved_at
        db.add(r)
        db.flush()
        return r

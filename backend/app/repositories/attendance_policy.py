from __future__ import annotations

import time

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.dialects.mysql import insert as mysql_insert

from app.core.settings import settings
from app.models.attendance_policy import AttendancePolicy
from app.models.company_attendance_policy import CompanyAttendancePolicy


class AttendancePolicyRepository:
    SINGLETON_ID = 1

    def get_default_or_create(self, db: Session) -> AttendancePolicy:
        # Concurrency-safe-ish singleton: avoid deadlocks when multiple requests initialize the row.
        for _ in range(3):
            policy = db.get(AttendancePolicy, self.SINGLETON_ID)
            if policy is not None:
                return policy
            try:
                policy = AttendancePolicy(
                    id=self.SINGLETON_ID,
                    timezone=getattr(settings, "ATTENDANCE_TIMEZONE", "Asia/Ho_Chi_Minh"),
                    face_match_threshold=float(getattr(settings, "FACE_MATCH_THRESHOLD", 0.5)),
                    shift_start=settings.SHIFT_START,
                    shift_end=getattr(settings, "SHIFT_END", "18:00"),
                    late_grace_minutes=int(settings.LATE_GRACE_MINUTES),
                    early_leave_grace_minutes=int(getattr(settings, "EARLY_LEAVE_GRACE_MINUTES", 0)),
                    break_start=str(getattr(settings, "BREAK_START", "12:00")),
                    break_end=str(getattr(settings, "BREAK_END", "13:00")),
                    break_duration_minutes=int(getattr(settings, "BREAK_DURATION_MINUTES", 60)),
                    break_threshold_hours=float(getattr(settings, "BREAK_THRESHOLD_HOURS", 6.0)),
                    auto_checkout_time=str(getattr(settings, "AUTO_CHECKOUT_TIME", "23:59")),
                )
                db.add(policy)
                db.flush()
                return policy
            except (IntegrityError, OperationalError):
                db.rollback()
                time.sleep(0.05)
                continue
        policy = db.get(AttendancePolicy, self.SINGLETON_ID)
        if policy is not None:
            return policy
        raise RuntimeError("get_default_or_create failed after retries")

    def get_or_create(self, db: Session, *, company_id: int | None = None):
        """
        Return attendance policy:
        - If company_id is provided: return company-scoped policy (created by cloning defaults on first access).
        - Else: return legacy global singleton policy (default fallback).
        """
        if company_id is None:
            return self.get_default_or_create(db)
        return self.get_or_create_for_company(db, company_id=company_id)

    def get_or_create_for_company(self, db: Session, *, company_id: int) -> CompanyAttendancePolicy:
        """
        Concurrency-safe-ish get-or-create:
        - In real traffic, multiple requests can race to create the first row for a company.
        - MySQL may raise duplicate key / deadlock during the INSERT.
        We retry a few times and fall back to re-select.
        """
        cid = int(company_id)
        for attempt in range(6):
            policy = db.get(CompanyAttendancePolicy, cid)
            if policy is not None:
                return policy

            # Minimize deadlocks: use a single INSERT ... ON DUPLICATE KEY UPDATE then SELECT.
            base = self.get_default_or_create(db)
            values = {
                "company_id": cid,
                "timezone": base.timezone,
                "face_match_threshold": float(base.face_match_threshold),
                "shift_start": base.shift_start,
                "shift_end": base.shift_end,
                "late_grace_minutes": int(base.late_grace_minutes),
                "early_leave_grace_minutes": int(base.early_leave_grace_minutes),
                "break_start": base.break_start,
                "break_end": base.break_end,
                "break_duration_minutes": int(base.break_duration_minutes),
                "break_threshold_hours": float(base.break_threshold_hours),
                "auto_checkout_time": base.auto_checkout_time,
                "checkin_from": base.checkin_from,
                "checkin_to": base.checkin_to,
                "checkout_from": base.checkout_from,
                "checkout_to": base.checkout_to,
                "min_minutes_between_same_type": int(base.min_minutes_between_same_type),
            }
            stmt = mysql_insert(CompanyAttendancePolicy).values(**values)
            stmt = stmt.on_duplicate_key_update(company_id=stmt.inserted.company_id)
            try:
                db.execute(stmt)
                db.flush()
            except OperationalError:
                db.rollback()
                time.sleep(0.05 * (2**min(attempt, 4)))
                continue
            except IntegrityError:
                db.rollback()
                time.sleep(0.02)
                continue

            policy = db.get(CompanyAttendancePolicy, cid)
            if policy is not None:
                return policy

            time.sleep(0.02)

        policy = db.get(CompanyAttendancePolicy, cid)
        if policy is not None:
            return policy
        raise RuntimeError("get_or_create_for_company failed after retries")

    def update(self, db: Session, *, data: dict[str, object], company_id: int | None = None):
        policy = self.get_or_create(db, company_id=company_id)
        for k, v in data.items():
            if hasattr(policy, k):
                setattr(policy, k, v)
        db.add(policy)
        db.flush()
        return policy

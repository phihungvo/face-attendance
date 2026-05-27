from __future__ import annotations

from datetime import date, datetime, time, timedelta

from sqlalchemy import Select, and_, select
from sqlalchemy.orm import Session

from app.models.attendance_history import AttendanceHistory
from app.models.attendance_evidence_setting import AttendanceEvidenceSetting
from app.models.user import User


class AttendanceHistoryRepository:
    def create(
        self,
        db: Session,
        *,
        company_id: int | None,
        employee_id: int,
        attendance_log_id: int | None,
        history_type: str,
        check_time: datetime,
        confidence_score: float,
        upload_status: str,
    ) -> AttendanceHistory:
        row = AttendanceHistory(
            company_id=company_id,
            employee_id=employee_id,
            attendance_log_id=attendance_log_id,
            type=history_type,
            check_time=check_time,
            confidence_score=confidence_score,
            upload_status=upload_status,
        )
        db.add(row)
        db.flush()
        return row

    def get(self, db: Session, history_id: int) -> AttendanceHistory | None:
        return db.get(AttendanceHistory, history_id)

    def get_by_log_id(self, db: Session, attendance_log_id: int) -> AttendanceHistory | None:
        stmt = select(AttendanceHistory).where(AttendanceHistory.attendance_log_id == attendance_log_id).limit(1)
        return db.execute(stmt).scalars().first()

    def list_with_user(
        self,
        db: Session,
        *,
        company_id: int | None,
        employee_id: int | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
        history_type: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[tuple[AttendanceHistory, str, str | None]]:
        stmt: Select = (
            select(AttendanceHistory, User.name, User.code)
            .join(User, User.id == AttendanceHistory.employee_id)
            .order_by(AttendanceHistory.check_time.desc(), AttendanceHistory.id.desc())
            .limit(limit)
            .offset(offset)
        )
        conditions = []
        if company_id is not None:
            conditions.append(AttendanceHistory.company_id == company_id)
        if employee_id is not None:
            conditions.append(AttendanceHistory.employee_id == employee_id)
        if from_date is not None:
            conditions.append(AttendanceHistory.check_time >= datetime.combine(from_date, time.min))
        if to_date is not None:
            conditions.append(AttendanceHistory.check_time < datetime.combine(to_date + timedelta(days=1), time.min))
        if history_type:
            conditions.append(AttendanceHistory.type == history_type)
        if conditions:
            stmt = stmt.where(and_(*conditions))
        return list(db.execute(stmt).all())

    def mark_uploaded(
        self,
        db: Session,
        *,
        history_id: int,
        image_url: str,
        image_size_kb: int,
        image_format: str,
    ) -> AttendanceHistory | None:
        history = db.get(AttendanceHistory, history_id)
        if history is None:
            return None
        history.image_url = image_url
        history.image_size_kb = image_size_kb
        history.image_format = image_format
        history.upload_status = "uploaded"
        db.add(history)
        db.flush()
        return history

    def mark_status(self, db: Session, *, history_id: int, upload_status: str) -> AttendanceHistory | None:
        history = db.get(AttendanceHistory, history_id)
        if history is None:
            return None
        history.upload_status = upload_status
        db.add(history)
        db.flush()
        return history

    def clear_image(self, db: Session, *, history_id: int, upload_status: str) -> AttendanceHistory | None:
        history = db.get(AttendanceHistory, history_id)
        if history is None:
            return None
        history.image_url = None
        history.upload_status = upload_status
        db.add(history)
        db.flush()
        return history

    def list_expired_with_settings(self, db: Session, *, today: date, limit: int = 200) -> list[tuple[AttendanceHistory, AttendanceEvidenceSetting]]:
        stmt = (
            select(AttendanceHistory, AttendanceEvidenceSetting)
            .join(AttendanceEvidenceSetting, AttendanceEvidenceSetting.company_id == AttendanceHistory.company_id)
            .where(
                AttendanceHistory.image_url.is_not(None),
                AttendanceHistory.upload_status == "uploaded",
                AttendanceEvidenceSetting.image_retention_days > 0,
            )
            .order_by(AttendanceHistory.check_time.asc(), AttendanceHistory.id.asc())
            .limit(limit)
        )
        out: list[tuple[AttendanceHistory, AttendanceEvidenceSetting]] = []
        for history, evidence_setting in db.execute(stmt).all():
            expires_on = history.check_time.date() + timedelta(days=int(evidence_setting.image_retention_days))
            if expires_on <= today:
                out.append((history, evidence_setting))
        return out


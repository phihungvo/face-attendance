from __future__ import annotations

from datetime import datetime

from sqlalchemy import Select, delete, select
from sqlalchemy.orm import Session

from app.models.attendance_log import AttendanceLog
from app.models.user import User


class AttendanceLogRepository:
    def create(
        self,
        db: Session,
        *,
        user_id: int,
        log_type: str,
        confidence: float,
        timestamp: datetime | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        distance_meters: float | None = None,
        geo_ok: bool = True,
    ) -> AttendanceLog:
        record = AttendanceLog(
            user_id=user_id,
            type=log_type,
            confidence=confidence,
            latitude=latitude,
            longitude=longitude,
            distance_meters=distance_meters,
            geo_ok=geo_ok,
        )
        if timestamp is not None:
            record.timestamp = timestamp
        db.add(record)
        db.flush()
        return record

    def list(self, db: Session, *, limit: int = 200, offset: int = 0) -> list[AttendanceLog]:
        stmt = select(AttendanceLog).order_by(AttendanceLog.timestamp.desc()).limit(limit).offset(offset)
        return list(db.execute(stmt).scalars().all())

    def list_with_user(self, db: Session, *, company_id: int | None = None, limit: int = 200, offset: int = 0) -> list[tuple[AttendanceLog, str]]:
        stmt: Select = (
            select(AttendanceLog, User.name)
            .join(User, User.id == AttendanceLog.user_id)
            .order_by(AttendanceLog.timestamp.desc())
            .limit(limit)
            .offset(offset)
        )
        if company_id is not None:
            stmt = stmt.where(User.company_id == company_id)
        return list(db.execute(stmt).all())

    def list_with_user_for_user(
        self,
        db: Session,
        *,
        company_id: int | None = None,
        user_id: int,
        limit: int = 200,
        offset: int = 0,
    ) -> list[tuple[AttendanceLog, str]]:
        stmt: Select = (
            select(AttendanceLog, User.name)
            .join(User, User.id == AttendanceLog.user_id)
            .where(AttendanceLog.user_id == user_id)
            .order_by(AttendanceLog.timestamp.desc())
            .limit(limit)
            .offset(offset)
        )
        if company_id is not None:
            stmt = stmt.where(User.company_id == company_id)
        return list(db.execute(stmt).all())

    def list_in_range(
        self,
        db: Session,
        *,
        start: datetime,
        end: datetime,
        user_id: int | None = None,
        company_id: int | None = None,
    ) -> list[AttendanceLog]:
        stmt = select(AttendanceLog).where(AttendanceLog.timestamp >= start, AttendanceLog.timestamp < end)
        if user_id is not None:
            stmt = stmt.where(AttendanceLog.user_id == user_id)
        if company_id is not None:
            stmt = stmt.join(User, User.id == AttendanceLog.user_id).where(User.company_id == company_id)
        stmt = stmt.order_by(AttendanceLog.timestamp.asc())
        return list(db.execute(stmt).scalars().all())

    def delete_in_range(
        self,
        db: Session,
        *,
        start: datetime,
        end: datetime,
        user_id: int | None = None,
    ) -> int:
        stmt = delete(AttendanceLog).where(AttendanceLog.timestamp >= start, AttendanceLog.timestamp < end)
        if user_id is not None:
            stmt = stmt.where(AttendanceLog.user_id == user_id)
        res = db.execute(stmt)
        return int(getattr(res, "rowcount", 0) or 0)

    def get_latest_for_user(self, db: Session, *, user_id: int) -> AttendanceLog | None:
        stmt = select(AttendanceLog).where(AttendanceLog.user_id == user_id).order_by(AttendanceLog.timestamp.desc()).limit(1)
        return db.execute(stmt).scalars().first()

    def get_latest_of_type_for_user(self, db: Session, *, user_id: int, log_type: str) -> AttendanceLog | None:
        stmt = (
            select(AttendanceLog)
            .where(AttendanceLog.user_id == user_id, AttendanceLog.type == log_type)
            .order_by(AttendanceLog.timestamp.desc())
            .limit(1)
        )
        return db.execute(stmt).scalars().first()

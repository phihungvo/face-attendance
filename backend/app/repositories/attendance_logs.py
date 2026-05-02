from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.attendance_log import AttendanceLog


class AttendanceLogRepository:
    def create(self, db: Session, *, user_id: int, log_type: str, confidence: float) -> AttendanceLog:
        record = AttendanceLog(user_id=user_id, type=log_type, confidence=confidence)
        db.add(record)
        db.flush()
        return record

    def list(self, db: Session, *, limit: int = 200, offset: int = 0) -> list[AttendanceLog]:
        stmt = select(AttendanceLog).order_by(AttendanceLog.timestamp.desc()).limit(limit).offset(offset)
        return list(db.execute(stmt).scalars().all())

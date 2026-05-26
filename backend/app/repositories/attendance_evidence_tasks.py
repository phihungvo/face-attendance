from __future__ import annotations

from datetime import datetime

from sqlalchemy import and_, select, update
from sqlalchemy.orm import Session

from app.models.attendance_evidence_task import AttendanceEvidenceTask


class AttendanceEvidenceTaskRepository:
    def create(
        self,
        db: Session,
        *,
        history_id: int,
        company_id: int | None,
        employee_id: int,
        spool_path: str,
        source_mime: str | None,
        max_attempts: int,
    ) -> AttendanceEvidenceTask:
        row = AttendanceEvidenceTask(
            history_id=history_id,
            company_id=company_id,
            employee_id=employee_id,
            spool_path=spool_path,
            source_mime=source_mime,
            status="pending",
            max_attempts=max_attempts,
        )
        db.add(row)
        db.flush()
        return row

    def get(self, db: Session, task_id: int) -> AttendanceEvidenceTask | None:
        return db.get(AttendanceEvidenceTask, task_id)

    def claim_next(self, db: Session, *, now: datetime) -> AttendanceEvidenceTask | None:
        candidate = db.execute(
            select(AttendanceEvidenceTask.id)
            .where(
                AttendanceEvidenceTask.status.in_(("pending", "retry")),
                AttendanceEvidenceTask.next_attempt_at <= now,
                AttendanceEvidenceTask.attempts < AttendanceEvidenceTask.max_attempts,
            )
            .order_by(AttendanceEvidenceTask.next_attempt_at.asc(), AttendanceEvidenceTask.id.asc())
            .limit(1)
        ).scalar_one_or_none()
        if candidate is None:
            return None

        res = db.execute(
            update(AttendanceEvidenceTask)
            .where(
                AttendanceEvidenceTask.id == candidate,
                AttendanceEvidenceTask.status.in_(("pending", "retry")),
            )
            .values(status="processing")
        )
        if int(getattr(res, "rowcount", 0) or 0) <= 0:
            db.rollback()
            return None
        db.flush()
        return db.get(AttendanceEvidenceTask, int(candidate))

    def mark_done(self, db: Session, *, task_id: int, attempts: int, completed_at: datetime) -> AttendanceEvidenceTask | None:
        row = db.get(AttendanceEvidenceTask, task_id)
        if row is None:
            return None
        row.status = "done"
        row.attempts = attempts
        row.completed_at = completed_at
        row.last_error = None
        db.add(row)
        db.flush()
        return row

    def mark_retry(
        self,
        db: Session,
        *,
        task_id: int,
        attempts: int,
        next_attempt_at: datetime,
        last_error: str,
    ) -> AttendanceEvidenceTask | None:
        row = db.get(AttendanceEvidenceTask, task_id)
        if row is None:
            return None
        row.status = "retry"
        row.attempts = attempts
        row.next_attempt_at = next_attempt_at
        row.last_error = last_error
        db.add(row)
        db.flush()
        return row

    def mark_failed(self, db: Session, *, task_id: int, attempts: int, last_error: str, completed_at: datetime) -> AttendanceEvidenceTask | None:
        row = db.get(AttendanceEvidenceTask, task_id)
        if row is None:
            return None
        row.status = "failed"
        row.attempts = attempts
        row.last_error = last_error
        row.completed_at = completed_at
        db.add(row)
        db.flush()
        return row

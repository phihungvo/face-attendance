from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.settings import settings
from app.models.attendance_policy import AttendancePolicy


class AttendancePolicyRepository:
    SINGLETON_ID = 1

    def get_or_create(self, db: Session) -> AttendancePolicy:
        policy = db.get(AttendancePolicy, self.SINGLETON_ID)
        if policy is not None:
            return policy

        policy = AttendancePolicy(
            id=self.SINGLETON_ID,
            timezone=getattr(settings, "ATTENDANCE_TIMEZONE", "Asia/Ho_Chi_Minh"),
            face_match_threshold=float(getattr(settings, "FACE_MATCH_THRESHOLD", 0.5)),
            shift_start=settings.SHIFT_START,
            shift_end=getattr(settings, "SHIFT_END", "18:00"),
            late_grace_minutes=int(settings.LATE_GRACE_MINUTES),
            early_leave_grace_minutes=int(getattr(settings, "EARLY_LEAVE_GRACE_MINUTES", 0)),
        )
        db.add(policy)
        db.flush()
        return policy

    def update(self, db: Session, *, data: dict[str, object]) -> AttendancePolicy:
        policy = self.get_or_create(db)
        for k, v in data.items():
            if hasattr(policy, k):
                setattr(policy, k, v)
        db.add(policy)
        db.flush()
        return policy

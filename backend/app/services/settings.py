from __future__ import annotations

from sqlalchemy.orm import Session

from app.repositories.attendance_policy import AttendancePolicyRepository


class SettingsService:
    def __init__(self) -> None:
        self._policy = AttendancePolicyRepository()

    def get_attendance_policy(self, db: Session):
        return self._policy.get_or_create(db)

    def update_attendance_policy(self, db: Session, *, data: dict[str, object]):
        policy = self._policy.update(db, data=data)
        db.commit()
        db.refresh(policy)
        return policy


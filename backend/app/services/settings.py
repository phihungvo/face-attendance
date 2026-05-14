from __future__ import annotations

from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.repositories.attendance_policy import AttendancePolicyRepository


class SettingsService:
    def __init__(self) -> None:
        self._policy = AttendancePolicyRepository()

    def get_attendance_policy(self, db: Session, *, company_id: int):
        return self._policy.get_or_create(db, company_id=company_id)

    def update_attendance_policy(self, db: Session, *, company_id: int, data: dict[str, object]):
        tz = str(data.get("timezone") or "").strip()
        if not tz:
            raise ValueError("timezone is required")
        try:
            ZoneInfo(tz)
        except Exception:
            raise ValueError("timezone không hợp lệ (IANA), ví dụ: Asia/Ho_Chi_Minh")

        try:
            th = float(data.get("face_match_threshold"))  # type: ignore[arg-type]
        except Exception:
            raise ValueError("face_match_threshold không hợp lệ")
        if th < 0.1 or th > 0.99:
            raise ValueError("face_match_threshold phải trong khoảng 0.1–0.99")

        policy = self._policy.update(db, data=data, company_id=company_id)
        db.commit()
        db.refresh(policy)
        return policy

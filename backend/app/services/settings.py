from __future__ import annotations

from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.models.app_setting import AppSetting
from app.services.attendance_evidence import AttendanceEvidenceService
from app.repositories.attendance_policy import AttendancePolicyRepository


class SettingsService:
    PUBLIC_REGISTRATION_KEY = "auth.public_registration_enabled"

    def __init__(self) -> None:
        self._policy = AttendancePolicyRepository()
        self._evidence = AttendanceEvidenceService()

    def _parse_bool(self, value: object, *, default: bool = False) -> bool:
        if isinstance(value, bool):
            return value
        if value is None:
            return default
        text = str(value).strip().lower()
        if text in {"1", "true", "yes", "on", "enabled"}:
            return True
        if text in {"0", "false", "no", "off", "disabled"}:
            return False
        return default

    def get_public_registration_enabled(self, db: Session) -> bool:
        row = db.get(AppSetting, self.PUBLIC_REGISTRATION_KEY)
        if row is None:
            return bool(settings.AUTH_PUBLIC_REGISTRATION_ENABLED)
        return self._parse_bool(row.setting_value, default=bool(settings.AUTH_PUBLIC_REGISTRATION_ENABLED))

    def get_auth_registration_settings(self, db: Session) -> dict[str, object]:
        enabled = self.get_public_registration_enabled(db)
        return {
            "public_registration_enabled": enabled,
            "account_onboarding_mode": "public_register" if enabled else "company_invite",
        }

    def update_auth_registration_settings(self, db: Session, *, public_registration_enabled: bool, actor_user_id: int) -> dict[str, object]:
        row = db.execute(select(AppSetting).where(AppSetting.setting_key == self.PUBLIC_REGISTRATION_KEY)).scalars().first()
        if row is None:
            row = AppSetting(setting_key=self.PUBLIC_REGISTRATION_KEY, setting_value="1" if public_registration_enabled else "0")
        else:
            row.setting_value = "1" if public_registration_enabled else "0"
        row.updated_by_user_id = int(actor_user_id)
        db.add(row)
        db.commit()
        return self.get_auth_registration_settings(db)

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

    def get_attendance_evidence_settings(self, db: Session, *, company_id: int):
        return self._evidence.get_settings(db, company_id=company_id)

    def update_attendance_evidence_settings(self, db: Session, *, company_id: int, data: dict[str, object]):
        return self._evidence.update_settings(db, company_id=company_id, data=data)

from __future__ import annotations

import time

from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.models.attendance_evidence_setting import AttendanceEvidenceSetting


class AttendanceEvidenceSettingsRepository:
    def get_or_create(self, db: Session, *, company_id: int) -> AttendanceEvidenceSetting:
        cid = int(company_id)
        for attempt in range(6):
            row = db.get(AttendanceEvidenceSetting, cid)
            if row is not None:
                return row

            values = {
                "company_id": cid,
                "enable_evidence_image": bool(settings.ATTENDANCE_EVIDENCE_DEFAULT_ENABLED),
                "image_quality": int(settings.ATTENDANCE_EVIDENCE_DEFAULT_QUALITY),
                "image_max_width": int(settings.ATTENDANCE_EVIDENCE_DEFAULT_MAX_WIDTH),
                "image_format": str(settings.ATTENDANCE_EVIDENCE_DEFAULT_FORMAT).strip().lower() or "webp",
                "image_retention_days": int(settings.ATTENDANCE_EVIDENCE_DEFAULT_RETENTION_DAYS),
            }
            stmt = mysql_insert(AttendanceEvidenceSetting).values(**values)
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

            row = db.get(AttendanceEvidenceSetting, cid)
            if row is not None:
                return row
            time.sleep(0.02)
        row = db.get(AttendanceEvidenceSetting, cid)
        if row is not None:
            return row
        raise RuntimeError("get_or_create attendance evidence settings failed after retries")

    def update(self, db: Session, *, company_id: int, data: dict[str, object]) -> AttendanceEvidenceSetting:
        row = self.get_or_create(db, company_id=company_id)
        for key, value in data.items():
            if hasattr(row, key):
                setattr(row, key, value)
        db.add(row)
        db.flush()
        return row


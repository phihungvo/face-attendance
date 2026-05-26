from __future__ import annotations

import tempfile
import unittest
from datetime import datetime
from io import BytesIO
from pathlib import Path

from PIL import Image
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.settings import settings
from app.models.attendance_evidence_setting import AttendanceEvidenceSetting
from app.models.attendance_evidence_task import AttendanceEvidenceTask
from app.models.attendance_history import AttendanceHistory
from app.models.attendance_log import AttendanceLog
from app.models.base import Base
from app.models.company import Company
from app.models.user import User
from app.services.attendance_evidence import AttendanceEvidenceService


class _FakeStorage:
    def __init__(self) -> None:
        self.uploads: list[tuple[str, bytes, str]] = []

    def ensure_bucket(self) -> None:
        return None

    def upload_bytes(self, *, object_key: str, data: bytes, content_type: str) -> None:
        self.uploads.append((object_key, data, content_type))

    def generate_presigned_get_url(self, *, object_key: str, expires_in: int) -> str:
        return f"https://example.test/{object_key}?exp={expires_in}"

    def delete_object(self, *, object_key: str) -> None:
        return None


class TestAttendanceEvidenceService(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(
            self.engine,
            tables=[
                Company.__table__,
                User.__table__,
                AttendanceLog.__table__,
                AttendanceHistory.__table__,
                AttendanceEvidenceTask.__table__,
            ],
        )
        self.SessionLocal = sessionmaker(bind=self.engine, class_=Session, expire_on_commit=False, future=True)
        self.tmpdir = tempfile.TemporaryDirectory()
        self.old_spool = settings.ATTENDANCE_EVIDENCE_SPOOL_DIR
        settings.ATTENDANCE_EVIDENCE_SPOOL_DIR = self.tmpdir.name

    def tearDown(self) -> None:
        settings.ATTENDANCE_EVIDENCE_SPOOL_DIR = self.old_spool
        self.tmpdir.cleanup()
        self.engine.dispose()

    def _make_image_bytes(self, *, size: tuple[int, int] = (1280, 960), fmt: str = "JPEG") -> bytes:
        image = Image.new("RGB", size, color=(24, 160, 88))
        buf = BytesIO()
        image.save(buf, format=fmt)
        return buf.getvalue()

    def _seed_user_and_log(self, db: Session) -> tuple[Company, User, AttendanceLog]:
        company = Company(code="c1", name="C1")
        db.add(company)
        db.flush()
        user = User(company_id=int(company.id), name="Nguyen Van A", code="NV001")
        db.add(user)
        db.flush()
        log = AttendanceLog(user_id=int(user.id), type="checkin", confidence=0.91, timestamp=datetime(2026, 5, 26, 8, 5, 0))
        db.add(log)
        db.commit()
        return company, user, log

    def test_record_success_disabled_keeps_history_without_task(self) -> None:
        with self.SessionLocal() as db:
            company, user, log = self._seed_user_and_log(db)
            service = AttendanceEvidenceService()
            service._settings.get_or_create = lambda *_args, **_kwargs: AttendanceEvidenceSetting(  # type: ignore[method-assign]
                company_id=int(company.id),
                enable_evidence_image=False,
                image_quality=65,
                image_max_width=720,
                image_format="webp",
                image_retention_days=30,
            )

            history = service.record_success(
                db,
                company_id=int(company.id),
                employee_id=int(user.id),
                attendance_log_id=int(log.id),
                history_type="checkin",
                check_time=log.timestamp,
                confidence_score=0.91,
                image_bytes=self._make_image_bytes(),
                source_mime="image/jpeg",
            )

            self.assertEqual(history.upload_status, "disabled")
            self.assertEqual(db.execute(select(AttendanceHistory)).scalars().all().__len__(), 1)
            self.assertEqual(db.execute(select(AttendanceEvidenceTask)).scalars().all().__len__(), 0)

    def test_process_task_uploads_best_frame_and_marks_history_uploaded(self) -> None:
        with self.SessionLocal() as db:
            company, user, log = self._seed_user_and_log(db)
            service = AttendanceEvidenceService()
            service._storage = _FakeStorage()
            service._settings.get_or_create = lambda *_args, **_kwargs: AttendanceEvidenceSetting(  # type: ignore[method-assign]
                company_id=int(company.id),
                enable_evidence_image=True,
                image_quality=65,
                image_max_width=720,
                image_format="webp",
                image_retention_days=30,
            )

            history = service.record_success(
                db,
                company_id=int(company.id),
                employee_id=int(user.id),
                attendance_log_id=int(log.id),
                history_type="checkin",
                check_time=log.timestamp,
                confidence_score=0.91,
                image_bytes=self._make_image_bytes(size=(1600, 1200)),
                source_mime="image/jpeg",
            )
            task = db.execute(select(AttendanceEvidenceTask)).scalars().first()
            self.assertIsNotNone(task)

            processed = service.process_task(db, task_id=int(task.id), now=datetime(2026, 5, 26, 8, 6, 0))
            self.assertTrue(processed)

            refreshed_history = db.get(AttendanceHistory, int(history.id))
            refreshed_task = db.get(AttendanceEvidenceTask, int(task.id))
            self.assertIsNotNone(refreshed_history)
            self.assertIsNotNone(refreshed_task)
            self.assertEqual(refreshed_history.upload_status, "uploaded")
            self.assertEqual(refreshed_history.image_format, "webp")
            self.assertTrue(str(refreshed_history.image_url).startswith("attendance/2026/05/employee_"))
            self.assertGreater(int(refreshed_history.image_size_kb or 0), 0)
            self.assertEqual(refreshed_task.status, "done")
            self.assertFalse(Path(str(task.spool_path)).exists())

            uploads = service._storage.uploads  # type: ignore[attr-defined]
            self.assertEqual(len(uploads), 1)
            object_key, data, content_type = uploads[0]
            self.assertEqual(object_key, refreshed_history.image_url)
            self.assertEqual(content_type, "image/webp")
            with Image.open(BytesIO(data)) as image:
                self.assertLessEqual(image.width, 720)


if __name__ == "__main__":
    unittest.main()

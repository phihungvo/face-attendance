from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps
from sqlalchemy.orm import Session

from app.clients.object_storage import ObjectStorageClient
from app.core.settings import settings
from app.models.attendance_evidence_setting import AttendanceEvidenceSetting
from app.models.attendance_evidence_task import AttendanceEvidenceTask
from app.models.attendance_history import AttendanceHistory
from app.repositories.attendance_evidence_settings import AttendanceEvidenceSettingsRepository
from app.repositories.attendance_evidence_tasks import AttendanceEvidenceTaskRepository
from app.repositories.attendance_history import AttendanceHistoryRepository

logger = logging.getLogger(__name__)


class AttendanceEvidenceService:
    def __init__(self, *, storage_client=None) -> None:
        self._history = AttendanceHistoryRepository()
        self._settings = AttendanceEvidenceSettingsRepository()
        self._tasks = AttendanceEvidenceTaskRepository()
        self._storage = storage_client

    @property
    def storage(self):
        if self._storage is None:
            self._storage = ObjectStorageClient()
        return self._storage

    def get_settings(self, db: Session, *, company_id: int) -> AttendanceEvidenceSetting:
        return self._settings.get_or_create(db, company_id=int(company_id))

    def update_settings(self, db: Session, *, company_id: int, data: dict[str, object]) -> AttendanceEvidenceSetting:
        payload = self._validated_settings_payload(data)
        row = self._settings.update(db, company_id=int(company_id), data=payload)
        db.commit()
        db.refresh(row)
        return row

    def record_success(
        self,
        db: Session,
        *,
        company_id: int | None,
        employee_id: int,
        attendance_log_id: int | None,
        history_type: str,
        check_time: datetime,
        confidence_score: float,
        image_bytes: bytes,
        source_mime: str | None,
    ) -> AttendanceHistory:
        evidence_enabled = False
        if company_id is not None:
            evidence_enabled = bool(self._settings.get_or_create(db, company_id=int(company_id)).enable_evidence_image)

        upload_status = "pending" if evidence_enabled and company_id is not None else "disabled"
        history = self._history.create(
            db,
            company_id=company_id,
            employee_id=int(employee_id),
            attendance_log_id=attendance_log_id,
            history_type=history_type,
            check_time=check_time,
            confidence_score=float(confidence_score),
            upload_status=upload_status,
        )
        db.commit()
        db.refresh(history)

        if upload_status != "pending":
            return history

        try:
            spool_path = self._write_spool_file(history=history, image_bytes=image_bytes, source_mime=source_mime)
            self._tasks.create(
                db,
                history_id=int(history.id),
                company_id=company_id,
                employee_id=int(employee_id),
                spool_path=spool_path,
                source_mime=source_mime,
                max_attempts=int(settings.ATTENDANCE_EVIDENCE_MAX_RETRIES),
            )
            db.commit()
        except Exception as exc:
            logger.exception("Failed to enqueue attendance evidence upload for history_id=%s", getattr(history, "id", None))
            db.rollback()
            self._history.mark_status(db, history_id=int(history.id), upload_status="failed")
            db.commit()
            db.refresh(history)
        return history

    def list_history(
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
    ) -> list[AttendanceHistory]:
        out: list[AttendanceHistory] = []
        for history, user_name, user_code in self._history.list_with_user(
            db,
            company_id=company_id,
            employee_id=employee_id,
            from_date=from_date,
            to_date=to_date,
            history_type=history_type,
            limit=limit,
            offset=offset,
        ):
            setattr(history, "employee_name", user_name)
            setattr(history, "employee_code", user_code)
            out.append(history)
        return out

    def get_history(self, db: Session, *, history_id: int) -> AttendanceHistory | None:
        return self._history.get(db, history_id)

    def generate_presigned_evidence_url(self, db: Session, *, history_id: int, expires_in: int | None = None) -> str:
        history = self._history.get(db, history_id)
        if history is None:
            raise ValueError("Không tìm thấy lịch sử chấm công")
        if history.upload_status != "uploaded" or not history.image_url:
            raise ValueError("Ảnh bằng chứng chưa sẵn sàng")
        self.storage.ensure_bucket()
        return self.storage.generate_presigned_get_url(
            object_key=str(history.image_url),
            expires_in=int(expires_in or settings.ATTENDANCE_EVIDENCE_PRESIGNED_EXPIRE_SECONDS),
        )

    def claim_next_task(self, db: Session, *, now: datetime) -> AttendanceEvidenceTask | None:
        task = self._tasks.claim_next(db, now=now)
        if task is not None:
            db.commit()
        return task

    def process_task(self, db: Session, *, task_id: int, now: datetime | None = None) -> bool:
        when = now or datetime.utcnow()
        task = self._tasks.get(db, task_id)
        if task is None:
            return False
        attempt_number = int(task.attempts) + 1
        try:
            history = self._history.get(db, int(task.history_id))
            if history is None:
                self._tasks.mark_done(db, task_id=int(task.id), attempts=attempt_number, completed_at=when)
                db.commit()
                self._delete_spool_file(task.spool_path)
                return True

            if task.company_id is None:
                self._history.mark_status(db, history_id=int(history.id), upload_status="disabled")
                self._tasks.mark_done(db, task_id=int(task.id), attempts=attempt_number, completed_at=when)
                db.commit()
                self._delete_spool_file(task.spool_path)
                return True

            evidence_setting = self._settings.get_or_create(db, company_id=int(task.company_id))
            if not bool(evidence_setting.enable_evidence_image):
                self._history.mark_status(db, history_id=int(history.id), upload_status="disabled")
                self._tasks.mark_done(db, task_id=int(task.id), attempts=attempt_number, completed_at=when)
                db.commit()
                self._delete_spool_file(task.spool_path)
                return True

            raw = Path(task.spool_path).read_bytes()
            image_bytes, image_format, content_type = self._transform_image(raw=raw, evidence_setting=evidence_setting)
            object_key = self._build_object_key(history=history, image_format=image_format)
            self.storage.ensure_bucket()
            self.storage.upload_bytes(object_key=object_key, data=image_bytes, content_type=content_type)
            image_size_kb = max(1, int(round(len(image_bytes) / 1024.0)))

            self._history.mark_uploaded(
                db,
                history_id=int(history.id),
                image_url=object_key,
                image_size_kb=image_size_kb,
                image_format=image_format,
            )
            self._tasks.mark_done(db, task_id=int(task.id), attempts=attempt_number, completed_at=when)
            db.commit()
            self._delete_spool_file(task.spool_path)
            return True
        except Exception as exc:
            logger.exception("Attendance evidence upload failed for task_id=%s", task_id)
            db.rollback()
            error_text = str(exc)[:2000] or "upload failed"
            if attempt_number >= int(task.max_attempts):
                self._history.mark_status(db, history_id=int(task.history_id), upload_status="failed")
                self._tasks.mark_failed(
                    db,
                    task_id=int(task.id),
                    attempts=attempt_number,
                    last_error=error_text,
                    completed_at=when,
                )
                db.commit()
                self._delete_spool_file(task.spool_path)
            else:
                backoff_seconds = int(settings.ATTENDANCE_EVIDENCE_BACKOFF_BASE_SECONDS) * (2 ** (attempt_number - 1))
                next_attempt_at = when + timedelta(seconds=backoff_seconds)
                self._history.mark_status(db, history_id=int(task.history_id), upload_status="retry")
                self._tasks.mark_retry(
                    db,
                    task_id=int(task.id),
                    attempts=attempt_number,
                    next_attempt_at=next_attempt_at,
                    last_error=error_text,
                )
                db.commit()
            return False

    def cleanup_expired_images(self, db: Session, *, today: date | None = None, limit: int = 200) -> int:
        current_day = today or datetime.utcnow().date()
        rows = self._history.list_expired_with_settings(db, today=current_day, limit=limit)
        if not rows:
            return 0

        deleted = 0
        self.storage.ensure_bucket()
        for history, _evidence_setting in rows:
            try:
                if history.image_url:
                    self.storage.delete_object(object_key=str(history.image_url))
                self._history.clear_image(db, history_id=int(history.id), upload_status="deleted")
                db.commit()
                deleted += 1
            except Exception:
                db.rollback()
                logger.exception("Failed to cleanup attendance evidence history_id=%s", getattr(history, "id", None))
        return deleted

    def _validated_settings_payload(self, data: dict[str, object]) -> dict[str, object]:
        image_format = self._normalize_format(data.get("image_format"))
        try:
            quality = int(data.get("image_quality"))
        except Exception as exc:
            raise ValueError("image_quality không hợp lệ") from exc
        try:
            max_width = int(data.get("image_max_width"))
        except Exception as exc:
            raise ValueError("image_max_width không hợp lệ") from exc
        try:
            retention = int(data.get("image_retention_days"))
        except Exception as exc:
            raise ValueError("image_retention_days không hợp lệ") from exc

        if quality < 30 or quality > 95:
            raise ValueError("image_quality phải trong khoảng 30-95")
        if max_width < 240 or max_width > 4096:
            raise ValueError("image_max_width phải trong khoảng 240-4096")
        if retention < 1 or retention > 3650:
            raise ValueError("image_retention_days phải trong khoảng 1-3650")

        return {
            "enable_evidence_image": bool(data.get("enable_evidence_image")),
            "image_quality": quality,
            "image_max_width": max_width,
            "image_format": image_format,
            "image_retention_days": retention,
        }

    def _normalize_format(self, value: object) -> str:
        fmt = str(value or "").strip().lower()
        if fmt == "jpg":
            fmt = "jpeg"
        if fmt not in {"jpeg", "webp"}:
            raise ValueError("image_format chỉ hỗ trợ webp hoặc jpeg")
        return fmt

    def _write_spool_file(self, *, history: AttendanceHistory, image_bytes: bytes, source_mime: str | None) -> str:
        root = Path(settings.ATTENDANCE_EVIDENCE_SPOOL_DIR)
        ext = self._source_extension(source_mime)
        rel = Path(
            str(history.check_time.year),
            f"{history.check_time.month:02d}",
            f"employee_{int(history.employee_id)}",
            f"history_{int(history.id)}_{history.type}.{ext}",
        )
        target = root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = target.with_suffix(target.suffix + ".tmp")
        tmp_path.write_bytes(image_bytes)
        os.replace(tmp_path, target)
        return str(target)

    def _delete_spool_file(self, spool_path: str) -> None:
        try:
            path = Path(spool_path)
            if path.exists():
                path.unlink()
        except Exception:
            logger.warning("Failed to delete spool file %s", spool_path)

    def _source_extension(self, source_mime: str | None) -> str:
        mime = str(source_mime or "").lower()
        if "png" in mime:
            return "png"
        if "webp" in mime:
            return "webp"
        return "jpg"

    def _build_object_key(self, *, history: AttendanceHistory, image_format: str) -> str:
        ts = history.check_time.strftime("%Y%m%dT%H%M%S")
        return (
            f"{history.check_time.year}/{history.check_time.month:02d}/"
            f"employee_{int(history.employee_id)}/{history.type}_{ts}_{int(history.id)}.{image_format}"
        )

    def _transform_image(
        self,
        *,
        raw: bytes,
        evidence_setting: AttendanceEvidenceSetting,
    ) -> tuple[bytes, str, str]:
        image_format = self._normalize_format(evidence_setting.image_format)
        quality = int(evidence_setting.image_quality)
        max_width = int(evidence_setting.image_max_width)

        with Image.open(BytesIO(raw)) as image:
            image = ImageOps.exif_transpose(image)
            if image.width > max_width:
                new_height = max(1, int(round(image.height * (max_width / float(image.width)))))
                image = image.resize((max_width, new_height), Image.Resampling.LANCZOS)

            if image_format == "jpeg":
                if image.mode in ("RGBA", "LA"):
                    flattened = Image.new("RGB", image.size, color=(255, 255, 255))
                    flattened.paste(image, mask=image.getchannel("A"))
                    image = flattened
                elif image.mode != "RGB":
                    image = image.convert("RGB")
            else:
                if image.mode not in ("RGB", "RGBA"):
                    image = image.convert("RGB")

            buf = BytesIO()
            if image_format == "webp":
                image.save(buf, format="WEBP", quality=quality, method=6)
                content_type = "image/webp"
            else:
                image.save(buf, format="JPEG", quality=quality, optimize=True)
                content_type = "image/jpeg"
            return buf.getvalue(), image_format, content_type

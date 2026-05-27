from __future__ import annotations

import argparse
import logging
import time
from datetime import datetime, timedelta

import app.models  # noqa: F401
from app.core.settings import settings
from app.db.migrate import run_lightweight_migrations
from app.db.session import SessionLocal, engine
from app.models.base import Base
from app.services.attendance_evidence import AttendanceEvidenceService

logger = logging.getLogger(__name__)


def _bootstrap_schema() -> None:
    Base.metadata.create_all(bind=engine)
    run_lightweight_migrations(engine, schema=engine.url.database or "")


def run_cleanup_once(service: AttendanceEvidenceService) -> int:
    db = SessionLocal()
    try:
        deleted = service.cleanup_expired_images(db, today=datetime.utcnow().date())
        return int(deleted)
    finally:
        db.close()


def run_worker(*, once: bool = False) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    _bootstrap_schema()
    service = AttendanceEvidenceService()
    cleanup_interval = max(60, int(settings.ATTENDANCE_EVIDENCE_CLEANUP_INTERVAL_SECONDS))
    poll_seconds = float(settings.ATTENDANCE_EVIDENCE_WORKER_POLL_SECONDS)
    next_cleanup_at = datetime.utcnow()

    while True:
        now = datetime.utcnow()
        if now >= next_cleanup_at:
            try:
                deleted = run_cleanup_once(service)
                if deleted:
                    logger.info("Attendance evidence cleanup removed %s objects", deleted)
            except Exception:
                logger.exception("Attendance evidence cleanup failed")
            next_cleanup_at = now + timedelta(seconds=cleanup_interval)

        db = SessionLocal()
        task_id: int | None = None
        try:
            task = service.claim_next_task(db, now=now)
            if task is not None:
                task_id = int(task.id)
        finally:
            db.close()

        if task_id is None:
            if once:
                return 0
            time.sleep(poll_seconds)
            continue

        db = SessionLocal()
        try:
            service.process_task(db, task_id=task_id, now=datetime.utcnow())
        finally:
            db.close()

        if once:
            return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Attendance evidence queue worker")
    parser.add_argument("--once", action="store_true", help="Process at most one task and exit")
    args = parser.parse_args()
    return run_worker(once=bool(args.once))


if __name__ == "__main__":
    raise SystemExit(main())

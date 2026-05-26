from __future__ import annotations

import logging

import app.models  # noqa: F401
from app.db.migrate import run_lightweight_migrations
from app.db.session import SessionLocal, engine
from app.models.base import Base
from app.services.attendance_evidence import AttendanceEvidenceService

logger = logging.getLogger(__name__)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    Base.metadata.create_all(bind=engine)
    run_lightweight_migrations(engine, schema=engine.url.database or "")

    db = SessionLocal()
    try:
        deleted = AttendanceEvidenceService().cleanup_expired_images(db)
        logger.info("Attendance evidence cleanup removed %s expired objects", deleted)
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import time
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.exception_handlers import register_exception_handlers
from app.core.security import validate_runtime_security
from app.core.settings import settings
from app.db.session import engine
from app.db.migrate import run_lightweight_migrations
from app.db.seed import seed_rbac
from app.models.base import Base
import app.models  # noqa: F401  # ensure models are registered
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(title=settings.APP_NAME, version="1.0.0")

    register_exception_handlers(app)

    allow_origins = settings.cors_allow_origins_list
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Company-Id"],
    )

    @app.middleware("http")
    async def _security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        if request.url.path.startswith("/api/v1/auth/"):
            response.headers.setdefault("Cache-Control", "no-store")
        if request.headers.get("x-forwarded-proto", "").strip().lower() == "https":
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response

    @app.on_event("startup")
    def _startup() -> None:
        validate_runtime_security()
        # Basic production-friendly default: create tables if not exist.
        # For real deployments, prefer Alembic migrations.
        if settings.DB_STARTUP_FAIL_FAST:
            Base.metadata.create_all(bind=engine)
            run_lightweight_migrations(engine, schema=settings.MYSQL_DB)
            db = SessionLocal()
            try:
                seed_rbac(db)
                db.commit()
            finally:
                db.close()
            return

        last_err: Exception | None = None
        for attempt in range(1, settings.DB_STARTUP_RETRIES + 1):
            try:
                Base.metadata.create_all(bind=engine)
                # Best-effort lightweight migrations for dev/local upgrades.
                run_lightweight_migrations(engine, schema=settings.MYSQL_DB)
                # Seed RBAC defaults if needed.
                db = SessionLocal()
                try:
                    seed_rbac(db)
                    db.commit()
                finally:
                    db.close()
                return
            except Exception as e:  # pragma: no cover
                last_err = e
                if attempt == 1 or attempt == settings.DB_STARTUP_RETRIES:
                    logger.warning(
                        "DB init failed (attempt %s/%s): %s",
                        attempt,
                        settings.DB_STARTUP_RETRIES,
                        repr(e),
                    )
                time.sleep(settings.DB_STARTUP_RETRY_SLEEP_SECONDS)
        if last_err is not None:
            raise last_err

    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()

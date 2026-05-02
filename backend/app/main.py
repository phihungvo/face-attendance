from __future__ import annotations

import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.exception_handlers import register_exception_handlers
from app.core.settings import settings
from app.db.session import engine
from app.models.base import Base
import app.models  # noqa: F401  # ensure models are registered


def create_app() -> FastAPI:
    app = FastAPI(title=settings.APP_NAME, version="1.0.0")

    register_exception_handlers(app)

    # Basic CORS for local/prod behind same origin (nginx proxies /api).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def _startup() -> None:
        # Basic production-friendly default: create tables if not exist.
        # For real deployments, prefer Alembic migrations.
        last_err: Exception | None = None
        for _ in range(30):
            try:
                Base.metadata.create_all(bind=engine)
                return
            except Exception as e:  # pragma: no cover
                last_err = e
                time.sleep(2)
        if last_err is not None:
            raise last_err

    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()

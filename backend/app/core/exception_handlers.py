from __future__ import annotations

import logging
from collections.abc import Callable

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.errors import (
    BAD_REQUEST,
    DB_ERROR,
    UNAUTHORIZED,
    UNCATEGORIZED_EXCEPTION,
    VALIDATION_FAILED,
    AppException,
)
from app.core.response import fail

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def _app_exception_handler(_: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.error.http_status,
            content=fail(exc.error, message=exc.detail).model_dump(),
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        # Trả errors dạng {field: message} để frontend hiển thị dễ.
        errors: dict[str, str] = {}
        for err in exc.errors():
            loc = err.get("loc", [])
            field = ".".join([str(x) for x in loc if isinstance(x, (str, int)) and x != "body"]) or "body"
            msg = str(err.get("msg") or "Không hợp lệ")
            errors[field] = msg

        return JSONResponse(
            status_code=VALIDATION_FAILED.http_status,
            content=fail(VALIDATION_FAILED, result={"errors": errors}).model_dump(),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        # FastAPI dùng HTTPException cho nhiều trường hợp; map status -> message VN.
        if exc.status_code == 401:
            err = UNAUTHORIZED
        elif exc.status_code == 400:
            err = BAD_REQUEST
        else:
            err = BAD_REQUEST
        detail = str(exc.detail) if exc.detail else err.message
        return JSONResponse(status_code=exc.status_code, content=fail(err, message=detail).model_dump())

    @app.exception_handler(SQLAlchemyError)
    async def _db_handler(_: Request, exc: SQLAlchemyError) -> JSONResponse:
        logger.exception("DB error: %s", exc)
        return JSONResponse(status_code=DB_ERROR.http_status, content=fail(DB_ERROR).model_dump())

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error: %s", exc)
        return JSONResponse(
            status_code=UNCATEGORIZED_EXCEPTION.http_status,
            content=fail(UNCATEGORIZED_EXCEPTION).model_dump(),
        )

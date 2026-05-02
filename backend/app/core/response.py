from __future__ import annotations

from typing import TypeVar

from app.core.errors import OK, ErrorCode
from app.schemas.common import ApiResponse

T = TypeVar("T")


def ok(result: T | None = None, *, message: str | None = None) -> ApiResponse[T]:
    return ApiResponse(code=OK.code, message=message or OK.message, result=result)


def fail(error: ErrorCode, *, message: str | None = None, result: object | None = None) -> ApiResponse[object]:
    return ApiResponse(code=error.code, message=message or error.message, result=result)

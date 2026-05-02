from __future__ import annotations

from pydantic import BaseModel


class ApiResponse(BaseModel):
    code: int
    message: str
    result: dict | None = None


class EmbeddingResult(BaseModel):
    embedding: list[float]


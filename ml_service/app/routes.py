from __future__ import annotations

import logging

from fastapi import APIRouter, File, UploadFile

from app.face_engine import FaceEngine
from app.schemas import ApiResponse

router = APIRouter()
engine = FaceEngine()
logger = logging.getLogger(__name__)


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.post("/v1/embedding", response_model=ApiResponse)
async def embedding(image: UploadFile = File(...)) -> ApiResponse:
    try:
        data = await image.read()
        emb = engine.extract_embedding(image_bytes=data)
        return ApiResponse(code=1000, message="Thành công", result={"embedding": engine.embedding_to_list(emb)})
    except ValueError as e:
        return ApiResponse(code=1100, message=str(e), result=None)
    except Exception as e:
        logger.exception("ML embedding error: %s", e)
        return ApiResponse(code=9999, message="Lỗi ML service, vui lòng thử lại sau", result=None)

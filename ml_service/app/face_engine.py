from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import numpy as np
from PIL import Image
from PIL import UnidentifiedImageError


@dataclass(frozen=True)
class FaceMatch:
    user_id: int
    confidence: float


class FaceEngine:
    """
    InsightFace wrapper:
    - load model (buffalo_l)
    - detect & extract a 512-d embedding
    """

    def __init__(self) -> None:
        self._app: Any | None = None

    def _get_app(self) -> Any:
        if self._app is not None:
            return self._app
        from insightface.app import FaceAnalysis  # type: ignore

        app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        app.prepare(ctx_id=0, det_size=(640, 640))
        self._app = app
        return app

    def extract_embedding(self, *, image_bytes: bytes) -> np.ndarray:
        try:
            img = Image.open(io_bytes_to_filelike(image_bytes)).convert("RGB")
        except (UnidentifiedImageError, OSError) as e:
            raise ValueError("Ảnh không hợp lệ hoặc bị lỗi khi đọc ảnh") from e
        if img.width < 64 or img.height < 64:
            raise ValueError("Ảnh quá nhỏ, vui lòng dùng ảnh rõ mặt (>= 64x64)")
        img_np = np.array(img)[:, :, ::-1]  # RGB -> BGR

        app = self._get_app()
        faces = app.get(img_np)
        if not faces:
            raise ValueError("Không phát hiện khuôn mặt trong ảnh")

        def area(face: Any) -> float:
            x1, y1, x2, y2 = face.bbox
            return float(max(0.0, x2 - x1) * max(0.0, y2 - y1))

        best_face = max(faces, key=area)
        emb = np.asarray(best_face.embedding, dtype=np.float32)
        if emb.shape[0] != 512:
            raise ValueError("Embedding không hợp lệ (sai kích thước)")
        return emb

    @staticmethod
    def embedding_to_list(embedding: np.ndarray) -> list[float]:
        return embedding.astype(float).tolist()

    @staticmethod
    def embedding_to_json(embedding: np.ndarray) -> str:
        return json.dumps(embedding.astype(float).tolist(), ensure_ascii=False)


def io_bytes_to_filelike(data: bytes):
    import io

    return io.BytesIO(data)

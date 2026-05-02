from __future__ import annotations

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from app.core.settings import settings

if TYPE_CHECKING:  # pragma: no cover
    import numpy as np


@dataclass(frozen=True)
class FaceMatch:
    user_id: int
    confidence: float


class FaceEngine:
    """
    InsightFace wrapper:
    - load model (buffalo_l)
    - detect & extract a 512-d embedding
    - cosine similarity matching
    """

    def __init__(self) -> None:
        self._app: Any | None = None

    def _get_app(self) -> Any:
        if self._app is not None:
            return self._app

        # Lazy import to speed up startup and keep routes clean.
        try:
            from insightface.app import FaceAnalysis  # type: ignore
        except ModuleNotFoundError as e:  # pragma: no cover
            from app.core.errors import ML_NOT_READY, AppException

            raise AppException(
                ML_NOT_READY,
                detail=(
                    "Server chưa cài đủ thư viện nhận diện khuôn mặt (insightface/onnxruntime). "
                    "Vui lòng chạy bằng Docker hoặc cài full dependencies."
                ),
            ) from e

        app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        # det_size can be tuned; keep default-friendly.
        app.prepare(ctx_id=0, det_size=(640, 640))
        self._app = app
        return app

    def extract_embedding(self, *, image_bytes: bytes) -> "np.ndarray":
        # Local imports so non-ML endpoints can run without these deps installed.
        try:
            import numpy as np
            from PIL import Image
        except ModuleNotFoundError as e:  # pragma: no cover
            from app.core.errors import ML_NOT_READY, AppException

            raise AppException(
                ML_NOT_READY,
                detail=(
                    "Server chưa cài đủ thư viện xử lý ảnh (numpy/Pillow). "
                    "Vui lòng chạy bằng Docker hoặc cài full dependencies."
                ),
            ) from e

        img = Image.open(io_bytes_to_filelike(image_bytes)).convert("RGB")
        img_np = np.array(img)[:, :, ::-1]  # RGB -> BGR (insightface expects BGR)

        app = self._get_app()
        faces = app.get(img_np)
        if not faces:
            raise ValueError("No face detected")

        # Pick the biggest face (by bbox area).
        def area(face: Any) -> float:
            x1, y1, x2, y2 = face.bbox
            return float(max(0.0, x2 - x1) * max(0.0, y2 - y1))

        best_face = max(faces, key=area)
        emb = np.asarray(best_face.embedding, dtype=np.float32)
        if emb.shape[0] != 512:
            raise ValueError("Unexpected embedding shape")
        return emb

    def match_best(
        self,
        *,
        probe_embedding: "np.ndarray",
        candidates: list[tuple[int, "np.ndarray"]],
        threshold: float | None = None,
    ) -> FaceMatch | None:
        import numpy as np

        if not candidates:
            return None
        th = settings.FACE_MATCH_THRESHOLD if threshold is None else threshold

        probe = normalize(probe_embedding)
        best_user_id = -1
        best_sim = -1.0
        for user_id, emb in candidates:
            sim = cosine_similarity(probe, normalize(emb))
            if sim > best_sim:
                best_sim = sim
                best_user_id = user_id
        if best_sim < th:
            return None
        return FaceMatch(user_id=best_user_id, confidence=float(best_sim))

    @staticmethod
    def embedding_to_json(embedding: "np.ndarray") -> str:
        return json.dumps(embedding.astype(float).tolist(), ensure_ascii=False)

    @staticmethod
    def embedding_from_json(embedding_json: str) -> np.ndarray:
        import numpy as np

        data = json.loads(embedding_json)
        return np.asarray(data, dtype=np.float32)


def cosine_similarity(a: "np.ndarray", b: "np.ndarray") -> float:
    import numpy as np

    return float(np.dot(a, b))


def normalize(v: "np.ndarray") -> "np.ndarray":
    import numpy as np

    denom = float(np.linalg.norm(v) + 1e-12)
    return v / denom


def io_bytes_to_filelike(data: bytes):
    import io

    return io.BytesIO(data)

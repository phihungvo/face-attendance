from __future__ import annotations

import httpx

from app.core.errors import ML_INVALID_INPUT, ML_NOT_READY, AppException
from app.core.settings import settings


class MlClient:
    def __init__(self) -> None:
        self._timeout = settings.ML_SERVICE_TIMEOUT_SECONDS
        self._base = settings.ML_SERVICE_URL.rstrip("/")

    def extract_embedding(self, *, image_bytes: bytes) -> list[float]:
        url = f"{self._base}/v1/embedding"
        files = {"image": ("image.jpg", image_bytes, "application/octet-stream")}
        try:
            with httpx.Client(timeout=self._timeout) as client:
                resp = client.post(url, files=files)
        except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout) as e:
            raise AppException(
                ML_NOT_READY,
                detail="Không thể kết nối ML service (server bận hoặc chưa sẵn sàng)",
            ) from e

        # ML service trả {code,message,result:{embedding}}
        try:
            data = resp.json()
        except Exception as e:  # pragma: no cover
            raise AppException(ML_NOT_READY, detail="ML service trả dữ liệu không hợp lệ") from e

        code = int(data.get("code", 9999))
        if code != 1000:
            msg = str(data.get("message") or ML_NOT_READY.message)
            if code == 1100:
                raise AppException(ML_INVALID_INPUT, detail=msg)
            raise AppException(ML_NOT_READY, detail=msg)

        result = data.get("result") or {}
        embedding = result.get("embedding")
        if not isinstance(embedding, list) or len(embedding) != 512:
            raise AppException(ML_NOT_READY, detail="ML service trả embedding không hợp lệ")
        return [float(x) for x in embedding]

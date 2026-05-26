from __future__ import annotations

from io import BytesIO

from fastapi import UploadFile
from PIL import Image


ALLOWED_IMAGE_MIME_TYPES = {"image/png", "image/jpeg", "image/webp"}
ALLOWED_AUDIO_MIME_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/ogg",
    "audio/mp4",
    "audio/aac",
    "audio/webm",
}


async def read_validated_image_upload(
    upload: UploadFile,
    *,
    max_bytes: int,
    field_label: str,
    allowed_types: set[str] | None = None,
) -> tuple[bytes, str]:
    allowed = allowed_types or ALLOWED_IMAGE_MIME_TYPES
    normalized_type = (upload.content_type or "").split(";", 1)[0].strip().lower()
    if normalized_type == "image/jpg":
        normalized_type = "image/jpeg"
    if normalized_type not in allowed:
        raise ValueError(f"{field_label} chỉ hỗ trợ PNG, JPG/JPEG hoặc WEBP")

    payload = await upload.read(int(max_bytes) + 1)
    if not payload:
        raise ValueError(f"{field_label} không được để trống")
    if len(payload) > int(max_bytes):
        raise ValueError(f"{field_label} vượt quá dung lượng cho phép")

    try:
        Image.open(BytesIO(payload)).verify()
    except Exception as exc:
        raise ValueError(f"{field_label} không phải ảnh hợp lệ") from exc

    return payload, normalized_type


async def read_validated_audio_upload(
    upload: UploadFile,
    *,
    max_bytes: int,
    field_label: str,
    allowed_types: set[str] | None = None,
) -> tuple[bytes, str]:
    allowed = allowed_types or ALLOWED_AUDIO_MIME_TYPES
    normalized_type = (upload.content_type or "").split(";", 1)[0].strip().lower()
    if normalized_type not in allowed:
        raise ValueError(f"{field_label} chỉ hỗ trợ MP3, WAV, OGG, AAC, M4A hoặc WEBM")

    payload = await upload.read(int(max_bytes) + 1)
    if not payload:
        raise ValueError(f"{field_label} không được để trống")
    if len(payload) > int(max_bytes):
        raise ValueError(f"{field_label} vượt quá dung lượng cho phép")

    return payload, normalized_type

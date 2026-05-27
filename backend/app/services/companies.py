from __future__ import annotations

from urllib.parse import urlparse

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.sentinels import UNSET
from app.repositories.companies import CompanyRepository

ALLOWED_COMPANY_LOGO_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_COMPANY_LOGO_BYTES = 2 * 1024 * 1024
ALLOWED_ATTENDANCE_SOUND_TYPES = {
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
MAX_COMPANY_SOUND_BYTES = 2 * 1024 * 1024
MAX_ATTENDANCE_SOUND_TEXT_CHARS = 1000
ATTENDANCE_SOUND_SOURCES = {"default", "sample", "upload", "url", "tts"}
ATTENDANCE_SOUND_SAMPLE_IDS = {"soft-chime", "double-ding", "digital-pop", "warm-bell", "alert-buzz"}


class CompanyService:
    def __init__(self) -> None:
        self._companies = CompanyRepository()

    def list_companies(self, db: Session, *, limit: int = 200, offset: int = 0, q: str | None = None):
        return self._companies.list(db, limit=limit, offset=offset, q=q)

    def get_company(self, db: Session, *, company_id: int):
        c = self._companies.get(db, company_id)
        if c is None:
            raise ValueError("Company not found")
        return c

    def create_company(
        self,
        db: Session,
        *,
        code: str,
        name: str,
        status: str | None = None,
        address: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        geo_radius_meters: float | None = None,
        require_gps_on_attendance: bool = False,
    ):
        code = code.strip()
        name = name.strip()
        if not code:
            raise ValueError("code is required")
        if not name:
            raise ValueError("name is required")
        if (latitude is None) ^ (longitude is None):
            raise ValueError("latitude/longitude phải đi cùng nhau")
        if latitude is not None and (latitude < -90 or latitude > 90):
            raise ValueError("latitude không hợp lệ (phải trong -90..90)")
        if longitude is not None and (longitude < -180 or longitude > 180):
            raise ValueError("longitude không hợp lệ (phải trong -180..180)")
        if geo_radius_meters is not None and float(geo_radius_meters) < 0:
            raise ValueError("geo_radius_meters không hợp lệ (phải >= 0)")
        try:
            c = self._companies.create(
                db,
                code=code,
                name=name,
                status=status,
                address=address.strip() if address else None,
                latitude=latitude,
                longitude=longitude,
                geo_radius_meters=geo_radius_meters,
                require_gps_on_attendance=bool(require_gps_on_attendance),
            )
            db.commit()
            db.refresh(c)
            return c
        except IntegrityError:
            db.rollback()
            raise ValueError("Duplicate company code")

    def update_company(
        self,
        db: Session,
        *,
        company_id: int,
        code: str | None | object = UNSET,
        name: str | None | object = UNSET,
        status: str | None | object = UNSET,
        address: str | None | object = UNSET,
        latitude: float | None | object = UNSET,
        longitude: float | None | object = UNSET,
        geo_radius_meters: float | None | object = UNSET,
        require_gps_on_attendance: bool | None | object = UNSET,
        attendance_success_sound_source: str | None | object = UNSET,
        attendance_success_sound_sample_id: str | None | object = UNSET,
        attendance_success_sound_url: str | None | object = UNSET,
        attendance_success_sound_text: str | None | object = UNSET,
        attendance_failure_sound_source: str | None | object = UNSET,
        attendance_failure_sound_sample_id: str | None | object = UNSET,
        attendance_failure_sound_url: str | None | object = UNSET,
        attendance_failure_sound_text: str | None | object = UNSET,
    ):
        lat_provided = latitude is not UNSET
        lng_provided = longitude is not UNSET
        if lat_provided or lng_provided:
            lat_v = None if latitude is UNSET else latitude
            lng_v = None if longitude is UNSET else longitude
            if (lat_v is None) ^ (lng_v is None):
                raise ValueError("latitude/longitude phải đi cùng nhau")
            if lat_v is not None and (lat_v < -90 or lat_v > 90):
                raise ValueError("latitude không hợp lệ (phải trong -90..90)")
            if lng_v is not None and (lng_v < -180 or lng_v > 180):
                raise ValueError("longitude không hợp lệ (phải trong -180..180)")
        if geo_radius_meters is not UNSET and geo_radius_meters is not None and float(geo_radius_meters) < 0:
            raise ValueError("geo_radius_meters không hợp lệ (phải >= 0)")

        # If caller doesn't provide latitude/longitude, keep existing.
        lat_arg = None if latitude is UNSET else latitude
        lng_arg = None if longitude is UNSET else longitude
        if (lat_arg is None) ^ (lng_arg is None):
            raise ValueError("latitude/longitude phải đi cùng nhau")
        self._validate_attendance_sound_settings(
            label="thành công",
            source=attendance_success_sound_source,
            sample_id=attendance_success_sound_sample_id,
            source_url=attendance_success_sound_url,
            text=attendance_success_sound_text,
        )
        self._validate_attendance_sound_settings(
            label="thất bại",
            source=attendance_failure_sound_source,
            sample_id=attendance_failure_sound_sample_id,
            source_url=attendance_failure_sound_url,
            text=attendance_failure_sound_text,
        )
        try:
            c = self._companies.update(
                db,
                company_id=company_id,
                code=(code.strip() if isinstance(code, str) else code),
                name=(name.strip() if isinstance(name, str) else name),
                status=(status.strip() if isinstance(status, str) else status),
                address=(address.strip() if isinstance(address, str) else address),
                latitude=latitude,
                longitude=longitude,
                geo_radius_meters=geo_radius_meters,
                require_gps_on_attendance=require_gps_on_attendance,
                attendance_success_sound_source=self._normalize_optional_trimmed(attendance_success_sound_source),
                attendance_success_sound_sample_id=self._normalize_optional_trimmed(attendance_success_sound_sample_id),
                attendance_success_sound_url=self._normalize_optional_trimmed(attendance_success_sound_url),
                attendance_success_sound_text=self._normalize_optional_trimmed(attendance_success_sound_text),
                attendance_failure_sound_source=self._normalize_optional_trimmed(attendance_failure_sound_source),
                attendance_failure_sound_sample_id=self._normalize_optional_trimmed(attendance_failure_sound_sample_id),
                attendance_failure_sound_url=self._normalize_optional_trimmed(attendance_failure_sound_url),
                attendance_failure_sound_text=self._normalize_optional_trimmed(attendance_failure_sound_text),
            )
            if c is None:
                raise ValueError("Company not found")
            db.commit()
            db.refresh(c)
            return c
        except IntegrityError:
            db.rollback()
            raise ValueError("Duplicate company code")

    def delete_company(self, db: Session, *, company_id: int) -> None:
        try:
            ok = self._companies.delete(db, company_id=company_id)
            if not ok:
                raise ValueError("Company not found")
            db.commit()
        except IntegrityError:
            db.rollback()
            raise ValueError("Company đang được sử dụng; không thể xoá")

    def update_company_logo(
        self,
        db: Session,
        *,
        company_id: int,
        logo_bytes: bytes,
        content_type: str | None,
    ):
        normalized_type = (content_type or "").split(";", 1)[0].strip().lower()
        if normalized_type == "image/jpg":
            normalized_type = "image/jpeg"
        if not logo_bytes:
            raise ValueError("Logo không được để trống")
        if len(logo_bytes) > MAX_COMPANY_LOGO_BYTES:
            raise ValueError("Logo tối đa 2MB")
        if normalized_type not in ALLOWED_COMPANY_LOGO_TYPES:
            raise ValueError("Logo chỉ hỗ trợ PNG, JPG/JPEG hoặc WEBP")
        company = self._companies.update_logo(
            db,
            company_id=company_id,
            logo_blob=logo_bytes,
            logo_mime_type=normalized_type,
        )
        if company is None:
            raise ValueError("Company not found")
        db.commit()
        db.refresh(company)
        return company

    def update_company_attendance_sound_upload(
        self,
        db: Session,
        *,
        company_id: int,
        kind: str,
        sound_bytes: bytes,
        content_type: str | None,
    ):
        normalized_kind = (kind or "").strip().lower()
        if normalized_kind not in {"success", "failure"}:
            raise ValueError("Loại âm thanh không hợp lệ")
        normalized_type = (content_type or "").split(";", 1)[0].strip().lower()
        if normalized_type not in ALLOWED_ATTENDANCE_SOUND_TYPES:
            raise ValueError("Âm thanh chỉ hỗ trợ MP3, WAV, OGG, AAC, M4A hoặc WEBM")
        if not sound_bytes:
            raise ValueError("Âm thanh không được để trống")
        if len(sound_bytes) > MAX_COMPANY_SOUND_BYTES:
            raise ValueError("Âm thanh tối đa 2MB")
        company = self._companies.update_attendance_sound_upload(
            db,
            company_id=company_id,
            kind=normalized_kind,
            sound_blob=sound_bytes,
            sound_mime_type=normalized_type,
        )
        if company is None:
            raise ValueError("Company not found")
        db.commit()
        db.refresh(company)
        return company

    def _normalize_optional_trimmed(self, value: str | None | object) -> str | None | object:
        if value is UNSET:
            return value
        if value is None:
            return None
        if isinstance(value, str):
            normalized = value.strip()
            return normalized or None
        return value

    def _validate_attendance_sound_settings(
        self,
        *,
        label: str,
        source: str | None | object,
        sample_id: str | None | object,
        source_url: str | None | object,
        text: str | None | object,
    ) -> None:
        normalized_source = self._normalize_optional_trimmed(source)
        normalized_sample = self._normalize_optional_trimmed(sample_id)
        normalized_url = self._normalize_optional_trimmed(source_url)
        normalized_text = self._normalize_optional_trimmed(text)

        if normalized_source is UNSET:
            return
        if normalized_source is None:
            raise ValueError(f"Nguồn âm thanh {label} không hợp lệ")
        if normalized_source not in ATTENDANCE_SOUND_SOURCES:
            raise ValueError(f"Nguồn âm thanh {label} không hợp lệ")
        if normalized_source == "sample":
            if not isinstance(normalized_sample, str) or normalized_sample not in ATTENDANCE_SOUND_SAMPLE_IDS:
                raise ValueError(f"Mẫu âm thanh {label} không hợp lệ")
        if normalized_source == "url":
            if not isinstance(normalized_url, str):
                raise ValueError(f"URL âm thanh {label} không hợp lệ")
            parsed = urlparse(normalized_url)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                raise ValueError(f"URL âm thanh {label} phải là http hoặc https hợp lệ")
        if normalized_source == "tts":
            if not isinstance(normalized_text, str):
                raise ValueError(f"Nội dung đọc cho âm thanh {label} không hợp lệ")
            if len(normalized_text) > MAX_ATTENDANCE_SOUND_TEXT_CHARS:
                raise ValueError(f"Nội dung đọc cho âm thanh {label} tối đa {MAX_ATTENDANCE_SOUND_TEXT_CHARS} ký tự")

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.sentinels import UNSET
from app.models.company import Company


class CompanyRepository:
    def create(
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
        require_gps_on_attendance: bool | None = None,
    ) -> Company:
        company = Company(
            code=code,
            name=name,
            status=status or "active",
            address=address,
            latitude=latitude,
            longitude=longitude,
            geo_radius_meters=geo_radius_meters,
            require_gps_on_attendance=bool(require_gps_on_attendance) if require_gps_on_attendance is not None else False,
        )
        db.add(company)
        db.flush()
        return company

    def list(self, db: Session, *, limit: int = 200, offset: int = 0, q: str | None = None) -> list[Company]:
        stmt = select(Company)
        if q:
            stmt = stmt.where(Company.name.ilike(f"%{q}%") | Company.code.ilike(f"%{q}%"))
        stmt = stmt.order_by(Company.id.desc()).limit(limit).offset(offset)
        return list(db.execute(stmt).scalars().all())

    def get(self, db: Session, company_id: int) -> Company | None:
        return db.get(Company, company_id)

    def get_by_code(self, db: Session, code: str) -> Company | None:
        return db.execute(select(Company).where(Company.code == code)).scalars().first()

    def update(
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
    ) -> Company | None:
        c = self.get(db, company_id)
        if c is None:
            return None
        if code is not UNSET:
            c.code = code
        if name is not UNSET:
            c.name = name
        if status is not UNSET:
            c.status = status
        if address is not UNSET:
            c.address = address
        if latitude is not UNSET:
            c.latitude = latitude
        if longitude is not UNSET:
            c.longitude = longitude
        if geo_radius_meters is not UNSET:
            c.geo_radius_meters = geo_radius_meters
        if require_gps_on_attendance is not UNSET:
            c.require_gps_on_attendance = bool(require_gps_on_attendance) if require_gps_on_attendance is not None else False
        if attendance_success_sound_source is not UNSET:
            c.attendance_success_sound_source = attendance_success_sound_source or "default"
        if attendance_success_sound_sample_id is not UNSET:
            c.attendance_success_sound_sample_id = attendance_success_sound_sample_id
        if attendance_success_sound_url is not UNSET:
            c.attendance_success_sound_url = attendance_success_sound_url
        if attendance_success_sound_text is not UNSET:
            c.attendance_success_sound_text = attendance_success_sound_text
        if attendance_failure_sound_source is not UNSET:
            c.attendance_failure_sound_source = attendance_failure_sound_source or "default"
        if attendance_failure_sound_sample_id is not UNSET:
            c.attendance_failure_sound_sample_id = attendance_failure_sound_sample_id
        if attendance_failure_sound_url is not UNSET:
            c.attendance_failure_sound_url = attendance_failure_sound_url
        if attendance_failure_sound_text is not UNSET:
            c.attendance_failure_sound_text = attendance_failure_sound_text
        db.add(c)
        db.flush()
        return c

    def update_logo(
        self,
        db: Session,
        *,
        company_id: int,
        logo_blob: bytes | None,
        logo_mime_type: str | None,
    ) -> Company | None:
        c = self.get(db, company_id)
        if c is None:
            return None
        c.logo_blob = logo_blob
        c.logo_mime_type = logo_mime_type
        db.add(c)
        db.flush()
        return c

    def update_attendance_sound_upload(
        self,
        db: Session,
        *,
        company_id: int,
        kind: str,
        sound_blob: bytes | None,
        sound_mime_type: str | None,
    ) -> Company | None:
        c = self.get(db, company_id)
        if c is None:
            return None
        if kind == "success":
            c.attendance_success_sound_blob = sound_blob
            c.attendance_success_sound_mime_type = sound_mime_type
        else:
            c.attendance_failure_sound_blob = sound_blob
            c.attendance_failure_sound_mime_type = sound_mime_type
        db.add(c)
        db.flush()
        return c

    def delete(self, db: Session, *, company_id: int) -> bool:
        c = self.get(db, company_id)
        if c is None:
            return False
        db.delete(c)
        db.flush()
        return True

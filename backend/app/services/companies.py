from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.sentinels import UNSET
from app.repositories.companies import CompanyRepository


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

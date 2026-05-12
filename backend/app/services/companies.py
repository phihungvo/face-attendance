from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

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
    ):
        code = code.strip()
        name = name.strip()
        if not code:
            raise ValueError("code is required")
        if not name:
            raise ValueError("name is required")
        if (latitude is None) ^ (longitude is None):
            raise ValueError("latitude/longitude phải đi cùng nhau")
        try:
            c = self._companies.create(db, code=code, name=name, status=status, address=address.strip() if address else None, latitude=latitude, longitude=longitude, geo_radius_meters=geo_radius_meters)
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
        code: str | None = None,
        name: str | None = None,
        status: str | None = None,
        address: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        geo_radius_meters: float | None = None,
    ):
        if (latitude is None) ^ (longitude is None):
            raise ValueError("latitude/longitude phải đi cùng nhau")
        try:
            c = self._companies.update(
                db,
                company_id=company_id,
                code=code.strip() if code else None,
                name=name.strip() if name else None,
                status=status.strip() if status else None,
                address=address.strip() if address else None,
                latitude=latitude,
                longitude=longitude,
                geo_radius_meters=geo_radius_meters,
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

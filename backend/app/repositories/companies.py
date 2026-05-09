from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

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
    ) -> Company:
        company = Company(code=code, name=name, status=status or "active", address=address, latitude=latitude, longitude=longitude, geo_radius_meters=geo_radius_meters)
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
        code: str | None = None,
        name: str | None = None,
        status: str | None = None,
        address: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        geo_radius_meters: float | None = None,
    ) -> Company | None:
        c = self.get(db, company_id)
        if c is None:
            return None
        if code is not None:
            c.code = code
        if name is not None:
            c.name = name
        if status is not None:
            c.status = status
        if address is not None:
            c.address = address
        if latitude is not None:
            c.latitude = latitude
        if longitude is not None:
            c.longitude = longitude
        if geo_radius_meters is not None:
            c.geo_radius_meters = geo_radius_meters
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

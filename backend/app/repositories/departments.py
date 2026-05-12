from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.department import Department


class DepartmentRepository:
    def create(self, db: Session, *, company_id: int | None = None, code: str, name: str, location: str | None) -> Department:
        dept = Department(company_id=company_id, code=code, name=name, location=location)
        db.add(dept)
        db.flush()
        return dept

    def list(
        self,
        db: Session,
        *,
        company_id: int | None = None,
        limit: int = 200,
        offset: int = 0,
        q: str | None = None,
    ) -> list[Department]:
        stmt = select(Department)
        if company_id is not None:
            stmt = stmt.where(Department.company_id == company_id)
        if q:
            stmt = stmt.where((Department.name.ilike(f"%{q}%")) | (Department.code.ilike(f"%{q}%")))
        stmt = stmt.order_by(Department.id.desc()).limit(limit).offset(offset)
        return list(db.execute(stmt).scalars().all())

    def get(self, db: Session, dept_id: int, *, company_id: int | None = None) -> Department | None:
        if company_id is None:
            return db.get(Department, dept_id)
        stmt = select(Department).where(Department.id == dept_id, Department.company_id == company_id)
        return db.execute(stmt).scalars().first()

    def get_by_code(self, db: Session, code: str) -> Department | None:
        stmt = select(Department).where(Department.code == code).limit(1)
        return db.execute(stmt).scalars().first()

    def update(self, db: Session, *, dept_id: int, company_id: int | None = None, code: str, name: str, location: str | None) -> Department | None:
        dept = self.get(db, dept_id, company_id=company_id)
        if dept is None:
            return None
        dept.code = code
        dept.name = name
        dept.location = location
        db.add(dept)
        db.flush()
        return dept

    def delete(self, db: Session, *, dept_id: int, company_id: int | None = None) -> bool:
        dept = self.get(db, dept_id, company_id=company_id)
        if dept is None:
            return False
        db.delete(dept)
        db.flush()
        return True

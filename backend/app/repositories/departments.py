from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.department import Department


class DepartmentRepository:
    def create(self, db: Session, *, code: str, name: str, location: str | None) -> Department:
        dept = Department(code=code, name=name, location=location)
        db.add(dept)
        db.flush()
        return dept

    def list(self, db: Session, *, limit: int = 200, offset: int = 0, q: str | None = None) -> list[Department]:
        stmt = select(Department)
        if q:
            stmt = stmt.where((Department.name.ilike(f"%{q}%")) | (Department.code.ilike(f"%{q}%")))
        stmt = stmt.order_by(Department.id.desc()).limit(limit).offset(offset)
        return list(db.execute(stmt).scalars().all())

    def get(self, db: Session, dept_id: int) -> Department | None:
        return db.get(Department, dept_id)

    def get_by_code(self, db: Session, code: str) -> Department | None:
        stmt = select(Department).where(Department.code == code).limit(1)
        return db.execute(stmt).scalars().first()

    def update(self, db: Session, *, dept_id: int, code: str, name: str, location: str | None) -> Department | None:
        dept = self.get(db, dept_id)
        if dept is None:
            return None
        dept.code = code
        dept.name = name
        dept.location = location
        db.add(dept)
        db.flush()
        return dept

    def delete(self, db: Session, *, dept_id: int) -> bool:
        dept = self.get(db, dept_id)
        if dept is None:
            return False
        db.delete(dept)
        db.flush()
        return True


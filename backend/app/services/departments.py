from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.repositories.departments import DepartmentRepository


class DepartmentService:
    def __init__(self) -> None:
        self._depts = DepartmentRepository()

    def list_departments(self, db: Session, *, company_id: int | None = None, limit: int = 200, offset: int = 0, q: str | None = None):
        return self._depts.list(db, company_id=company_id, limit=limit, offset=offset, q=q)

    def get_department(self, db: Session, *, dept_id: int, company_id: int | None = None):
        dept = self._depts.get(db, dept_id, company_id=company_id)
        if dept is None:
            raise ValueError("Department not found")
        return dept

    def create_department(self, db: Session, *, company_id: int | None = None, code: str, name: str, location: str | None):
        code = code.strip()
        name = name.strip()
        if not code:
            raise ValueError("code is required")
        if not name:
            raise ValueError("name is required")
        try:
            dept = self._depts.create(db, company_id=company_id, code=code, name=name, location=location.strip() if location else None)
            db.commit()
            db.refresh(dept)
            return dept
        except IntegrityError:
            db.rollback()
            raise ValueError("Department code already exists")

    def update_department(self, db: Session, *, dept_id: int, company_id: int | None = None, code: str, name: str, location: str | None):
        code = code.strip()
        name = name.strip()
        if not code:
            raise ValueError("code is required")
        if not name:
            raise ValueError("name is required")
        try:
            dept = self._depts.update(db, dept_id=dept_id, company_id=company_id, code=code, name=name, location=location.strip() if location else None)
            if dept is None:
                raise ValueError("Department not found")
            db.commit()
            db.refresh(dept)
            return dept
        except IntegrityError:
            db.rollback()
            raise ValueError("Department code already exists")

    def delete_department(self, db: Session, *, dept_id: int, company_id: int | None = None) -> None:
        try:
            ok = self._depts.delete(db, dept_id=dept_id, company_id=company_id)
            if not ok:
                raise ValueError("Department not found")
            db.commit()
        except IntegrityError:
            db.rollback()
            raise ValueError("Department has users; cannot delete")

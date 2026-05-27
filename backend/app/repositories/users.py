from __future__ import annotations

from datetime import date

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    def get_by_code(self, db: Session, *, company_id: int | None, code: str) -> User | None:
        stmt = select(User).where(User.company_id == company_id, User.code == code).order_by(User.id.asc())
        return db.execute(stmt).scalars().first()

    def get_by_email(self, db: Session, *, company_id: int | None, email: str) -> User | None:
        stmt = select(User).where(User.company_id == company_id, User.email == email).order_by(User.id.asc())
        return db.execute(stmt).scalars().first()

    def create(
        self,
        db: Session,
        *,
        company_id: int | None = None,
        name: str,
        code: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        address: str | None = None,
        citizen_id: str | None = None,
        citizen_id_place: str | None = None,
        hire_date: date | None = None,
        role: str | None = None,
        status: str | None = None,
        department_id: int | None = None,
    ) -> User:
        user = User(
            company_id=company_id,
            name=name,
            code=code,
            email=email,
            phone=phone,
            address=address,
            citizen_id=citizen_id,
            citizen_id_place=citizen_id_place,
            hire_date=hire_date,
            role=role,
            status=status or "active",
            department_id=department_id,
        )
        db.add(user)
        db.flush()  # assign id
        return user

    def list(
        self,
        db: Session,
        *,
        company_id: int | None = None,
        limit: int = 100,
        offset: int = 0,
        q: str | None = None,
    ) -> list[User]:
        stmt = select(User)
        if company_id is not None:
            stmt = stmt.where(User.company_id == company_id)
        if q:
            needle = f"%{q}%"
            stmt = stmt.where(
                or_(
                    User.name.ilike(needle),
                    User.code.ilike(needle),
                    User.email.ilike(needle),
                    User.phone.ilike(needle),
                    User.address.ilike(needle),
                    User.citizen_id.ilike(needle),
                    User.citizen_id_place.ilike(needle),
                )
            )
        stmt = stmt.order_by(User.id.desc()).limit(limit).offset(offset)
        return list(db.execute(stmt).scalars().all())

    def get(self, db: Session, user_id: int, *, company_id: int | None = None) -> User | None:
        if company_id is None:
            return db.get(User, user_id)
        stmt = select(User).where(User.id == user_id, User.company_id == company_id)
        return db.execute(stmt).scalars().first()

    def update_fields(
        self,
        db: Session,
        *,
        user_id: int,
        company_id: int | None = None,
        name: str,
        code: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        address: str | None = None,
        citizen_id: str | None = None,
        citizen_id_place: str | None = None,
        hire_date: date | None = None,
        role: str | None = None,
        status: str | None = None,
        department_id: int | None = None,
    ) -> User | None:
        user = self.get(db, user_id, company_id=company_id)
        if user is None:
            return None
        user.name = name
        user.code = code
        user.email = email
        user.phone = phone
        user.address = address
        user.citizen_id = citizen_id
        user.citizen_id_place = citizen_id_place
        user.hire_date = hire_date
        user.role = role
        if status:
            user.status = status
        user.department_id = department_id
        db.add(user)
        db.flush()
        return user

    def delete(self, db: Session, *, user_id: int, company_id: int | None = None) -> bool:
        user = self.get(db, user_id, company_id=company_id)
        if user is None:
            return False
        db.delete(user)
        db.flush()
        return True

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    def create(
        self,
        db: Session,
        *,
        company_id: int | None = None,
        name: str,
        code: str | None = None,
        email: str | None = None,
        role: str | None = None,
        status: str | None = None,
        department_id: int | None = None,
    ) -> User:
        user = User(
            company_id=company_id,
            name=name,
            code=code,
            email=email,
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
            stmt = stmt.where(User.name.ilike(f"%{q}%"))
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

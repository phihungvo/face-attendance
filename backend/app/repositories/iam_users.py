from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


class IamUserRepository:
    def get_by_username(self, db: Session, username: str) -> User | None:
        stmt = select(User).where(User.username == username)
        return db.execute(stmt).scalars().first()

    def get_by_identifier(self, db: Session, identifier: str) -> User | None:
        """
        Allow login by username OR email OR employee code.
        """
        stmt = select(User).where((User.username == identifier) | (User.email == identifier) | (User.code == identifier))
        return db.execute(stmt).scalars().first()

    def create(self, db: Session, *, username: str, password_hash: str, company_id: int | None = None, name: str | None = None) -> User:
        user = User(company_id=company_id, username=username, password_hash=password_hash, name=(name or username))
        db.add(user)
        db.flush()
        return user

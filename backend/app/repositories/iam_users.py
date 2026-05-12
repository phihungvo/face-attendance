from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


class IamUserRepository:
    def get_by_username(self, db: Session, username: str) -> User | None:
        stmt = select(User).where(User.username == username)
        return db.execute(stmt).scalars().first()

    def get_by_code(self, db: Session, code: str) -> User | None:
        rows = self.list_by_code(db, code)
        if len(rows) == 1:
            return rows[0]
        return None

    def list_by_code(self, db: Session, code: str) -> list[User]:
        stmt = select(User).where(User.code == code).order_by(User.id.asc())
        return list(db.execute(stmt).scalars().all())

    def list_by_email(self, db: Session, email: str) -> list[User]:
        stmt = select(User).where(User.email == email).order_by(User.id.asc())
        return list(db.execute(stmt).scalars().all())

    def get_by_identifier(self, db: Session, identifier: str) -> User | None:
        """
        Allow login by username OR email OR employee code.
        """
        # Keep backward compatibility for callers that expect a single user:
        # - Prefer username, then employee code
        # - Only allow email if it uniquely identifies a user
        u = self.get_by_username(db, identifier)
        if u is not None:
            return u
        rows = self.list_by_code(db, identifier)
        if len(rows) == 1:
            return rows[0]
        if len(rows) > 1:
            return None
        rows = self.list_by_email(db, identifier)
        if len(rows) == 1:
            return rows[0]
        return None

    def create(self, db: Session, *, username: str, password_hash: str, company_id: int | None = None, name: str | None = None) -> User:
        user = User(company_id=company_id, username=username, password_hash=password_hash, name=(name or username))
        db.add(user)
        db.flush()
        return user

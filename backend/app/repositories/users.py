from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    def create(self, db: Session, *, name: str) -> User:
        user = User(name=name)
        db.add(user)
        db.flush()  # assign id
        return user

    def list(self, db: Session, *, limit: int = 100, offset: int = 0) -> list[User]:
        stmt = select(User).order_by(User.id.desc()).limit(limit).offset(offset)
        return list(db.execute(stmt).scalars().all())

    def get(self, db: Session, user_id: int) -> User | None:
        return db.get(User, user_id)

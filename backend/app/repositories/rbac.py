from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.rbac import Permission, Role


class RbacRepository:
    def list_permissions(self, db: Session) -> list[Permission]:
        return list(db.execute(select(Permission).order_by(Permission.key.asc())).scalars().all())

    def list_roles(self, db: Session) -> list[Role]:
        return list(db.execute(select(Role).order_by(Role.key.asc())).scalars().all())

    def get_role_by_key(self, db: Session, key: str) -> Role | None:
        return db.execute(select(Role).where(Role.key == key)).scalars().first()

    # Get user by user id
    def get_user(self, db: Session, user_id: int) -> User | None:
        return db.get(User, user_id)

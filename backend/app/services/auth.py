from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.errors import AUTH_INVALID_CREDENTIALS, AUTH_USERNAME_TAKEN, AppException
from app.core.security import create_access_token, hash_password, verify_password
from app.repositories.iam_users import IamUserRepository
from app.repositories.rbac import RbacRepository


class AuthService:
    def __init__(self) -> None:
        self._users = IamUserRepository()
        self._rbac = RbacRepository()

    def register(self, db: Session, *, username: str, password: str, role_key: str = "employee") -> str:
        if self._users.get_by_username(db, username) is not None:
            raise AppException(AUTH_USERNAME_TAKEN)
        user = self._users.create(db, username=username, password_hash=hash_password(password))
        role = self._rbac.get_role_by_key(db, role_key) or self._rbac.get_role_by_key(db, "employee")
        if role is not None:
            user.roles = [role]
        db.commit()
        return create_access_token(subject=str(user.id))

    def login(self, db: Session, *, username: str, password: str) -> str:
        user = self._users.get_by_username(db, username)
        if user is None or not user.password_hash or not verify_password(password, user.password_hash):
            raise AppException(AUTH_INVALID_CREDENTIALS)
        return create_access_token(subject=str(user.id))

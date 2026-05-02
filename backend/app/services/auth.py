from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.errors import AUTH_INVALID_CREDENTIALS, AUTH_USERNAME_TAKEN, AppException
from app.core.security import create_access_token, hash_password, verify_password
from app.repositories.accounts import AccountRepository


class AuthService:
    def __init__(self) -> None:
        self._accounts = AccountRepository()

    def register(self, db: Session, *, username: str, password: str) -> str:
        if self._accounts.get_by_username(db, username) is not None:
            raise AppException(AUTH_USERNAME_TAKEN)
        account = self._accounts.create(db, username=username, password_hash=hash_password(password))
        db.commit()
        return create_access_token(subject=str(account.id))

    def login(self, db: Session, *, username: str, password: str) -> str:
        account = self._accounts.get_by_username(db, username)
        if account is None or not verify_password(password, account.password_hash):
            raise AppException(AUTH_INVALID_CREDENTIALS)
        return create_access_token(subject=str(account.id))


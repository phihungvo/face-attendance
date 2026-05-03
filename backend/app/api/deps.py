from __future__ import annotations

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import FORBIDDEN, UNAUTHORIZED, AppException
from app.core.security import get_token_subject
from app.db.session import get_db
from app.models.user import User

auth_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(auth_scheme),
    db: Session = Depends(get_db),
) -> User:
    if creds is None or not creds.credentials:
        raise AppException(UNAUTHORIZED)
    account_id = get_token_subject(creds.credentials)
    if account_id is None:
        raise AppException(UNAUTHORIZED)
    user = db.get(User, int(account_id))
    if user is None:
        raise AppException(UNAUTHORIZED)
    return user


def get_permission_keys(user: User) -> set[str]:
    keys: set[str] = set()
    for role in getattr(user, "roles", []):
        for perm in getattr(role, "permissions", []):
            keys.add(perm.key)
    for perm in getattr(user, "permissions", []):
        keys.add(perm.key)
    return keys


def require_permission(permission_key: str):
    def _dep(user: User = Depends(get_current_user)) -> User:
        keys = get_permission_keys(user)
        if permission_key not in keys:
            raise AppException(FORBIDDEN)
        return user

    return _dep

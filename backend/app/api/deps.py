from __future__ import annotations

from fastapi import Depends
from fastapi import Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import AUTH_ACCOUNT_DISABLED, AUTH_ACCOUNT_PENDING, FORBIDDEN, UNAUTHORIZED, AppException
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
    if (getattr(user, "auth_status", None) == "pending") or (user.password_hash is None):
        raise AppException(AUTH_ACCOUNT_PENDING)
    if str(getattr(user, "auth_status", "active") or "active").strip().lower() != "active":
        raise AppException(AUTH_ACCOUNT_DISABLED)
    if str(getattr(user, "status", "active") or "active").strip().lower() != "active":
        raise AppException(AUTH_ACCOUNT_DISABLED)
    return user


def get_permission_keys(user: User) -> set[str]:
    keys: set[str] = set()
    for role in getattr(user, "roles", []):
        for perm in getattr(role, "permissions", []):
            keys.add(perm.key)
    for perm in getattr(user, "permissions", []):
        keys.add(perm.key)
    return keys


def get_role_keys(user: User) -> set[str]:
    return {getattr(r, "key", "") for r in getattr(user, "roles", []) or [] if getattr(r, "key", "")}


def is_admin(user: User) -> bool:
    return "admin" in get_role_keys(user)


def get_company_scope_id(
    user: User = Depends(get_current_user),
    x_company_id: int | None = Header(default=None, alias="X-Company-Id"),
) -> int | None:
    """
    Multi-company scoping:
    - Admin can choose a company via `X-Company-Id` (or omit to operate cross-company on admin-only endpoints).
    - Non-admin is always scoped to their `user.company_id`.
    """
    if is_admin(user):
        return int(x_company_id) if x_company_id is not None else None
    return int(getattr(user, "company_id", None)) if getattr(user, "company_id", None) is not None else None


def require_permission(permission_key: str):
    def _dep(user: User = Depends(get_current_user)) -> User:
        keys = get_permission_keys(user)
        if permission_key not in keys:
            raise AppException(FORBIDDEN)
        return user

    return _dep

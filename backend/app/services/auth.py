from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.clients.email_client import EmailClient
from app.core.errors import (
    AUTH_ACCOUNT_DISABLED,
    AUTH_ACCOUNT_PENDING,
    AUTH_IDENTIFIER_AMBIGUOUS,
    AUTH_INVALID_CREDENTIALS,
    AUTH_INVITE_EXPIRED,
    AUTH_INVITE_INVALID,
    AUTH_USERNAME_TAKEN,
    BAD_REQUEST,
    AppException,
)
from app.core.security import create_access_token, hash_password, validate_password_strength, verify_password
from app.core.settings import settings
from app.repositories.iam_users import IamUserRepository
from app.repositories.rbac import RbacRepository


class AuthService:
    def __init__(self) -> None:
        self._users = IamUserRepository()
        self._rbac = RbacRepository()
        self._email = EmailClient()

    def _hash_invite_token(self, token: str) -> str:
        # Not a password hash; just a server-side verifier to avoid storing raw tokens.
        h = hashlib.sha256()
        h.update(settings.JWT_SECRET.encode("utf-8"))
        h.update(b":invite:")
        h.update(token.encode("utf-8"))
        return h.hexdigest()

    def _invite_link(self, token: str) -> str:
        return f"{settings.FRONTEND_BASE_URL.rstrip('/')}/activate?token={token}"

    def register(self, db: Session, *, username: str, password: str, role_key: str = "employee") -> str:
        if self._users.get_by_username(db, username) is not None:
            raise AppException(AUTH_USERNAME_TAKEN)
        validate_password_strength(password, username=username)
        company_id = None
        try:
            from sqlalchemy import select
            from app.models.company import Company

            code = settings.BOOTSTRAP_ADMIN_COMPANY_CODE.strip() or "default"
            company = db.execute(select(Company).where(Company.code == code)).scalars().first()
            company_id = getattr(company, "id", None) if company is not None else None
        except Exception:
            company_id = None
        user = self._users.create(db, username=username, password_hash=hash_password(password), company_id=company_id)
        role = self._rbac.get_role_by_key(db, role_key) or self._rbac.get_role_by_key(db, "employee")
        if role is not None:
            user.roles = [role]
        db.commit()
        return create_access_token(subject=str(user.id))

    def login(self, db: Session, *, identifier: str, password: str) -> str:
        # Support login by username/code/email. Email and employee code may be duplicated across companies.
        user = self._users.get_by_username(db, identifier) or self._users.get_by_code(db, identifier)
        if user is None:
            by_code = self._users.list_by_code(db, identifier)
            if len(by_code) > 1:
                raise AppException(AUTH_IDENTIFIER_AMBIGUOUS)
            by_email = self._users.list_by_email(db, identifier)
            if len(by_email) > 1:
                raise AppException(AUTH_IDENTIFIER_AMBIGUOUS)
            user = by_email[0] if len(by_email) == 1 else None
        if user is None:
            raise AppException(AUTH_INVALID_CREDENTIALS)
        if (getattr(user, "auth_status", None) == "pending") or (user.password_hash is None):
            raise AppException(AUTH_ACCOUNT_PENDING)
        if str(getattr(user, "auth_status", "active") or "active").strip().lower() != "active":
            raise AppException(AUTH_ACCOUNT_DISABLED)
        if str(getattr(user, "status", "active") or "active").strip().lower() != "active":
            raise AppException(AUTH_ACCOUNT_DISABLED)
        if not verify_password(password, user.password_hash):
            raise AppException(AUTH_INVALID_CREDENTIALS)
        return create_access_token(subject=str(user.id))

    def invite_pending_user(self, db: Session, *, user_id: int) -> str:
        from app.models.user import User

        user = db.get(User, user_id)
        if user is None or not user.email:
            raise ValueError("User/email not found")

        raw = secrets.token_urlsafe(32)
        token_hash = self._hash_invite_token(raw)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        exp = (datetime.now(timezone.utc) + timedelta(minutes=int(settings.INVITE_TOKEN_EXPIRE_MINUTES))).replace(tzinfo=None)

        user.invite_token_hash = token_hash
        user.invite_token_expires_at = exp
        user.invite_sent_at = now
        user.auth_status = "pending"
        user.password_hash = None
        db.add(user)
        db.commit()

        link = self._invite_link(raw)
        try:
            self._email.send_invite_email(to_email=user.email, invite_link=link)
        except Exception as e:
            # Keep user in pending state but make the failure explicit to caller.
            raise ValueError(f"Gửi email thất bại: {e}")
        return link

    def activate_with_token(self, db: Session, *, token: str, password: str) -> str:
        from sqlalchemy import select
        from app.models.user import User

        token_hash = self._hash_invite_token(token)
        user = db.execute(select(User).where(User.invite_token_hash == token_hash)).scalars().first()
        if user is None:
            raise AppException(AUTH_INVITE_INVALID)
        exp = getattr(user, "invite_token_expires_at", None)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if exp is None or exp < now:
            raise AppException(AUTH_INVITE_EXPIRED)

        validate_password_strength(password, username=getattr(user, "username", None))
        user.password_hash = hash_password(password)
        user.auth_status = "active"
        user.invite_token_hash = None
        user.invite_token_expires_at = None
        user.invite_accepted_at = now
        # Ensure employee portal access on first activation (avoid landing in manager UI).
        if len(getattr(user, "roles", []) or []) == 0:
            emp = self._rbac.get_role_by_key(db, "employee")
            if emp is not None:
                user.roles = [emp]
        db.add(user)
        db.commit()

        return create_access_token(subject=str(user.id))

    def change_password(self, db: Session, *, user_id: int, current_password: str, new_password: str) -> None:
        from app.models.user import User

        user = db.get(User, user_id)
        if user is None:
            raise AppException(BAD_REQUEST, detail="User không tồn tại")
        if (getattr(user, "auth_status", None) == "pending") or (user.password_hash is None):
            raise AppException(AUTH_ACCOUNT_PENDING)
        if str(getattr(user, "auth_status", "active") or "active").strip().lower() != "active":
            raise AppException(AUTH_ACCOUNT_DISABLED)
        if str(getattr(user, "status", "active") or "active").strip().lower() != "active":
            raise AppException(AUTH_ACCOUNT_DISABLED)
        if not verify_password(current_password, user.password_hash):
            raise AppException(AUTH_INVALID_CREDENTIALS)
        validate_password_strength(new_password, username=getattr(user, "username", None))
        user.password_hash = hash_password(new_password)
        db.add(user)
        db.commit()

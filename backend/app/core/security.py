from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.core.settings import settings

_WEAK_SECRETS = {
    "",
    "change_me",
    "changeme",
    "secret",
    "default",
    "dev_secret",
    "please_change_me",
}


def hash_password(password: str) -> str:
    pw = password.encode("utf-8")
    hashed = bcrypt.hashpw(pw, bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def validate_password_strength(password: str, *, username: str | None = None) -> None:
    candidate = password or ""
    if len(candidate) < 8:
        raise ValueError("Mật khẩu phải có ít nhất 8 ký tự")
    if len(candidate) > 128:
        raise ValueError("Mật khẩu quá dài")
    if not re.search(r"[A-Za-z]", candidate):
        raise ValueError("Mật khẩu phải chứa ít nhất 1 chữ cái")
    if not re.search(r"\d", candidate):
        raise ValueError("Mật khẩu phải chứa ít nhất 1 chữ số")
    lowered = candidate.casefold()
    if username and username.strip() and username.strip().casefold() in lowered:
        raise ValueError("Mật khẩu không được chứa username")


def validate_runtime_security() -> None:
    secret = (settings.JWT_SECRET or "").strip()
    if settings.is_production_like:
        if len(secret) < int(settings.JWT_SECRET_MIN_LENGTH):
            raise RuntimeError(
                f"JWT_SECRET quá ngắn cho môi trường production-like; cần ít nhất {int(settings.JWT_SECRET_MIN_LENGTH)} ký tự"
            )
        if secret.casefold() in _WEAK_SECRETS:
            raise RuntimeError("JWT_SECRET đang dùng giá trị mặc định/yếu; hãy đổi secret trước khi chạy app")


def create_access_token(*, subject: str, expires_minutes: int | None = None) -> str:
    exp_minutes = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES if expires_minutes is None else expires_minutes
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=exp_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


def get_token_subject(token: str) -> str | None:
    try:
        payload = decode_token(token)
        sub = payload.get("sub")
        return str(sub) if sub else None
    except JWTError:
        return None

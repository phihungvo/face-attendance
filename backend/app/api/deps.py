from __future__ import annotations

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import UNAUTHORIZED, AppException
from app.core.security import get_token_subject
from app.db.session import get_db
from app.models.account import Account

auth_scheme = HTTPBearer(auto_error=False)


def get_current_account(
    creds: HTTPAuthorizationCredentials | None = Depends(auth_scheme),
    db: Session = Depends(get_db),
) -> Account:
    if creds is None or not creds.credentials:
        raise AppException(UNAUTHORIZED)
    account_id = get_token_subject(creds.credentials)
    if account_id is None:
        raise AppException(UNAUTHORIZED)
    account = db.get(Account, int(account_id))
    if account is None:
        raise AppException(UNAUTHORIZED)
    return account


from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.account import Account


class AccountRepository:
    def get_by_username(self, db: Session, username: str) -> Account | None:
        stmt = select(Account).where(Account.username == username)
        return db.execute(stmt).scalars().first()

    def create(self, db: Session, *, username: str, password_hash: str) -> Account:
        account = Account(username=username, password_hash=password_hash)
        db.add(account)
        db.flush()
        return account


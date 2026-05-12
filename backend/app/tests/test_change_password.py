from __future__ import annotations

import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.errors import AUTH_INVALID_CREDENTIALS, AppException
from app.core.security import hash_password, verify_password
from app.models.base import Base
from app.models.company import Company
from app.models.user import User
from app.services.auth import AuthService


class TestChangePassword(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(self.engine, tables=[Company.__table__, User.__table__])
        self.SessionLocal = sessionmaker(bind=self.engine, class_=Session, expire_on_commit=False, future=True)

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_change_password_success(self) -> None:
        with self.SessionLocal() as db:
            c1 = Company(code="c1", name="C1")
            db.add(c1)
            db.flush()
            u = User(company_id=c1.id, name="U1", username="u1", email="a@x.com", password_hash=hash_password("oldpass"), auth_status="active")
            db.add(u)
            db.commit()

            svc = AuthService()
            svc.change_password(db, user_id=int(u.id), current_password="oldpass", new_password="newpass1")
            db.refresh(u)
            self.assertTrue(verify_password("newpass1", u.password_hash or ""))

    def test_change_password_wrong_current(self) -> None:
        with self.SessionLocal() as db:
            c1 = Company(code="c1", name="C1")
            db.add(c1)
            db.flush()
            u = User(company_id=c1.id, name="U1", username="u1", email="a@x.com", password_hash=hash_password("oldpass"), auth_status="active")
            db.add(u)
            db.commit()

            svc = AuthService()
            with self.assertRaises(AppException) as ctx:
                svc.change_password(db, user_id=int(u.id), current_password="badpass", new_password="newpass1")
            self.assertEqual(ctx.exception.error.code, AUTH_INVALID_CREDENTIALS.code)


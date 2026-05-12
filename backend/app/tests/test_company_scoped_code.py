from __future__ import annotations

import unittest

from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.core.errors import AUTH_IDENTIFIER_AMBIGUOUS, AppException
from app.core.security import hash_password
from app.models.base import Base
from app.models.company import Company
from app.models.user import User
from app.services.auth import AuthService
from app.services.users import UserService


class TestCompanyScopedCode(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(self.engine, tables=[Company.__table__, User.__table__])
        self.SessionLocal = sessionmaker(bind=self.engine, class_=Session, expire_on_commit=False, future=True)

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_code_unique_within_company(self) -> None:
        with self.SessionLocal() as db:
            c1 = Company(code="c1", name="C1")
            db.add(c1)
            db.flush()
            db.add(User(company_id=c1.id, name="U1", code="E001"))
            db.commit()

            db.add(User(company_id=c1.id, name="U2", code="E001"))
            with self.assertRaises(IntegrityError):
                db.commit()

    def test_code_can_repeat_across_companies_but_login_ambiguous(self) -> None:
        with self.SessionLocal() as db:
            c1 = Company(code="c1", name="C1")
            c2 = Company(code="c2", name="C2")
            db.add_all([c1, c2])
            db.flush()

            pw = hash_password("secret123")
            u1 = User(company_id=c1.id, name="U1", code="E001", username="u1", password_hash=pw, auth_status="active")
            u2 = User(company_id=c2.id, name="U2", code="E001", username="u2", password_hash=pw, auth_status="active")
            db.add_all([u1, u2])
            db.commit()

            svc = AuthService()
            with self.assertRaises(AppException) as ctx:
                svc.login(db, identifier="E001", password="secret123")
            self.assertEqual(ctx.exception.error.code, AUTH_IDENTIFIER_AMBIGUOUS.code)

    def test_create_user_allows_same_code_across_companies(self) -> None:
        with self.SessionLocal() as db:
            c1 = Company(code="c1", name="C1")
            c2 = Company(code="c2", name="C2")
            db.add_all([c1, c2])
            db.flush()

            svc = UserService()
            u1 = svc.create_user(db, company_id=c1.id, name="U1", code="E001", email="a1@x.com", create_login=False)
            u2 = svc.create_user(db, company_id=c2.id, name="U2", code="E001", email="a2@x.com", create_login=False)
            self.assertNotEqual(int(u1.id), int(u2.id))

    def test_create_user_rejects_duplicate_code_within_company(self) -> None:
        with self.SessionLocal() as db:
            c1 = Company(code="c1", name="C1")
            db.add(c1)
            db.flush()

            svc = UserService()
            _ = svc.create_user(db, company_id=c1.id, name="U1", code="E001", email="a1@x.com", create_login=False)
            with self.assertRaises(ValueError) as ctx:
                svc.create_user(db, company_id=c1.id, name="U2", code="E001", email="a2@x.com", create_login=False)
            self.assertIn("Mã nhân viên", str(ctx.exception))


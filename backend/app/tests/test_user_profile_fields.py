from __future__ import annotations

import unittest
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.base import Base
from app.models.company import Company
from app.models.user import User
from app.services.users import UserService


class TestUserProfileFields(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(self.engine, tables=[Company.__table__, User.__table__])
        self.SessionLocal = sessionmaker(bind=self.engine, class_=Session, expire_on_commit=False, future=True)

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_create_user_persists_profile_fields(self) -> None:
        with self.SessionLocal() as db:
            company = Company(code="c1", name="C1")
            db.add(company)
            db.flush()

            svc = UserService()
            user = svc.create_user(
                db,
                company_id=company.id,
                name="Nguyen Van A",
                code="NV001",
                email="a@x.com",
                phone="0912345678",
                address="Quan 1, TP.HCM",
                citizen_id="079203001234",
                citizen_id_place="Cuc CSQLHC ve TTXH",
                hire_date=date(2026, 5, 27),
                create_login=False,
            )

            self.assertEqual(user.phone, "0912345678")
            self.assertEqual(user.address, "Quan 1, TP.HCM")
            self.assertEqual(user.citizen_id, "079203001234")
            self.assertEqual(user.citizen_id_place, "Cuc CSQLHC ve TTXH")
            self.assertEqual(user.hire_date, date(2026, 5, 27))

    def test_update_user_updates_profile_fields(self) -> None:
        with self.SessionLocal() as db:
            company = Company(code="c1", name="C1")
            db.add(company)
            db.flush()

            svc = UserService()
            user = svc.create_user(db, company_id=company.id, name="Nguyen Van A", create_login=False)
            updated = svc.update_user(
                db,
                user_id=int(user.id),
                company_id=company.id,
                name="Nguyen Van B",
                code="NV009",
                email="b@x.com",
                phone="0987654321",
                address="Thu Duc, TP.HCM",
                citizen_id="079203009999",
                citizen_id_place="Cong an TP.HCM",
                hire_date=date(2025, 1, 15),
                role="Team Lead",
                status="inactive",
                department_id=None,
            )

            self.assertEqual(updated.name, "Nguyen Van B")
            self.assertEqual(updated.phone, "0987654321")
            self.assertEqual(updated.address, "Thu Duc, TP.HCM")
            self.assertEqual(updated.citizen_id, "079203009999")
            self.assertEqual(updated.citizen_id_place, "Cong an TP.HCM")
            self.assertEqual(updated.hire_date, date(2025, 1, 15))
            self.assertEqual(updated.email, "b@x.com")
            self.assertEqual(updated.code, "NV009")

    def test_update_my_profile_only_changes_self_service_fields(self) -> None:
        with self.SessionLocal() as db:
            company = Company(code="c1", name="C1")
            db.add(company)
            db.flush()

            svc = UserService()
            user = svc.create_user(
                db,
                company_id=company.id,
                name="Nguyen Van A",
                code="NV001",
                email="a@x.com",
                phone="0912345678",
                address="Quan 1",
                citizen_id="079203001234",
                citizen_id_place="Noi cu",
                hire_date=date(2026, 5, 27),
                role="Staff",
                status="active",
                department_id=None,
                create_login=False,
            )

            updated = svc.update_my_profile(
                db,
                user_id=int(user.id),
                name="Nguyen Van Updated",
                email="updated@x.com",
                phone="0909000000",
                address="Quan 7",
                citizen_id="079203001999",
                citizen_id_place="Noi moi",
            )

            self.assertEqual(updated.name, "Nguyen Van Updated")
            self.assertEqual(updated.email, "updated@x.com")
            self.assertEqual(updated.phone, "0909000000")
            self.assertEqual(updated.address, "Quan 7")
            self.assertEqual(updated.citizen_id, "079203001999")
            self.assertEqual(updated.citizen_id_place, "Noi moi")
            self.assertEqual(updated.code, "NV001")
            self.assertEqual(updated.role, "Staff")
            self.assertEqual(updated.hire_date, date(2026, 5, 27))

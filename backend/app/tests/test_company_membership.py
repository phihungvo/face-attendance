from __future__ import annotations

import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.base import Base
from app.models.company import Company
from app.models.company_membership import CompanyInvitation, CompanyJoinRequest
from app.models.rbac import Permission, Role, RolePermission, UserPermission, UserRole
from app.models.user import User
from app.services.auth import AuthService
from app.services.company_membership import CompanyMembershipService


class TestCompanyMembership(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(
            self.engine,
            tables=[
                Company.__table__,
                User.__table__,
                Permission.__table__,
                Role.__table__,
                RolePermission.__table__,
                UserRole.__table__,
                UserPermission.__table__,
                CompanyInvitation.__table__,
                CompanyJoinRequest.__table__,
            ],
        )
        self.SessionLocal = sessionmaker(bind=self.engine, class_=Session, expire_on_commit=False, future=True)

    def tearDown(self) -> None:
        self.engine.dispose()

    def _seed_employee_role(self, db: Session) -> Role:
        permission = Permission(key="employee.portal", label="Employee portal")
        role = Role(key="employee", label="Employee")
        role.permissions = [permission]
        db.add_all([permission, role])
        db.flush()
        return role

    def test_public_register_does_not_attach_default_company(self) -> None:
        with self.SessionLocal() as db:
            company = Company(code="ABC2026", name="ABC Company")
            db.add(company)
            self._seed_employee_role(db)
            db.commit()

            token = AuthService().register(db, username="employee1", password="secret123", role_key="employee")
            self.assertTrue(token)
            user = db.query(User).filter(User.username == "employee1").one()
            self.assertIsNone(user.company_id)

    def test_join_request_requires_manager_approval(self) -> None:
        with self.SessionLocal() as db:
            company = Company(code="ABC2026", name="ABC Company")
            user = User(name="Nguyen Van A", username="employee1", password_hash="x", auth_status="active", status="active")
            db.add_all([company, user])
            self._seed_employee_role(db)
            db.commit()

            service = CompanyMembershipService()
            req = service.create_join_request(db, user_id=int(user.id), company_code="ABC2026")
            self.assertEqual(req["status"], "PENDING")
            db.refresh(user)
            self.assertIsNone(user.company_id)

            with self.assertRaises(ValueError):
                service.create_join_request(db, user_id=int(user.id), company_code="ABC2026")

            approved = service.approve_join_request(db, company_id=int(company.id), actor_user_id=int(user.id), request_id=int(req["id"]))
            self.assertEqual(approved["status"], "APPROVED")
            db.refresh(user)
            self.assertEqual(int(user.company_id), int(company.id))

    def test_employee_accepts_matching_email_invitation(self) -> None:
        with self.SessionLocal() as db:
            company = Company(code="ABC2026", name="ABC Company")
            manager = User(company=company, name="Manager", username="manager1", password_hash="x", auth_status="active", status="active")
            employee = User(name="Nguyen Van A", username="employee1", email="abc@gmail.com", password_hash="x", auth_status="active", status="active")
            db.add_all([company, manager, employee])
            self._seed_employee_role(db)
            db.commit()

            service = CompanyMembershipService()
            invitation = service.invite_employee(db, company_id=int(company.id), actor_user_id=int(manager.id), email="abc@gmail.com")
            accepted = service.accept_invitation(db, user_id=int(employee.id), invitation_id=int(invitation["id"]))
            self.assertEqual(accepted["status"], "ACCEPTED")
            db.refresh(employee)
            self.assertEqual(int(employee.company_id), int(company.id))


if __name__ == "__main__":
    unittest.main()

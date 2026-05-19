from __future__ import annotations

import unittest
from unittest.mock import patch

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.models.base import Base
from app.models.company import Company
from app.models.department import Department
from app.models.notification import CompanyNotificationPolicy, Notification, NotificationPreference, NotificationRecipient
from app.models.rbac import Permission, Role, RolePermission, UserPermission, UserRole
from app.models.user import User
from app.services.notifications import NotificationService


class TestNotificationServiceDefaults(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(
            self.engine,
            tables=[
                Company.__table__,
                Department.__table__,
                User.__table__,
                Permission.__table__,
                Role.__table__,
                RolePermission.__table__,
                UserRole.__table__,
                UserPermission.__table__,
                NotificationPreference.__table__,
                CompanyNotificationPolicy.__table__,
                Notification.__table__,
                NotificationRecipient.__table__,
            ],
        )
        self.SessionLocal = sessionmaker(bind=self.engine, class_=Session, expire_on_commit=False, future=True)

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_get_preferences_persists_default_record(self) -> None:
        with self.SessionLocal() as db:
            company = Company(code="c1", name="Company 1")
            user = User(company=company, name="User 1", username="user1")
            db.add_all([company, user])
            db.commit()
            user_id = int(user.id)

        with self.SessionLocal() as db:
            row = NotificationService().get_preferences(db, user_id=user_id)
            self.assertEqual(int(row.user_id), user_id)

        with self.SessionLocal() as db:
            persisted = db.execute(select(NotificationPreference).where(NotificationPreference.user_id == user_id)).scalars().first()
            self.assertIsNotNone(persisted)

    def test_get_company_policy_persists_default_record(self) -> None:
        with self.SessionLocal() as db:
            company = Company(code="c1", name="Company 1")
            db.add(company)
            db.commit()
            company_id = int(company.id)

        with self.SessionLocal() as db:
            row = NotificationService().get_company_policy(db, company_id=company_id)
            self.assertEqual(int(row.company_id), company_id)

        with self.SessionLocal() as db:
            persisted = db.execute(
                select(CompanyNotificationPolicy).where(CompanyNotificationPolicy.company_id == company_id)
            ).scalars().first()
            self.assertIsNotNone(persisted)

    def test_create_for_permission_does_not_crash_in_sync_context(self) -> None:
        with self.SessionLocal() as db:
            from app.db.seed import seed_rbac
            from app.models.rbac import Role

            seed_rbac(db)
            db.commit()

            company = db.execute(select(Company).where(Company.code == "default")).scalars().first()
            self.assertIsNotNone(company)
            manager_role = db.execute(select(Role).where(Role.key == "manager")).scalars().first()
            employee_role = db.execute(select(Role).where(Role.key == "employee")).scalars().first()
            self.assertIsNotNone(manager_role)
            self.assertIsNotNone(employee_role)

            manager = User(company_id=int(company.id), username="manager_sync", name="Manager Sync")
            manager.roles = [manager_role]
            employee = User(company_id=int(company.id), username="employee_sync", name="Employee Sync")
            employee.roles = [employee_role]
            db.add_all([manager, employee])
            db.commit()

            with patch("app.services.notifications.asyncio.get_running_loop", side_effect=RuntimeError):
                scheduled: list[object] = []

                def fake_run(fn):
                    scheduled.append(fn)

                with patch("app.services.notifications.from_thread.run", side_effect=fake_run):
                    notification_id = NotificationService().create_for_permission(
                        db,
                        company_id=int(company.id),
                        permission_key="leave.approve",
                        type="leave.created",
                        category="leave",
                        severity="info",
                        title="Leave created",
                        body="Test body",
                        entity_type="leave_request",
                        entity_id=1,
                        action_url="/leave",
                        created_by_user_id=int(employee.id),
                        exclude_user_ids=[int(employee.id)],
                    )

            self.assertGreater(notification_id, 0)
            self.assertGreaterEqual(len(scheduled), 1)
            persisted = db.execute(
                select(NotificationRecipient, Notification)
                .join(Notification, Notification.id == NotificationRecipient.notification_id)
                .where(NotificationRecipient.user_id == int(manager.id), Notification.id == int(notification_id))
            ).first()
            self.assertIsNotNone(persisted)

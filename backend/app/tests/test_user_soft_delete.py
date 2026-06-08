from __future__ import annotations

import unittest
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.v1.routes.users import hard_delete_user as route_hard_delete_user
from app.api.v1.routes.users import list_users as route_list_users
from app.api.v1.routes.users import restore_user as route_restore_user
from app.core.errors import FORBIDDEN, AppException
from app.models.base import Base
from app.models.company import Company
from app.models.user import User
from app.services.users import UserService


class TestUserSoftDelete(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(self.engine, tables=[Company.__table__, User.__table__])
        self.SessionLocal = sessionmaker(bind=self.engine, class_=Session, expire_on_commit=False, future=True)

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_soft_delete_filters_active_deleted_and_all(self) -> None:
        with self.SessionLocal() as db:
            company = Company(code="c1", name="C1")
            db.add(company)
            db.flush()
            svc = UserService()
            active = svc.create_user(db, company_id=company.id, name="Active User", code="NV001", email="a@x.com", create_login=False)
            deleted = svc.create_user(db, company_id=company.id, name="Deleted User", code="NV002", email="d@x.com", create_login=False)

            svc.delete_user(db, user_id=int(deleted.id), company_id=int(company.id))

            active_ids = [u.id for u in svc.list_users(db, company_id=int(company.id), deleted="active")]
            deleted_ids = [u.id for u in svc.list_users(db, company_id=int(company.id), deleted="deleted")]
            all_ids = [u.id for u in svc.list_users(db, company_id=int(company.id), deleted="all")]

        self.assertEqual(active_ids, [active.id])
        self.assertEqual(deleted_ids, [deleted.id])
        self.assertEqual(set(all_ids), {active.id, deleted.id})

    def test_manager_route_is_forced_to_active_filter(self) -> None:
        manager = SimpleNamespace(id=2, roles=[SimpleNamespace(key="manager")])
        with self.SessionLocal() as db:
            company = Company(code="c1", name="C1")
            db.add(company)
            db.flush()
            svc = UserService()
            active = svc.create_user(db, company_id=company.id, name="Active User", code="NV001", email="a@x.com", create_login=False)
            deleted = svc.create_user(db, company_id=company.id, name="Deleted User", code="NV002", email="d@x.com", create_login=False)
            svc.delete_user(db, user_id=int(deleted.id), company_id=int(company.id))

            res = route_list_users(
                q=None,
                limit=100,
                offset=0,
                deleted="all",
                db=db,
                company_id=int(company.id),
                current_user=manager,
            )

        self.assertIsNotNone(res.result)
        self.assertEqual([u.id for u in res.result or []], [active.id])

    def test_manager_cannot_hard_delete_user(self) -> None:
        manager = SimpleNamespace(id=2, roles=[SimpleNamespace(key="manager")])
        with self.SessionLocal() as db:
            with self.assertRaises(AppException) as ctx:
                route_hard_delete_user(user_id=1, db=db, company_id=1, current_user=manager)

        self.assertEqual(ctx.exception.error.code, FORBIDDEN.code)

    def test_admin_can_restore_soft_deleted_user(self) -> None:
        admin = SimpleNamespace(id=1, roles=[SimpleNamespace(key="admin")])
        with self.SessionLocal() as db:
            company = Company(code="c1", name="C1")
            db.add(company)
            db.flush()
            svc = UserService()
            user = svc.create_user(db, company_id=company.id, name="Deleted User", code="NV002", email="d@x.com", create_login=False)
            svc.delete_user(db, user_id=int(user.id), company_id=int(company.id))

            route_restore_user(user_id=int(user.id), db=db, company_id=int(company.id), current_user=admin)
            restored = db.get(User, int(user.id))

        self.assertIsNotNone(restored)
        self.assertIsNone(restored.deleted_at)
        self.assertEqual(restored.status, "active")
        self.assertEqual(restored.auth_status, "active")

    def test_manager_cannot_restore_soft_deleted_user(self) -> None:
        manager = SimpleNamespace(id=2, roles=[SimpleNamespace(key="manager")])
        with self.SessionLocal() as db:
            with self.assertRaises(AppException) as ctx:
                route_restore_user(user_id=1, db=db, company_id=1, current_user=manager)

        self.assertEqual(ctx.exception.error.code, FORBIDDEN.code)


if __name__ == "__main__":
    unittest.main()

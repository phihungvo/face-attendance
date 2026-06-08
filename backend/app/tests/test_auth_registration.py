from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from starlette.requests import Request

from app.api.v1.routes.settings import get_auth_registration_settings, update_auth_registration_settings
from app.api.v1.routes.auth import config, register
from app.core.errors import AUTH_PUBLIC_REGISTRATION_DISABLED, BAD_REQUEST, FORBIDDEN, AppException
from app.core.settings import settings
from app.models.app_setting import AppSetting
from app.models.base import Base
from app.models.company import Company
from app.models.department import Department
from app.models.rbac import Permission, Role, UserPermission, UserRole
from app.models.user import User
from app.schemas.auth import RegisterRequest
from app.schemas.settings import AuthRegistrationSettingsUpdateRequest


class TestAuthRegistrationConfig(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(
            self.engine,
            tables=[
                AppSetting.__table__,
                Company.__table__,
                Department.__table__,
                User.__table__,
                Permission.__table__,
                Role.__table__,
                UserRole.__table__,
                UserPermission.__table__,
            ],
        )
        self.SessionLocal = sessionmaker(bind=self.engine, class_=Session, expire_on_commit=False, future=True)

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_auth_config_defaults_to_company_invite_mode(self) -> None:
        with self.SessionLocal() as db, patch.object(settings, "AUTH_PUBLIC_REGISTRATION_ENABLED", False):
            res = config(db=db)

        self.assertIsNotNone(res.result)
        self.assertFalse(res.result.public_registration_enabled)
        self.assertEqual(res.result.account_onboarding_mode, "company_invite")

    def test_auth_config_reports_public_register_mode_when_enabled(self) -> None:
        with self.SessionLocal() as db, patch.object(settings, "AUTH_PUBLIC_REGISTRATION_ENABLED", True):
            res = config(db=db)

        self.assertIsNotNone(res.result)
        self.assertTrue(res.result.public_registration_enabled)
        self.assertEqual(res.result.account_onboarding_mode, "public_register")

    def test_auth_config_uses_db_override(self) -> None:
        with self.SessionLocal() as db, patch.object(settings, "AUTH_PUBLIC_REGISTRATION_ENABLED", False):
            db.add(AppSetting(setting_key="auth.public_registration_enabled", setting_value="1"))
            db.commit()
            res = config(db=db)

        self.assertIsNotNone(res.result)
        self.assertTrue(res.result.public_registration_enabled)
        self.assertEqual(res.result.account_onboarding_mode, "public_register")

    def test_register_rejects_when_public_registration_disabled(self) -> None:
        request = Request({"type": "http", "client": ("127.0.0.1", 12345), "headers": []})
        payload = RegisterRequest(username="newuser", password="strongpass1")

        with self.SessionLocal() as db, patch.object(settings, "AUTH_PUBLIC_REGISTRATION_ENABLED", False):
            with self.assertRaises(AppException) as ctx:
                register(payload, request, db=db)

        self.assertEqual(ctx.exception.error.code, AUTH_PUBLIC_REGISTRATION_DISABLED.code)

    def test_register_succeeds_when_public_registration_enabled_by_admin_setting(self) -> None:
        request = Request({"type": "http", "client": ("127.0.0.1", 12346), "headers": []})
        payload = RegisterRequest(username="newuser", password="strongpass1")

        with self.SessionLocal() as db, patch.object(settings, "AUTH_PUBLIC_REGISTRATION_ENABLED", False):
            db.add(AppSetting(setting_key="auth.public_registration_enabled", setting_value="1"))
            employee_role = Role(key="employee", label="Employee")
            db.add(employee_role)
            db.commit()

            res = register(payload, request, db=db)
            user = db.query(User).filter(User.username == "newuser").one()
            role_keys = [role.key for role in user.roles]
            company_id = user.company_id

        self.assertIsNotNone(res.result)
        self.assertTrue(res.result.access_token)
        self.assertIsNone(company_id)
        self.assertEqual(role_keys, ["employee"])

    def test_register_maps_weak_password_error_to_api_exception(self) -> None:
        request = Request({"type": "http", "client": ("127.0.0.1", 12347), "headers": []})
        payload = RegisterRequest(username="newuser", password="12345678")

        with self.SessionLocal() as db, patch.object(settings, "AUTH_PUBLIC_REGISTRATION_ENABLED", True):
            with self.assertRaises(AppException) as ctx:
                register(payload, request, db=db)

        self.assertEqual(ctx.exception.error.code, BAD_REQUEST.code)
        self.assertEqual(ctx.exception.detail, "Mật khẩu phải chứa ít nhất 1 chữ cái")

    def test_admin_can_update_auth_registration_setting(self) -> None:
        admin = SimpleNamespace(id=1, roles=[SimpleNamespace(key="admin")])
        with self.SessionLocal() as db:
            res = update_auth_registration_settings(
                AuthRegistrationSettingsUpdateRequest(public_registration_enabled=True),
                db=db,
                user=admin,
            )
            public = get_auth_registration_settings(db=db, user=admin)

        self.assertIsNotNone(res.result)
        self.assertTrue(res.result.public_registration_enabled)
        self.assertIsNotNone(public.result)
        self.assertTrue(public.result.public_registration_enabled)

    def test_manager_cannot_update_auth_registration_setting(self) -> None:
        manager = SimpleNamespace(id=2, roles=[SimpleNamespace(key="manager")])
        with self.SessionLocal() as db:
            with self.assertRaises(AppException) as ctx:
                update_auth_registration_settings(
                    AuthRegistrationSettingsUpdateRequest(public_registration_enabled=True),
                    db=db,
                    user=manager,
                )

        self.assertEqual(ctx.exception.error.code, FORBIDDEN.code)


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import unittest
from unittest.mock import patch

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.settings import settings
from app.db.migrate import run_lightweight_migrations
from app.db.seed import seed_rbac
from app.models.attendance_policy import AttendancePolicy
from app.models.base import Base
from app.models.company import Company
from app.models.company_attendance_policy import CompanyAttendancePolicy
from app.models.notification import CompanyNotificationPolicy
from app.models.rbac import Permission, Role, RolePermission, UserPermission, UserRole
from app.models.user import User
from app.repositories.attendance_policy import AttendancePolicyRepository


class TestStartupBootstrap(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(
            self.engine,
            tables=[
                Company.__table__,
                AttendancePolicy.__table__,
                CompanyAttendancePolicy.__table__,
                User.__table__,
                Permission.__table__,
                Role.__table__,
                RolePermission.__table__,
                UserRole.__table__,
                UserPermission.__table__,
                CompanyNotificationPolicy.__table__,
            ],
        )
        self.SessionLocal = sessionmaker(bind=self.engine, class_=Session, expire_on_commit=False, future=True)

    def tearDown(self) -> None:
        self.engine.dispose()

    @staticmethod
    def _sqlite_safe_company_policy(repo: AttendancePolicyRepository, db: Session, *, company_id: int) -> CompanyAttendancePolicy:
        row = db.get(CompanyAttendancePolicy, int(company_id))
        if row is not None:
            return row

        base = repo.get_default_or_create(db)
        row = CompanyAttendancePolicy(
            company_id=int(company_id),
            timezone=base.timezone,
            face_match_threshold=float(base.face_match_threshold),
            shift_start=base.shift_start,
            shift_end=base.shift_end,
            late_grace_minutes=int(base.late_grace_minutes),
            early_leave_grace_minutes=int(base.early_leave_grace_minutes),
            break_start=base.break_start,
            break_end=base.break_end,
            break_duration_minutes=int(base.break_duration_minutes),
            break_threshold_hours=float(base.break_threshold_hours),
            auto_checkout_time=base.auto_checkout_time,
            checkin_from=base.checkin_from,
            checkin_to=base.checkin_to,
            checkout_from=base.checkout_from,
            checkout_to=base.checkout_to,
            min_minutes_between_same_type=int(base.min_minutes_between_same_type),
        )
        db.add(row)
        db.flush()
        return row

    def test_seed_rbac_creates_only_admin_and_foundational_default_rows_by_default(self) -> None:
        with self.SessionLocal() as db:
            with patch.object(settings, "BOOTSTRAP_TEST_USERS_ENABLED", False), patch.object(
                AttendancePolicyRepository,
                "get_or_create_for_company",
                autospec=True,
                side_effect=self._sqlite_safe_company_policy,
            ):
                seed_rbac(db)
                db.commit()

            company = db.execute(select(Company).where(Company.code == "default")).scalars().first()
            self.assertIsNotNone(company)

            admin = db.execute(select(User).where(User.username == settings.BOOTSTRAP_ADMIN_USERNAME)).scalars().first()
            self.assertIsNotNone(admin)

            manager = db.execute(select(User).where(User.username == settings.BOOTSTRAP_MANAGER_USERNAME)).scalars().first()
            employee = db.execute(select(User).where(User.username == settings.BOOTSTRAP_EMPLOYEE_USERNAME)).scalars().first()
            self.assertIsNone(manager)
            self.assertIsNone(employee)

            global_policy = db.get(AttendancePolicy, 1)
            company_policy = db.get(CompanyAttendancePolicy, int(company.id))
            notification_policy = db.execute(
                select(CompanyNotificationPolicy).where(CompanyNotificationPolicy.company_id == int(company.id))
            ).scalars().first()
            manager_role = db.execute(select(Role).where(Role.key == "manager")).scalars().first()
            employee_role = db.execute(select(Role).where(Role.key == "employee")).scalars().first()
            self.assertIsNotNone(global_policy)
            self.assertIsNotNone(company_policy)
            self.assertIsNotNone(notification_policy)
            self.assertIsNotNone(manager_role)
            self.assertIsNotNone(employee_role)
            manager_perm_keys = {perm.key for perm in getattr(manager_role, "permissions", [])}
            employee_perm_keys = {perm.key for perm in getattr(employee_role, "permissions", [])}
            self.assertIn("employees.manage", manager_perm_keys)
            self.assertIn("departments.manage", manager_perm_keys)
            self.assertIn("leave.manage", manager_perm_keys)
            self.assertIn("settings.manage", manager_perm_keys)
            self.assertNotIn("employees.manage", employee_perm_keys)

    def test_seed_rbac_can_create_test_users_when_explicitly_enabled(self) -> None:
        with self.SessionLocal() as db:
            with patch.object(settings, "BOOTSTRAP_TEST_USERS_ENABLED", True), patch.object(
                AttendancePolicyRepository,
                "get_or_create_for_company",
                autospec=True,
                side_effect=self._sqlite_safe_company_policy,
            ):
                seed_rbac(db)
                db.commit()

            manager = db.execute(select(User).where(User.username == settings.BOOTSTRAP_MANAGER_USERNAME)).scalars().first()
            employee = db.execute(select(User).where(User.username == settings.BOOTSTRAP_EMPLOYEE_USERNAME)).scalars().first()
            self.assertIsNotNone(manager)
            self.assertIsNotNone(employee)

    def test_lightweight_migrations_backfill_new_policy_columns_for_legacy_tables(self) -> None:
        missing_columns = {
            ("attendance_policies", "checkin_from"),
            ("attendance_policies", "checkin_to"),
            ("attendance_policies", "checkout_from"),
            ("attendance_policies", "checkout_to"),
            ("attendance_policies", "min_minutes_between_same_type"),
            ("company_attendance_policies", "checkin_from"),
            ("company_attendance_policies", "checkin_to"),
            ("company_attendance_policies", "checkout_from"),
            ("company_attendance_policies", "checkout_to"),
            ("company_attendance_policies", "min_minutes_between_same_type"),
        }
        executed_sql: list[str] = []

        def fake_column_exists(_engine, *, table: str, column: str, schema: str) -> bool:
            del schema
            return (table, column) not in missing_columns

        def fake_table_exists(_engine, *, table: str, schema: str) -> bool:
            del schema
            return True

        def fake_get_column_meta(_engine, *, table: str, column: str, schema: str) -> dict[str, object] | None:
            del schema
            if table == "notifications" and column == "body":
                return {"COLUMN_TYPE": "text", "IS_NULLABLE": "YES", "COLUMN_DEFAULT": None}
            if table == "notifications" and column == "user_id":
                return {"COLUMN_TYPE": "int(11)", "IS_NULLABLE": "YES", "COLUMN_DEFAULT": None}
            return {"COLUMN_TYPE": "varchar(64)", "IS_NULLABLE": "NO", "COLUMN_DEFAULT": "CURRENT_TIMESTAMP"}

        def fake_exec(_engine, sql: str) -> None:
            executed_sql.append(sql)

        with patch("app.db.migrate._column_exists", side_effect=fake_column_exists), patch(
            "app.db.migrate._table_exists", side_effect=fake_table_exists
        ), patch("app.db.migrate._index_exists", return_value=True), patch(
            "app.db.migrate._list_unique_single_column_indexes", return_value=[]
        ), patch(
            "app.db.migrate._get_column_meta", side_effect=fake_get_column_meta
        ), patch(
            "app.db.migrate._exec", side_effect=fake_exec
        ):
            run_lightweight_migrations(object(), schema="face_attendance")

        sql_blob = "\n".join(executed_sql)
        self.assertIn("ALTER TABLE attendance_policies ADD COLUMN checkin_from", sql_blob)
        self.assertIn("ALTER TABLE attendance_policies ADD COLUMN min_minutes_between_same_type", sql_blob)
        self.assertIn("ALTER TABLE company_attendance_policies ADD COLUMN checkin_from", sql_blob)
        self.assertIn("ALTER TABLE company_attendance_policies ADD COLUMN min_minutes_between_same_type", sql_blob)

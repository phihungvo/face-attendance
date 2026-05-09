from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.core.settings import settings
from app.models.company import Company
from app.models.rbac import Permission, Role
from app.models.user import User


PERMISSIONS: list[tuple[str, str]] = [
    ("dashboard.read", "Xem dashboard"),
    ("attendance.read", "Xem chấm công"),
    ("attendance.manage", "Quản lý chấm công"),
    ("timesheet.read", "Xem bảng giờ công"),
    ("employees.read", "Xem nhân viên"),
    ("departments.read", "Xem phòng ban"),
    ("leave.read", "Xem nghỉ phép"),
    ("leave.approve", "Duyệt nghỉ phép"),
    ("reports.read", "Xem báo cáo"),
    ("overtime.read", "Xem tăng ca"),
    ("overtime.approve", "Duyệt tăng ca"),
    ("payroll.read", "Xem bảng lương"),
    ("notifications.read", "Xem thông báo"),
    ("settings.read", "Xem cài đặt"),
    ("iam.manage", "Quản lý phân quyền (IAM)"),
    ("companies.read", "Xem danh sách công ty"),
    ("companies.manage", "Quản lý công ty"),
    ("employee.portal", "Truy cập cổng nhân viên"),
]


def _ensure_default_company(db: Session) -> Company:
    code = settings.BOOTSTRAP_ADMIN_COMPANY_CODE.strip() or "default"
    name = settings.BOOTSTRAP_ADMIN_COMPANY_NAME.strip() or "Default Company"
    company = db.execute(select(Company).where(Company.code == code)).scalars().first()
    if company is None:
        company = Company(code=code, name=name, status="active")
        db.add(company)
        db.flush()
    return company


def _ensure_admin_role(db: Session) -> Role:
    perms = list(db.execute(select(Permission)).scalars().all())
    role = db.execute(select(Role).where(Role.key == "admin")).scalars().first()
    if role is None:
        role = Role(key="admin", label="Admin", description="Toàn quyền hệ thống")
        db.add(role)
        db.flush()
    role.permissions = perms
    return role


def _ensure_bootstrap_admin(db: Session, *, company: Company, admin_role: Role) -> None:
    username = settings.BOOTSTRAP_ADMIN_USERNAME.strip() or "admin"
    password = settings.BOOTSTRAP_ADMIN_PASSWORD
    user = db.execute(select(User).where(User.username == username)).scalars().first()
    if user is None:
        user = User(
            company_id=company.id,
            username=username,
            password_hash=hash_password(password),
            auth_status="active",
            name="System Admin",
            status="active",
        )
        user.roles = [admin_role]
        db.add(user)
        db.flush()
        return
    # backfill missing company/roles for existing bootstrap user
    if getattr(user, "company_id", None) is None:
        user.company_id = company.id
    if not any(getattr(r, "key", "") == "admin" for r in getattr(user, "roles", []) or []):
        user.roles = list(getattr(user, "roles", []) or []) + [admin_role]
    if not getattr(user, "password_hash", None):
        user.password_hash = hash_password(password)
    if getattr(user, "auth_status", None) != "active":
        user.auth_status = "active"
    db.add(user)


def _ensure_bootstrap_user(db: Session, *, company: Company, username: str, password: str, role: Role, display_name: str) -> None:
    username = username.strip()
    if not username:
        return
    user = db.execute(select(User).where(User.username == username)).scalars().first()
    if user is None:
        user = User(
            company_id=company.id,
            username=username,
            password_hash=hash_password(password),
            auth_status="active",
            name=display_name,
            status="active",
        )
        user.roles = [role]
        db.add(user)
        db.flush()
        return
    if getattr(user, "company_id", None) is None:
        user.company_id = company.id
    if not any(getattr(r, "key", "") == getattr(role, "key", "") for r in getattr(user, "roles", []) or []):
        user.roles = list(getattr(user, "roles", []) or []) + [role]
    if not getattr(user, "password_hash", None):
        user.password_hash = hash_password(password)
    if getattr(user, "auth_status", None) != "active":
        user.auth_status = "active"
    db.add(user)


def seed_rbac(db: Session) -> None:
    existing_perm_keys = set(db.execute(select(Permission.key)).scalars().all())
    for key, label in PERMISSIONS:
        if key in existing_perm_keys:
            continue
        db.add(Permission(key=key, label=label))
    db.flush()

    perms_by_key = {p.key: p for p in db.execute(select(Permission)).scalars().all()}

    def ensure_role(key: str, label: str, perm_keys: list[str]) -> Role:
        role = db.execute(select(Role).where(Role.key == key)).scalars().first()
        if role is None:
            role = Role(key=key, label=label)
            db.add(role)
            db.flush()
        role.permissions = [perms_by_key[k] for k in perm_keys if k in perms_by_key]
        return role

    # Manager: vận hành theo công ty, không quản lý hệ thống/IAM/công ty.
    manager_perm_keys = [k for k, _ in PERMISSIONS if k not in {"employee.portal", "iam.manage", "companies.manage", "companies.read"}]
    employee_perm_keys = ["employee.portal", "notifications.read", "settings.read"]

    ensure_role("manager", "Quản lý", manager_perm_keys)
    ensure_role("employee", "Nhân viên", employee_perm_keys)
    # Admin: full permissions (including IAM + companies)
    admin_role = _ensure_admin_role(db)
    manager_role = db.execute(select(Role).where(Role.key == "manager")).scalars().first()
    employee_role = db.execute(select(Role).where(Role.key == "employee")).scalars().first()

    # Ensure default company + bootstrap admin account.
    company = _ensure_default_company(db)
    _ensure_bootstrap_admin(db, company=company, admin_role=admin_role)

    # Optional bootstrap manager/employee accounts for testing (from env).
    if manager_role is not None:
        _ensure_bootstrap_user(
            db,
            company=company,
            username=settings.BOOTSTRAP_MANAGER_USERNAME,
            password=settings.BOOTSTRAP_MANAGER_PASSWORD,
            role=manager_role,
            display_name="Manager",
        )
    if employee_role is not None:
        _ensure_bootstrap_user(
            db,
            company=company,
            username=settings.BOOTSTRAP_EMPLOYEE_USERNAME,
            password=settings.BOOTSTRAP_EMPLOYEE_PASSWORD,
            role=employee_role,
            display_name="Employee",
        )

    # Best-effort backfill company_id for existing rows (legacy single-company DB).
    try:
        db.query(User).filter(User.company_id.is_(None)).update({User.company_id: company.id})  # type: ignore[attr-defined]
        from app.models.department import Department

        db.query(Department).filter(Department.company_id.is_(None)).update({Department.company_id: company.id})  # type: ignore[attr-defined]
    except Exception:
        pass

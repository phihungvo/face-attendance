from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

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
    ("employee.portal", "Truy cập cổng nhân viên"),
]


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

    manager_perm_keys = [k for k, _ in PERMISSIONS if k != "employee.portal"]
    employee_perm_keys = ["employee.portal", "notifications.read", "settings.read"]

    ensure_role("manager", "Quản lý", manager_perm_keys)
    ensure_role("employee", "Nhân viên", employee_perm_keys)
    # admin reserved for later

    # Backfill: ensure default admin account (if exists) has manager role so UI is usable.
    admin_user = db.execute(select(User).where(User.username == "admin")).scalars().first()
    if admin_user is not None and len(getattr(admin_user, "roles", []) or []) == 0:
        mgr = db.execute(select(Role).where(Role.key == "manager")).scalars().first()
        if mgr is not None:
            admin_user.roles = [mgr]
            db.add(admin_user)

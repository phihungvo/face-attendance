from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_permission
from app.core.errors import BAD_REQUEST, AppException
from app.core.response import ok
from app.db.session import get_db
from app.models.rbac import Permission, Role
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.iam import (
    AccountCreateRequest,
    AccountOut,
    AccountUpdateRequest,
    PermissionOut,
    RoleCreateRequest,
    RoleOut,
    RoleUpdateRequest,
)
from app.services.auth import AuthService
from app.services.notifications import NotificationService

router = APIRouter()
auth_service = AuthService()
notification_service = NotificationService()


@router.get("/permissions", response_model=ApiResponse[list[PermissionOut]])
def list_permissions(
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("iam.manage")),
) -> ApiResponse[list[PermissionOut]]:
    items = list(db.execute(select(Permission).order_by(Permission.key.asc())).scalars().all())
    return ok(items)


@router.get("/roles", response_model=ApiResponse[list[RoleOut]])
def list_roles(
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("iam.manage")),
) -> ApiResponse[list[RoleOut]]:
    roles = list(db.execute(select(Role).order_by(Role.key.asc())).scalars().all())
    out: list[RoleOut] = []
    for r in roles:
        out.append(RoleOut(id=r.id, key=r.key, label=r.label, description=r.description, permission_keys=[p.key for p in r.permissions]))
    return ok(out)


@router.post("/roles", response_model=ApiResponse[RoleOut])
def create_role(
    payload: RoleCreateRequest,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("iam.manage")),
) -> ApiResponse[RoleOut]:
    if db.execute(select(Role).where(Role.key == payload.key)).scalars().first() is not None:
        raise AppException(BAD_REQUEST, detail="Role key đã tồn tại")
    perms = list(db.execute(select(Permission).where(Permission.key.in_(payload.permission_keys))).scalars().all()) if payload.permission_keys else []
    role = Role(key=payload.key, label=payload.label, description=payload.description)
    role.permissions = perms
    db.add(role)
    db.commit()
    db.refresh(role)
    return ok(RoleOut(id=role.id, key=role.key, label=role.label, description=role.description, permission_keys=[p.key for p in role.permissions]))


@router.put("/roles/{role_id}", response_model=ApiResponse[RoleOut])
def update_role(
    role_id: int,
    payload: RoleUpdateRequest,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("iam.manage")),
) -> ApiResponse[RoleOut]:
    role = db.get(Role, role_id)
    if role is None:
        raise AppException(BAD_REQUEST, detail="Role không tồn tại")
    role.label = payload.label
    role.description = payload.description
    role.permissions = list(db.execute(select(Permission).where(Permission.key.in_(payload.permission_keys))).scalars().all()) if payload.permission_keys else []
    db.add(role)
    db.commit()
    db.refresh(role)
    return ok(RoleOut(id=role.id, key=role.key, label=role.label, description=role.description, permission_keys=[p.key for p in role.permissions]))


@router.delete("/roles/{role_id}", response_model=ApiResponse[dict[str, object]])
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("iam.manage")),
) -> ApiResponse[dict[str, object]]:
    role = db.get(Role, role_id)
    if role is None:
        raise AppException(BAD_REQUEST, detail="Role không tồn tại")
    db.delete(role)
    db.commit()
    return ok({"deleted": True})


@router.get("/users", response_model=ApiResponse[list[AccountOut]])
@router.get("/accounts", response_model=ApiResponse[list[AccountOut]])
def list_iam_users(
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("iam.manage")),
) -> ApiResponse[list[AccountOut]]:
    users = list(db.execute(select(User).where(User.username.is_not(None)).order_by(User.id.desc())).scalars().all())
    out: list[AccountOut] = []
    for u in users:
        role_keys = [r.key for r in u.roles]
        perm_keys = sorted({p.key for p in u.permissions} | {p.key for r in u.roles for p in r.permissions})
        out.append(AccountOut(id=u.id, username=u.username or "", role_keys=role_keys, permission_keys=perm_keys))
    return ok(out)


@router.post("/users", response_model=ApiResponse[AccountOut])
@router.post("/accounts", response_model=ApiResponse[AccountOut])
def create_iam_user(
    payload: AccountCreateRequest,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("iam.manage")),
) -> ApiResponse[AccountOut]:
    token = auth_service.register(db, username=payload.username, password=payload.password, role_key=(payload.role_keys[0] if payload.role_keys else "employee"))
    # token not returned here; just for creation
    _ = token
    user = db.execute(select(User).where(User.username == payload.username)).scalars().first()
    if user is None:
        raise AppException(BAD_REQUEST, detail="Không thể tạo account")
    # assign extra roles if provided
    if payload.role_keys:
        roles = list(db.execute(select(Role).where(Role.key.in_(payload.role_keys))).scalars().all())
        user.roles = roles
        db.add(user)
        db.commit()
        db.refresh(user)
    role_keys = [r.key for r in user.roles]
    perm_keys = sorted({p.key for p in user.permissions} | {p.key for r in user.roles for p in r.permissions})
    return ok(AccountOut(id=user.id, username=user.username or "", role_keys=role_keys, permission_keys=perm_keys))


@router.put("/users/{user_id}", response_model=ApiResponse[AccountOut])
@router.put("/accounts/{user_id}", response_model=ApiResponse[AccountOut])
def update_iam_user(
    user_id: int,
    payload: AccountUpdateRequest,
    db: Session = Depends(get_db),
    actor=Depends(get_current_user),
    _: object = Depends(require_permission("iam.manage")),
) -> ApiResponse[AccountOut]:
    user = db.get(User, user_id)
    if user is None or not user.username:
        raise AppException(BAD_REQUEST, detail="Account không tồn tại")
    before_roles = sorted([r.key for r in user.roles])
    before_perms = sorted({p.key for p in user.permissions} | {p.key for r in user.roles for p in r.permissions})
    user.roles = list(db.execute(select(Role).where(Role.key.in_(payload.role_keys))).scalars().all()) if payload.role_keys else []
    user.permissions = list(db.execute(select(Permission).where(Permission.key.in_(payload.permission_keys))).scalars().all()) if payload.permission_keys else []
    db.add(user)
    db.commit()
    db.refresh(user)
    role_keys = [r.key for r in user.roles]
    perm_keys = sorted({p.key for p in user.permissions} | {p.key for r in user.roles for p in r.permissions})
    if before_roles != sorted(role_keys) or before_perms != perm_keys:
        try:
            notification_service.create_for_users(
                db,
                company_id=int(getattr(user, "company_id", 0) or 0) or None,
                type="user.permissions.changed",
                category="iam",
                severity="warning",
                title="Quyền truy cập của bạn vừa được thay đổi",
                body="Vai trò hoặc quyền truy cập của bạn đã được cập nhật bởi quản trị viên.",
                entity_type="user",
                entity_id=int(user.id),
                action_url="/employee/profile" if "employee" in role_keys else "/",
                created_by_user_id=int(actor.id),
                user_ids=[int(user.id)],
            )
        except Exception:
            pass
    return ok(AccountOut(id=user.id, username=user.username or "", role_keys=role_keys, permission_keys=perm_keys))


@router.delete("/users/{user_id}", response_model=ApiResponse[dict[str, object]])
@router.delete("/accounts/{user_id}", response_model=ApiResponse[dict[str, object]])
def delete_iam_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("iam.manage")),
) -> ApiResponse[dict[str, object]]:
    user = db.get(User, user_id)
    if user is None or not user.username:
        raise AppException(BAD_REQUEST, detail="Account không tồn tại")
    # Only delete login access; keep employee record if any business data exists.
    # For safety in this project (face embeddings, attendance logs...), we just remove auth fields + RBAC.
    user.roles = []
    user.permissions = []
    user.username = None
    user.password_hash = None
    db.add(user)
    db.commit()
    return ok({"deleted": True})

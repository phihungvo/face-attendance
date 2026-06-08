from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.errors import (
    AUTH_ACCOUNT_DISABLED,
    AUTH_ACCOUNT_PENDING,
    AUTH_IDENTIFIER_AMBIGUOUS,
    AUTH_INVALID_CREDENTIALS,
    AUTH_PUBLIC_REGISTRATION_DISABLED,
    BAD_REQUEST,
    AppException,
)
from app.core.response import ok
from app.core.settings import settings
from app.core.throttling import failed_attempt_limiter, get_client_ip, request_rate_limiter
from app.db.session import get_db
from app.schemas.auth import ActivateRequest, AuthConfigResponse, ChangePasswordRequest, LoginRequest, MeResponse, RegisterRequest, TokenResponse
from app.schemas.common import ApiResponse
from app.core.security import get_token_subject
from app.models.user import User
from app.services.auth import AuthService
from app.api.deps import get_current_user
from app.services.notifications import NotificationService
from app.services.settings import SettingsService

router = APIRouter()
service = AuthService()
notification_service = NotificationService()
settings_service = SettingsService()


@router.get("/config", response_model=ApiResponse[AuthConfigResponse])
def config(db: Session = Depends(get_db)) -> ApiResponse[AuthConfigResponse]:
    return ok(AuthConfigResponse(**settings_service.get_auth_registration_settings(db)))


@router.post("/register", response_model=ApiResponse[TokenResponse])
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)) -> ApiResponse[TokenResponse]:
    request_rate_limiter.hit(
        scope="auth-register",
        key=get_client_ip(request),
        limit=int(settings.AUTH_WRITE_MAX_ATTEMPTS),
        window_seconds=int(settings.AUTH_WRITE_WINDOW_SECONDS),
        block_seconds=int(settings.AUTH_WRITE_BLOCK_SECONDS),
        detail="Bạn gửi yêu cầu đăng ký quá nhiều. Vui lòng thử lại sau.",
    )
    if not settings_service.get_public_registration_enabled(db):
        raise AppException(AUTH_PUBLIC_REGISTRATION_DISABLED)
    try:
        token = service.register(db, username=payload.username, password=payload.password, role_key="employee")
    except ValueError as exc:
        raise AppException(BAD_REQUEST, detail=str(exc))
    return ok(TokenResponse(access_token=token))


@router.post("/login", response_model=ApiResponse[TokenResponse])
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> ApiResponse[TokenResponse]:
    identifier = payload.identifier.strip()
    limiter_key = f"{get_client_ip(request)}:{identifier.casefold()}"
    failed_attempt_limiter.ensure_allowed(
        scope="auth-login",
        key=limiter_key,
        max_failures=int(settings.LOGIN_MAX_FAILURES),
        window_seconds=int(settings.LOGIN_WINDOW_SECONDS),
        block_seconds=int(settings.LOGIN_BLOCK_SECONDS),
        detail="Bạn đăng nhập sai quá nhiều lần. Vui lòng thử lại sau.",
    )
    try:
        token = service.login(db, identifier=identifier, password=payload.password)
    except AppException as exc:
        if exc.error.code in {
            AUTH_INVALID_CREDENTIALS.code,
            AUTH_IDENTIFIER_AMBIGUOUS.code,
            AUTH_ACCOUNT_PENDING.code,
            AUTH_ACCOUNT_DISABLED.code,
        }:
            failed_attempt_limiter.record_failure(
                scope="auth-login",
                key=limiter_key,
                max_failures=int(settings.LOGIN_MAX_FAILURES),
                window_seconds=int(settings.LOGIN_WINDOW_SECONDS),
                block_seconds=int(settings.LOGIN_BLOCK_SECONDS),
            )
        raise
    failed_attempt_limiter.reset(scope="auth-login", key=limiter_key)
    return ok(TokenResponse(access_token=token))

@router.post("/activate", response_model=ApiResponse[TokenResponse])
def activate(payload: ActivateRequest, request: Request, db: Session = Depends(get_db)) -> ApiResponse[TokenResponse]:
    limiter_key = get_client_ip(request)
    failed_attempt_limiter.ensure_allowed(
        scope="auth-activate",
        key=limiter_key,
        max_failures=int(settings.AUTH_WRITE_MAX_ATTEMPTS),
        window_seconds=int(settings.AUTH_WRITE_WINDOW_SECONDS),
        block_seconds=int(settings.AUTH_WRITE_BLOCK_SECONDS),
        detail="Bạn gửi yêu cầu kích hoạt quá nhiều. Vui lòng thử lại sau.",
    )
    try:
        token = service.activate_with_token(db, token=payload.token, password=payload.password)
    except AppException:
        failed_attempt_limiter.record_failure(
            scope="auth-activate",
            key=limiter_key,
            max_failures=int(settings.AUTH_WRITE_MAX_ATTEMPTS),
            window_seconds=int(settings.AUTH_WRITE_WINDOW_SECONDS),
            block_seconds=int(settings.AUTH_WRITE_BLOCK_SECONDS),
        )
        raise
    failed_attempt_limiter.reset(scope="auth-activate", key=limiter_key)
    try:
        subject = get_token_subject(token)
        user = db.get(User, int(subject)) if subject is not None else None
        if user is not None:
            notification_service.create_for_users(
                db,
                company_id=int(getattr(user, "company_id", 0) or 0) or None,
                type="user.account.activated",
                category="iam",
                severity="success",
                title="Tài khoản của bạn đã được kích hoạt",
                body="Bạn đã có thể sử dụng đầy đủ các chức năng được phân quyền.",
                entity_type="user",
                entity_id=int(user.id),
                action_url="/employee/profile" if "employee" in [r.key for r in getattr(user, "roles", [])] else "/",
                created_by_user_id=int(user.id),
                user_ids=[int(user.id)],
            )
        if user is not None and getattr(user, "company_id", None) is not None:
            notification_service.create_for_permission(
                db,
                company_id=int(user.company_id),
                permission_key="notifications.read",
                type="user.account.activated",
                category="iam",
                severity="success",
                title=f"Tài khoản {getattr(user, 'name', getattr(user, 'username', 'người dùng'))} đã kích hoạt",
                body="Người dùng đã hoàn tất bước kích hoạt tài khoản.",
                entity_type="user",
                entity_id=int(user.id),
                action_url="/employees",
                created_by_user_id=int(user.id),
                exclude_user_ids=[int(user.id)],
            )
    except Exception:
        pass
    return ok(TokenResponse(access_token=token))

@router.post("/change-password", response_model=ApiResponse[dict[str, object]])
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> ApiResponse[dict[str, object]]:
    if payload.current_password == payload.new_password:
        raise AppException(BAD_REQUEST, detail="Mật khẩu mới phải khác mật khẩu hiện tại")
    limiter_key = f"{get_client_ip(request)}:{int(user.id)}"
    failed_attempt_limiter.ensure_allowed(
        scope="auth-change-password",
        key=limiter_key,
        max_failures=int(settings.AUTH_WRITE_MAX_ATTEMPTS),
        window_seconds=int(settings.AUTH_WRITE_WINDOW_SECONDS),
        block_seconds=int(settings.AUTH_WRITE_BLOCK_SECONDS),
        detail="Bạn đổi mật khẩu thất bại quá nhiều lần. Vui lòng thử lại sau.",
    )
    try:
        service.change_password(db, user_id=int(user.id), current_password=payload.current_password, new_password=payload.new_password)
        failed_attempt_limiter.reset(scope="auth-change-password", key=limiter_key)
        try:
            notification_service.create_for_users(
                db,
                company_id=int(getattr(user, "company_id", 0) or 0) or None,
                type="user.password.changed",
                category="iam",
                severity="info",
                title="Mật khẩu của bạn vừa được thay đổi",
                body="Nếu đây không phải là bạn, hãy liên hệ quản trị viên ngay.",
                entity_type="user",
                entity_id=int(user.id),
                action_url="/change-password" if "employee" not in [r.key for r in getattr(user, "roles", [])] else "/employee/change-password",
                created_by_user_id=int(user.id),
                user_ids=[int(user.id)],
            )
        except Exception:
            pass
    except AppException:
        failed_attempt_limiter.record_failure(
            scope="auth-change-password",
            key=limiter_key,
            max_failures=int(settings.AUTH_WRITE_MAX_ATTEMPTS),
            window_seconds=int(settings.AUTH_WRITE_WINDOW_SECONDS),
            block_seconds=int(settings.AUTH_WRITE_BLOCK_SECONDS),
        )
        raise
    except Exception as e:
        raise AppException(BAD_REQUEST, detail=str(e))
    return ok({"changed": True})


@router.get("/me", response_model=ApiResponse[MeResponse])
def me(
    user=Depends(get_current_user),
) -> ApiResponse[MeResponse]:
    role_keys = [r.key for r in getattr(user, "roles", [])]
    perm_keys = set()
    for r in getattr(user, "roles", []):
        for p in getattr(r, "permissions", []):
            perm_keys.add(p.key)
    for p in getattr(user, "permissions", []):
        perm_keys.add(p.key)
    company = getattr(user, "company", None)
    return ok(
        MeResponse(
            user_id=user.id,
            username=user.username or "",
            company_id=getattr(user, "company_id", None),
            company_name=getattr(company, "name", None) if company is not None else None,
            company_logo_data_url=getattr(company, "logo_data_url", None) if company is not None else None,
            role_keys=role_keys,
            permission_keys=sorted(perm_keys),
        )
    )

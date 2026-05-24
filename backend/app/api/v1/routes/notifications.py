from __future__ import annotations

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.api.deps import get_company_scope_id, get_current_user, get_permission_keys, is_admin, require_permission
from app.core.errors import BAD_REQUEST, AppException
from app.core.response import ok
from app.core.security import get_token_subject
from app.db.session import SessionLocal, get_db
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.notifications import (
    CompanyNotificationPolicyOut,
    CompanyNotificationPolicyUpdateRequest,
    NotificationListResponse,
    NotificationOut,
    NotificationPreferenceOut,
    NotificationPreferenceUpdateRequest,
    NotificationUnreadCountOut,
)
from app.services.notification_hub import notification_hub
from app.services.notifications import NotificationService

router = APIRouter()
service = NotificationService()


@router.get("", response_model=ApiResponse[NotificationListResponse])
def list_notifications(
    status: str | None = Query(default=None, description="all|unread|archived"),
    category: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("notifications.read")),
) -> ApiResponse[NotificationListResponse]:
    if status and status not in {"all", "unread", "archived"}:
        raise AppException(BAD_REQUEST, detail="Invalid status")
    data = service.list_for_user(
        db,
        user_id=int(user.id),
        company_id=company_id,
        unread_only=status == "unread",
        category=category.strip() if category else None,
        severity=severity.strip() if severity else None,
        include_archived=status == "archived",
        archived_only=status == "archived",
        limit=limit,
        offset=offset,
    )
    return ok(NotificationListResponse(items=[NotificationOut(**x) for x in data["items"]], total=int(data["total"])))


@router.get("/unread-count", response_model=ApiResponse[NotificationUnreadCountOut])
def get_unread_count(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("notifications.read")),
) -> ApiResponse[NotificationUnreadCountOut]:
    return ok(NotificationUnreadCountOut(unread_count=service.unread_count(db, user_id=int(user.id), company_id=company_id)))


@router.get("/preferences/me", response_model=ApiResponse[NotificationPreferenceOut])
def get_my_preferences(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    _: object = Depends(require_permission("notifications.read")),
) -> ApiResponse[NotificationPreferenceOut]:
    return ok(service.get_preferences(db, user_id=int(user.id)))


@router.put("/preferences/me", response_model=ApiResponse[NotificationPreferenceOut])
def update_my_preferences(
    payload: NotificationPreferenceUpdateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    _: object = Depends(require_permission("notifications.read")),
) -> ApiResponse[NotificationPreferenceOut]:
    return ok(service.update_preferences(db, user_id=int(user.id), data=payload.model_dump()))


@router.get("/company-policies", response_model=ApiResponse[CompanyNotificationPolicyOut])
def get_company_policies(
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("settings.read")),
) -> ApiResponse[CompanyNotificationPolicyOut]:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Thiếu công ty. Vui lòng chọn công ty (X-Company-Id).")
    return ok(service.get_company_policy(db, company_id=int(company_id)))


@router.put("/company-policies", response_model=ApiResponse[CompanyNotificationPolicyOut])
def update_company_policies(
    payload: CompanyNotificationPolicyUpdateRequest,
    db: Session = Depends(get_db),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("settings.manage")),
) -> ApiResponse[CompanyNotificationPolicyOut]:
    if company_id is None:
        raise AppException(BAD_REQUEST, detail="Thiếu công ty. Vui lòng chọn công ty (X-Company-Id).")
    return ok(service.update_company_policy(db, company_id=int(company_id), data=payload.model_dump()))


@router.post("/read-all", response_model=ApiResponse[dict[str, object]])
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    company_id: int | None = Depends(get_company_scope_id),
    _: object = Depends(require_permission("notifications.read")),
) -> ApiResponse[dict[str, object]]:
    return ok(service.mark_all_read(db, user_id=int(user.id), company_id=company_id))


@router.get("/{recipient_id:int}", response_model=ApiResponse[NotificationOut])
def get_notification(
    recipient_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    _: object = Depends(require_permission("notifications.read")),
) -> ApiResponse[NotificationOut]:
    try:
        return ok(NotificationOut(**service.get_for_user(db, recipient_id=recipient_id, user_id=int(user.id))))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/{recipient_id:int}/read", response_model=ApiResponse[dict[str, object]])
def mark_notification_read(
    recipient_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    _: object = Depends(require_permission("notifications.read")),
) -> ApiResponse[dict[str, object]]:
    try:
        return ok(service.mark_read(db, recipient_id=recipient_id, user_id=int(user.id)))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("/{recipient_id:int}/archive", response_model=ApiResponse[dict[str, object]])
def archive_notification(
    recipient_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    _: object = Depends(require_permission("notifications.read")),
) -> ApiResponse[dict[str, object]]:
    try:
        return ok(service.archive(db, recipient_id=recipient_id, user_id=int(user.id)))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.delete("/{recipient_id:int}", response_model=ApiResponse[dict[str, object]])
def delete_notification(
    recipient_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    _: object = Depends(require_permission("notifications.read")),
) -> ApiResponse[dict[str, object]]:
    try:
        return ok(service.delete_for_user(db, recipient_id=recipient_id, user_id=int(user.id)))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.websocket("/ws")
async def notifications_ws(websocket: WebSocket, token: str | None = Query(default=None), company_id: int | None = Query(default=None)) -> None:
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    db = SessionLocal()
    user_id: int | None = None
    try:
        subject = get_token_subject(token)
        if subject is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        user = db.get(User, int(subject))
        if user is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        if "notifications.read" not in get_permission_keys(user):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        user_id = int(user.id)
        scope_company_id = int(company_id) if company_id is not None and is_admin(user) else None
        if not is_admin(user):
            scope_company_id = int(getattr(user, "company_id", 0) or 0) or None

        await notification_hub.connect(websocket, user_id=user_id, company_scope_id=scope_company_id)
        await websocket.send_json({"type": "notification.ready"})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        db.close()
        if user_id is not None:
            await notification_hub.disconnect(websocket, user_id=user_id)

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.errors import BAD_REQUEST, AppException
from app.core.response import ok
from app.db.session import get_db
from app.schemas.common import ApiResponse
from app.schemas.companies import CompanyCreateRequest, CompanyOut, CompanyUpdateRequest
from app.services.companies import CompanyService
from app.services.notifications import NotificationService
from app.api.deps import get_current_user

router = APIRouter()
service = CompanyService()
notification_service = NotificationService()


@router.get("", response_model=ApiResponse[list[CompanyOut]])
def list_companies(
    q: str | None = Query(default=None, description="Search by name/code"),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("companies.read")),
) -> ApiResponse[list[CompanyOut]]:
    return ok(service.list_companies(db, limit=limit, offset=offset, q=q.strip() if q else None))


@router.get("/{company_id:int}", response_model=ApiResponse[CompanyOut])
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("companies.read")),
) -> ApiResponse[CompanyOut]:
    try:
        return ok(service.get_company(db, company_id=company_id))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("", response_model=ApiResponse[CompanyOut])
def create_company(
    payload: CompanyCreateRequest,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("companies.manage")),
) -> ApiResponse[CompanyOut]:
    try:
        return ok(
            service.create_company(
                db,
                code=payload.code,
                name=payload.name,
                status=payload.status,
                address=payload.address,
                latitude=payload.latitude,
                longitude=payload.longitude,
                geo_radius_meters=payload.geo_radius_meters,
                require_gps_on_attendance=payload.require_gps_on_attendance,
            )
        )
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.put("/{company_id:int}", response_model=ApiResponse[CompanyOut])
def update_company(
    company_id: int,
    payload: CompanyUpdateRequest,
    db: Session = Depends(get_db),
    actor=Depends(get_current_user),
    _: object = Depends(require_permission("companies.manage")),
) -> ApiResponse[CompanyOut]:
    try:
        before = service.get_company(db, company_id=company_id)
        data = payload.model_dump(exclude_unset=True)
        result = service.update_company(
            db,
            company_id=company_id,
            **data,
        )
        gps_changed = any(
            [
                getattr(before, "require_gps_on_attendance", None) != getattr(result, "require_gps_on_attendance", None),
                getattr(before, "latitude", None) != getattr(result, "latitude", None),
                getattr(before, "longitude", None) != getattr(result, "longitude", None),
                getattr(before, "geo_radius_meters", None) != getattr(result, "geo_radius_meters", None),
            ]
        )
        if gps_changed:
            try:
                notification_service.create_for_permission(
                    db,
                    company_id=company_id,
                    permission_key="notifications.read",
                    type="company.gps_policy.updated",
                    category="settings",
                    severity="warning",
                    title="Cấu hình GPS chấm công vừa được cập nhật",
                    body=f"GPS {'bật' if bool(getattr(result, 'require_gps_on_attendance', False)) else 'tắt'} • bán kính {int(getattr(result, 'geo_radius_meters', 0) or 0)}m",
                    entity_type="company",
                    entity_id=int(getattr(result, "id")),
                    action_url="/settings",
                    created_by_user_id=int(actor.id),
                    exclude_user_ids=[],
                )
            except Exception:
                pass
        return ok(result)
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.get("/me", response_model=ApiResponse[CompanyOut])
def my_company(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    _: object = Depends(require_permission("settings.read")),
) -> ApiResponse[CompanyOut]:
    cid = getattr(user, "company_id", None)
    if cid is None:
        raise AppException(BAD_REQUEST, detail="User chưa gắn company")
    try:
        return ok(service.get_company(db, company_id=int(cid)))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.put("/me", response_model=ApiResponse[CompanyOut])
def update_my_company(
    payload: CompanyUpdateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    _: object = Depends(require_permission("settings.read")),
) -> ApiResponse[CompanyOut]:
    cid = getattr(user, "company_id", None)
    if cid is None:
        raise AppException(BAD_REQUEST, detail="User chưa gắn company")
    try:
        before = service.get_company(db, company_id=int(cid))
        data = payload.model_dump(exclude_unset=True)
        result = service.update_company(
            db,
            company_id=int(cid),
            **data,
        )
        gps_changed = any(
            [
                getattr(before, "require_gps_on_attendance", None) != getattr(result, "require_gps_on_attendance", None),
                getattr(before, "latitude", None) != getattr(result, "latitude", None),
                getattr(before, "longitude", None) != getattr(result, "longitude", None),
                getattr(before, "geo_radius_meters", None) != getattr(result, "geo_radius_meters", None),
            ]
        )
        if gps_changed:
            try:
                notification_service.create_for_permission(
                    db,
                    company_id=int(cid),
                    permission_key="notifications.read",
                    type="company.gps_policy.updated",
                    category="settings",
                    severity="warning",
                    title="Cấu hình GPS chấm công vừa được cập nhật",
                    body=f"GPS {'bật' if bool(getattr(result, 'require_gps_on_attendance', False)) else 'tắt'} • bán kính {int(getattr(result, 'geo_radius_meters', 0) or 0)}m",
                    entity_type="company",
                    entity_id=int(getattr(result, "id")),
                    action_url="/settings",
                    created_by_user_id=int(user.id),
                    exclude_user_ids=[],
                )
            except Exception:
                pass
        return ok(result)
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.delete("/{company_id:int}", response_model=ApiResponse[dict[str, object]])
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("companies.manage")),
) -> ApiResponse[dict[str, object]]:
    try:
        service.delete_company(db, company_id=company_id)
        return ok({"deleted": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))

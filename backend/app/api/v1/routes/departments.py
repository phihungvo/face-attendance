from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.errors import BAD_REQUEST, AppException
from app.core.response import ok
from app.db.session import get_db
from app.schemas.common import ApiResponse
from app.schemas.departments import DepartmentCreateRequest, DepartmentOut, DepartmentUpdateRequest
from app.services.departments import DepartmentService

router = APIRouter()
service = DepartmentService()


@router.get("", response_model=ApiResponse[list[DepartmentOut]])
def list_departments(
    q: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("departments.read")),
) -> ApiResponse[list[DepartmentOut]]:
    return ok(service.list_departments(db, limit=limit, offset=offset, q=q.strip() if q else None))


@router.get("/{dept_id}", response_model=ApiResponse[DepartmentOut])
def get_department(
    dept_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("departments.read")),
) -> ApiResponse[DepartmentOut]:
    try:
        return ok(service.get_department(db, dept_id=dept_id))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.post("", response_model=ApiResponse[DepartmentOut])
def create_department(
    payload: DepartmentCreateRequest,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("departments.read")),
) -> ApiResponse[DepartmentOut]:
    try:
        return ok(service.create_department(db, code=payload.code, name=payload.name, location=payload.location))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.put("/{dept_id}", response_model=ApiResponse[DepartmentOut])
def update_department(
    dept_id: int,
    payload: DepartmentUpdateRequest,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("departments.read")),
) -> ApiResponse[DepartmentOut]:
    try:
        return ok(service.update_department(db, dept_id=dept_id, code=payload.code, name=payload.name, location=payload.location))
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))


@router.delete("/{dept_id}", response_model=ApiResponse[dict[str, object]])
def delete_department(
    dept_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_permission("departments.read")),
) -> ApiResponse[dict[str, object]]:
    try:
        service.delete_department(db, dept_id=dept_id)
        return ok({"deleted": True})
    except ValueError as e:
        raise AppException(BAD_REQUEST, detail=str(e))

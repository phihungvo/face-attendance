from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.response import ok
from app.db.session import get_db
from app.schemas.auth import LoginRequest, MeResponse, RegisterRequest, TokenResponse
from app.schemas.common import ApiResponse
from app.services.auth import AuthService
from app.api.deps import get_current_user

router = APIRouter()
service = AuthService()


@router.post("/register", response_model=ApiResponse[TokenResponse])
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> ApiResponse[TokenResponse]:
    token = service.register(db, username=payload.username, password=payload.password, role_key=payload.role)
    return ok(TokenResponse(access_token=token))


@router.post("/login", response_model=ApiResponse[TokenResponse])
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> ApiResponse[TokenResponse]:
    token = service.login(db, username=payload.username, password=payload.password)
    return ok(TokenResponse(access_token=token))


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
    return ok(MeResponse(user_id=user.id, username=user.username or "", role_keys=role_keys, permission_keys=sorted(perm_keys)))

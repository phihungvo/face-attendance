from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.response import ok
from app.db.session import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.common import ApiResponse
from app.services.auth import AuthService

router = APIRouter()
service = AuthService()


@router.post("/register", response_model=ApiResponse[TokenResponse])
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> ApiResponse[TokenResponse]:
    token = service.register(db, username=payload.username, password=payload.password)
    return ok(TokenResponse(access_token=token))


@router.post("/login", response_model=ApiResponse[TokenResponse])
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> ApiResponse[TokenResponse]:
    token = service.login(db, username=payload.username, password=payload.password)
    return ok(TokenResponse(access_token=token))


from fastapi import APIRouter

from app.api.v1.routes import attendance, auth, departments, settings, users

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(departments.router, prefix="/departments", tags=["departments"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["attendance"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])

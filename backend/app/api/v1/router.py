from fastapi import APIRouter

from app.api.v1.routes import attendance, auth, companies, departments, iam, leaves, schedules, settings, users

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(companies.router, prefix="/companies", tags=["companies"])
api_router.include_router(departments.router, prefix="/departments", tags=["departments"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["attendance"])
api_router.include_router(leaves.router, prefix="/leaves", tags=["leaves"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["schedules"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(iam.router, prefix="/iam", tags=["iam"])

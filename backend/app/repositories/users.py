from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.attendance_history import AttendanceHistory
from app.models.attendance_log import AttendanceLog
from app.models.attendance_evidence_task import AttendanceEvidenceTask
from app.models.company_membership import CompanyInvitation, CompanyJoinRequest
from app.models.face_embedding import FaceEmbedding
from app.models.leave_request import LeaveRequest
from app.models.notification import Notification, NotificationPreference, NotificationRecipient
from app.models.rbac import UserPermission, UserRole
from app.models.work_schedule_registration import WorkScheduleRegistration
from app.models.work_schedule_registration_request import WorkScheduleRegistrationRequest


class UserRepository:
    def get_by_code(self, db: Session, *, company_id: int | None, code: str) -> User | None:
        stmt = select(User).where(User.company_id == company_id, User.code == code, User.deleted_at.is_(None)).order_by(User.id.asc())
        return db.execute(stmt).scalars().first()

    def get_by_email(self, db: Session, *, company_id: int | None, email: str) -> User | None:
        stmt = select(User).where(User.company_id == company_id, User.email == email, User.deleted_at.is_(None)).order_by(User.id.asc())
        return db.execute(stmt).scalars().first()

    def create(
        self,
        db: Session,
        *,
        company_id: int | None = None,
        name: str,
        code: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        address: str | None = None,
        citizen_id: str | None = None,
        citizen_id_place: str | None = None,
        hire_date: date | None = None,
        role: str | None = None,
        status: str | None = None,
        department_id: int | None = None,
    ) -> User:
        user = User(
            company_id=company_id,
            name=name,
            code=code,
            email=email,
            phone=phone,
            address=address,
            citizen_id=citizen_id,
            citizen_id_place=citizen_id_place,
            hire_date=hire_date,
            role=role,
            status=status or "active",
            department_id=department_id,
        )
        db.add(user)
        db.flush()  # assign id
        return user

    def list(
        self,
        db: Session,
        *,
        company_id: int | None = None,
        limit: int = 100,
        offset: int = 0,
        q: str | None = None,
        deleted: str = "active",
    ) -> list[User]:
        stmt = select(User)
        if company_id is not None:
            stmt = stmt.where(User.company_id == company_id)
        if deleted == "deleted":
            stmt = stmt.where(User.deleted_at.is_not(None))
        elif deleted != "all":
            stmt = stmt.where(User.deleted_at.is_(None))
        if q:
            needle = f"%{q}%"
            stmt = stmt.where(
                or_(
                    User.name.ilike(needle),
                    User.code.ilike(needle),
                    User.email.ilike(needle),
                    User.phone.ilike(needle),
                    User.address.ilike(needle),
                    User.citizen_id.ilike(needle),
                    User.citizen_id_place.ilike(needle),
                )
            )
        stmt = stmt.order_by(User.id.desc()).limit(limit).offset(offset)
        return list(db.execute(stmt).scalars().all())

    def get(self, db: Session, user_id: int, *, company_id: int | None = None, include_deleted: bool = False) -> User | None:
        if company_id is None:
            user = db.get(User, user_id)
            if user is not None and not include_deleted and user.deleted_at is not None:
                return None
            return user
        stmt = select(User).where(User.id == user_id, User.company_id == company_id)
        if not include_deleted:
            stmt = stmt.where(User.deleted_at.is_(None))
        return db.execute(stmt).scalars().first()

    def update_fields(
        self,
        db: Session,
        *,
        user_id: int,
        company_id: int | None = None,
        name: str,
        code: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        address: str | None = None,
        citizen_id: str | None = None,
        citizen_id_place: str | None = None,
        hire_date: date | None = None,
        role: str | None = None,
        status: str | None = None,
        department_id: int | None = None,
    ) -> User | None:
        user = self.get(db, user_id, company_id=company_id)
        if user is None:
            return None
        user.name = name
        user.code = code
        user.email = email
        user.phone = phone
        user.address = address
        user.citizen_id = citizen_id
        user.citizen_id_place = citizen_id_place
        user.hire_date = hire_date
        user.role = role
        if status:
            user.status = status
        user.department_id = department_id
        db.add(user)
        db.flush()
        return user

    def soft_delete(self, db: Session, *, user_id: int, company_id: int | None = None, deleted_at: datetime | None = None) -> bool:
        user = self.get(db, user_id, company_id=company_id)
        if user is None:
            return False
        user.deleted_at = deleted_at or datetime.utcnow()
        user.status = "inactive"
        user.auth_status = "inactive"
        user.invite_token_hash = None
        user.invite_token_expires_at = None
        db.add(user)
        db.flush()
        return True

    def restore(self, db: Session, *, user_id: int, company_id: int | None = None) -> bool:
        user = self.get(db, user_id, company_id=company_id, include_deleted=True)
        if user is None or user.deleted_at is None:
            return False
        user.deleted_at = None
        user.status = "active"
        if user.username:
            user.auth_status = "active" if user.password_hash else "pending"
        else:
            user.auth_status = "active"
        db.add(user)
        db.flush()
        return True

    def hard_delete(self, db: Session, *, user_id: int, company_id: int | None = None) -> bool:
        user = self.get(db, user_id, company_id=company_id, include_deleted=True)
        if user is None:
            return False

        db.execute(update(Notification).where(Notification.created_by_user_id == user_id).values(created_by_user_id=None))
        db.execute(update(CompanyInvitation).where(CompanyInvitation.invited_by_user_id == user_id).values(invited_by_user_id=None))
        db.execute(update(CompanyInvitation).where(CompanyInvitation.responded_by_user_id == user_id).values(responded_by_user_id=None))
        db.execute(update(CompanyJoinRequest).where(CompanyJoinRequest.reviewed_by_user_id == user_id).values(reviewed_by_user_id=None))
        db.execute(update(WorkScheduleRegistration).where(WorkScheduleRegistration.approved_by_user_id == user_id).values(approved_by_user_id=None))
        db.execute(update(WorkScheduleRegistrationRequest).where(WorkScheduleRegistrationRequest.approved_by_user_id == user_id).values(approved_by_user_id=None))

        db.execute(delete(WorkScheduleRegistration).where(WorkScheduleRegistration.user_id == user_id))
        db.execute(delete(WorkScheduleRegistrationRequest).where(WorkScheduleRegistrationRequest.user_id == user_id))
        db.execute(delete(LeaveRequest).where(LeaveRequest.user_id == user_id))
        db.execute(delete(CompanyJoinRequest).where(CompanyJoinRequest.user_id == user_id))
        db.execute(delete(NotificationPreference).where(NotificationPreference.user_id == user_id))
        db.execute(delete(NotificationRecipient).where(NotificationRecipient.user_id == user_id))
        db.execute(delete(UserPermission).where(UserPermission.user_id == user_id))
        db.execute(delete(UserRole).where(UserRole.user_id == user_id))
        db.execute(delete(AttendanceEvidenceTask).where(AttendanceEvidenceTask.employee_id == user_id))
        db.execute(delete(AttendanceHistory).where(AttendanceHistory.employee_id == user_id))
        db.execute(delete(AttendanceLog).where(AttendanceLog.user_id == user_id))
        db.execute(delete(FaceEmbedding).where(FaceEmbedding.user_id == user_id))

        db.delete(user)
        db.flush()
        return True

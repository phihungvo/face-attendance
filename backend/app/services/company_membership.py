from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.company_membership import CompanyInvitation, CompanyJoinRequest
from app.models.user import User
from app.repositories.company_membership import CompanyMembershipRepository
from app.repositories.rbac import RbacRepository
from app.services.notifications import NotificationService


class CompanyMembershipService:
    def __init__(self) -> None:
        self._repo = CompanyMembershipRepository()
        self._rbac = RbacRepository()
        self._notifications = NotificationService()

    def _now(self) -> datetime:
        return datetime.now(timezone.utc).replace(tzinfo=None)

    def _normalize_email(self, email: str) -> str:
        value = email.strip().lower()
        if "@" not in value:
            raise ValueError("Email không hợp lệ")
        return value

    def _company_out(self, company) -> dict[str, object] | None:
        if company is None:
            return None
        return {"id": int(company.id), "code": company.code, "name": company.name}

    def _user_out(self, user) -> dict[str, object] | None:
        if user is None:
            return None
        return {"id": int(user.id), "name": user.name, "email": user.email}

    def _invitation_out(self, db: Session, row: CompanyInvitation) -> dict[str, object]:
        company = db.get(Company, int(row.company_id))
        return {
            "id": int(row.id),
            "company_id": int(row.company_id),
            "email": row.email,
            "status": row.status,
            "invited_by_user_id": row.invited_by_user_id,
            "responded_by_user_id": row.responded_by_user_id,
            "responded_at": row.responded_at,
            "expires_at": row.expires_at,
            "created_at": row.created_at,
            "company": self._company_out(company),
        }

    def _join_request_out(self, db: Session, row: CompanyJoinRequest) -> dict[str, object]:
        company = db.get(Company, int(row.company_id))
        user = db.get(User, int(row.user_id))
        return {
            "id": int(row.id),
            "company_id": int(row.company_id),
            "user_id": int(row.user_id),
            "status": row.status,
            "reviewed_by_user_id": row.reviewed_by_user_id,
            "reviewed_at": row.reviewed_at,
            "created_at": row.created_at,
            "company": self._company_out(company),
            "user": self._user_out(user),
        }

    def _ensure_employee_role(self, db: Session, user: User) -> None:
        if any(getattr(role, "key", "") == "employee" for role in getattr(user, "roles", []) or []):
            return
        role = self._rbac.get_role_by_key(db, "employee")
        if role is not None:
            user.roles = list(getattr(user, "roles", []) or []) + [role]

    def get_my_membership(self, db: Session, *, user_id: int) -> dict[str, object]:
        user = db.get(User, user_id)
        if user is None:
            raise ValueError("User không tồn tại")
        company = user.company if getattr(user, "company_id", None) is not None else None
        invitations: list[CompanyInvitation] = []
        if user.email:
            invitations = self._repo.list_invitations_for_email(db, email=user.email, status="PENDING")
        pending_requests = self._repo.list_join_requests_for_user(db, user_id=user_id, status="PENDING")
        return {
            "company": self._company_out(company),
            "membership_status": "ACTIVE" if company is not None and user.status == "active" else None,
            "invitations": [self._invitation_out(db, row) for row in invitations],
            "pending_request": self._join_request_out(db, pending_requests[0]) if pending_requests else None,
        }

    def invite_employee(self, db: Session, *, company_id: int, actor_user_id: int, email: str) -> dict[str, object]:
        email = self._normalize_email(email)
        company = db.get(Company, company_id)
        if company is None:
            raise ValueError("Company không tồn tại")
        existing_member = next((u for u in self._repo.find_users_by_email(db, email=email) if getattr(u, "company_id", None) is not None), None)
        if existing_member is not None:
            if int(existing_member.company_id) == int(company_id):
                raise ValueError("Email này đã là nhân viên trong công ty")
            raise ValueError("Email này đang thuộc công ty khác")
        pending = self._repo.get_pending_invitation_for_company_email(db, company_id=company_id, email=email)
        if pending is not None:
            raise ValueError("Email này đã có lời mời đang chờ")
        row = self._repo.create_invitation(db, company_id=company_id, email=email, invited_by_user_id=actor_user_id)
        db.commit()
        db.refresh(row)
        try:
            user_ids = [int(u.id) for u in self._repo.find_users_by_email(db, email=email) if getattr(u, "company_id", None) is None]
            self._notifications.create_for_users(
                db,
                company_id=company_id,
                type="company.invitation.created",
                category="iam",
                severity="info",
                title=f"Lời mời tham gia {company.name}",
                body="Bạn có một lời mời tham gia công ty đang chờ phản hồi.",
                entity_type="company_invitation",
                entity_id=int(row.id),
                action_url="/employee",
                created_by_user_id=actor_user_id,
                user_ids=user_ids,
            )
        except Exception:
            pass
        return self._invitation_out(db, row)

    def list_company_invitations(self, db: Session, *, company_id: int, status: str | None = None) -> list[dict[str, object]]:
        rows = self._repo.list_invitations_for_company(db, company_id=company_id, status=status)
        return [self._invitation_out(db, row) for row in rows]

    def accept_invitation(self, db: Session, *, user_id: int, invitation_id: int) -> dict[str, object]:
        user = db.get(User, user_id)
        row = self._repo.get_invitation(db, invitation_id)
        if user is None or row is None:
            raise ValueError("Lời mời không tồn tại")
        if not user.email or user.email.strip().lower() != row.email.strip().lower():
            raise ValueError("Lời mời không thuộc email của bạn")
        if row.status != "PENDING":
            raise ValueError("Lời mời không còn hiệu lực")
        if getattr(user, "company_id", None) is not None:
            raise ValueError("Bạn đã thuộc một công ty")
        user.company_id = int(row.company_id)
        user.department_id = None
        user.status = "active"
        user.role = user.role or "Nhân viên"
        self._ensure_employee_role(db, user)
        now = self._now()
        row.status = "ACCEPTED"
        row.responded_by_user_id = int(user_id)
        row.responded_at = now
        for other in self._repo.list_invitations_for_email(db, email=user.email, status="PENDING"):
            if int(other.id) != int(row.id):
                other.status = "DECLINED"
                other.responded_by_user_id = int(user_id)
                other.responded_at = now
        for req in self._repo.list_join_requests_for_user(db, user_id=user_id, status="PENDING"):
            req.status = "REJECTED"
            req.reviewed_at = now
        db.add(user)
        db.commit()
        db.refresh(row)
        try:
            self._notifications.create_for_permission(
                db,
                company_id=int(row.company_id),
                permission_key="employees.manage",
                type="company.member.joined",
                category="iam",
                severity="success",
                title=f"{user.name} đã tham gia công ty",
                body="Nhân viên đã chấp nhận lời mời tham gia.",
                entity_type="user",
                entity_id=int(user.id),
                action_url="/employees",
                created_by_user_id=int(user.id),
                exclude_user_ids=[int(user.id)],
            )
        except Exception:
            pass
        return self._invitation_out(db, row)

    def decline_invitation(self, db: Session, *, user_id: int, invitation_id: int) -> dict[str, object]:
        user = db.get(User, user_id)
        row = self._repo.get_invitation(db, invitation_id)
        if user is None or row is None:
            raise ValueError("Lời mời không tồn tại")
        if not user.email or user.email.strip().lower() != row.email.strip().lower():
            raise ValueError("Lời mời không thuộc email của bạn")
        if row.status != "PENDING":
            raise ValueError("Lời mời không còn hiệu lực")
        row.status = "DECLINED"
        row.responded_by_user_id = int(user_id)
        row.responded_at = self._now()
        db.commit()
        db.refresh(row)
        return self._invitation_out(db, row)

    def create_join_request(self, db: Session, *, user_id: int, company_code: str) -> dict[str, object]:
        user = db.get(User, user_id)
        if user is None:
            raise ValueError("User không tồn tại")
        if getattr(user, "company_id", None) is not None:
            raise ValueError("Bạn đã thuộc một công ty")
        existing = self._repo.list_join_requests_for_user(db, user_id=user_id, status="PENDING")
        if existing:
            raise ValueError("Bạn đã có yêu cầu tham gia đang chờ duyệt")
        company = self._repo.get_company_by_code(db, company_code)
        if company is None or company.status != "active":
            raise ValueError("Mã công ty không hợp lệ")
        row = self._repo.create_join_request(db, company_id=int(company.id), user_id=user_id)
        db.commit()
        db.refresh(row)
        try:
            self._notifications.create_for_permission(
                db,
                company_id=int(company.id),
                permission_key="employees.manage",
                type="company.join_request.created",
                category="iam",
                severity="info",
                title="Có yêu cầu tham gia mới",
                body=f"{user.name} muốn tham gia {company.name}.",
                entity_type="company_join_request",
                entity_id=int(row.id),
                action_url="/employees",
                created_by_user_id=int(user.id),
                exclude_user_ids=[int(user.id)],
            )
        except Exception:
            pass
        return self._join_request_out(db, row)

    def list_join_requests(self, db: Session, *, company_id: int, status: str | None = None) -> list[dict[str, object]]:
        rows = self._repo.list_join_requests_for_company(db, company_id=company_id, status=status)
        return [self._join_request_out(db, row) for row in rows]

    def approve_join_request(self, db: Session, *, company_id: int, actor_user_id: int, request_id: int) -> dict[str, object]:
        row = self._repo.get_join_request(db, request_id, company_id=company_id)
        if row is None:
            raise ValueError("Yêu cầu không tồn tại")
        if row.status != "PENDING":
            raise ValueError("Yêu cầu không còn chờ duyệt")
        user = db.get(User, int(row.user_id))
        if user is None:
            raise ValueError("User không tồn tại")
        if getattr(user, "company_id", None) is not None:
            raise ValueError("Nhân viên đã thuộc một công ty")
        user.company_id = int(company_id)
        user.department_id = None
        user.status = "active"
        user.role = user.role or "Nhân viên"
        self._ensure_employee_role(db, user)
        now = self._now()
        row.status = "APPROVED"
        row.reviewed_by_user_id = int(actor_user_id)
        row.reviewed_at = now
        if user.email:
            for invitation in self._repo.list_invitations_for_email(db, email=user.email, status="PENDING"):
                invitation.status = "DECLINED"
                invitation.responded_by_user_id = int(user.id)
                invitation.responded_at = now
        db.add(user)
        db.commit()
        db.refresh(row)
        try:
            self._notifications.create_for_users(
                db,
                company_id=company_id,
                type="company.join_request.approved",
                category="iam",
                severity="success",
                title="Yêu cầu tham gia đã được chấp nhận",
                body="Bạn đã trở thành nhân viên của công ty.",
                entity_type="company_join_request",
                entity_id=int(row.id),
                action_url="/employee",
                created_by_user_id=actor_user_id,
                user_ids=[int(user.id)],
            )
        except Exception:
            pass
        return self._join_request_out(db, row)

    def reject_join_request(self, db: Session, *, company_id: int, actor_user_id: int, request_id: int) -> dict[str, object]:
        row = self._repo.get_join_request(db, request_id, company_id=company_id)
        if row is None:
            raise ValueError("Yêu cầu không tồn tại")
        if row.status != "PENDING":
            raise ValueError("Yêu cầu không còn chờ duyệt")
        row.status = "REJECTED"
        row.reviewed_by_user_id = int(actor_user_id)
        row.reviewed_at = self._now()
        db.commit()
        db.refresh(row)
        try:
            self._notifications.create_for_users(
                db,
                company_id=company_id,
                type="company.join_request.rejected",
                category="iam",
                severity="warning",
                title="Yêu cầu tham gia đã bị từ chối",
                body="Liên hệ quản lý nếu bạn cần thêm thông tin.",
                entity_type="company_join_request",
                entity_id=int(row.id),
                action_url="/employee",
                created_by_user_id=actor_user_id,
                user_ids=[int(row.user_id)],
            )
        except Exception:
            pass
        return self._join_request_out(db, row)

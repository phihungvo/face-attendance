from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.company_membership import CompanyInvitation, CompanyJoinRequest
from app.models.user import User


class CompanyMembershipRepository:
    def get_company_by_code(self, db: Session, code: str) -> Company | None:
        stmt = select(Company).where(func.lower(Company.code) == code.strip().lower()).limit(1)
        return db.execute(stmt).scalars().first()

    def list_invitations_for_company(self, db: Session, *, company_id: int, status: str | None = None) -> list[CompanyInvitation]:
        stmt = select(CompanyInvitation).where(CompanyInvitation.company_id == company_id)
        if status:
            stmt = stmt.where(CompanyInvitation.status == status)
        stmt = stmt.order_by(CompanyInvitation.id.desc())
        return list(db.execute(stmt).scalars().all())

    def list_invitations_for_email(self, db: Session, *, email: str, status: str | None = None) -> list[CompanyInvitation]:
        stmt = select(CompanyInvitation).where(func.lower(CompanyInvitation.email) == email.strip().lower())
        if status:
            stmt = stmt.where(CompanyInvitation.status == status)
        stmt = stmt.order_by(CompanyInvitation.id.desc())
        return list(db.execute(stmt).scalars().all())

    def get_invitation(self, db: Session, invitation_id: int) -> CompanyInvitation | None:
        return db.get(CompanyInvitation, invitation_id)

    def get_pending_invitation_for_company_email(self, db: Session, *, company_id: int, email: str) -> CompanyInvitation | None:
        stmt = (
            select(CompanyInvitation)
            .where(
                CompanyInvitation.company_id == company_id,
                func.lower(CompanyInvitation.email) == email.strip().lower(),
                CompanyInvitation.status == "PENDING",
            )
            .order_by(CompanyInvitation.id.desc())
            .limit(1)
        )
        return db.execute(stmt).scalars().first()

    def create_invitation(self, db: Session, *, company_id: int, email: str, invited_by_user_id: int | None) -> CompanyInvitation:
        row = CompanyInvitation(company_id=company_id, email=email, status="PENDING", invited_by_user_id=invited_by_user_id)
        db.add(row)
        db.flush()
        return row

    def list_join_requests_for_company(self, db: Session, *, company_id: int, status: str | None = None) -> list[CompanyJoinRequest]:
        stmt = select(CompanyJoinRequest).where(CompanyJoinRequest.company_id == company_id)
        if status:
            stmt = stmt.where(CompanyJoinRequest.status == status)
        stmt = stmt.order_by(CompanyJoinRequest.id.desc())
        return list(db.execute(stmt).scalars().all())

    def list_join_requests_for_user(self, db: Session, *, user_id: int, status: str | None = None) -> list[CompanyJoinRequest]:
        stmt = select(CompanyJoinRequest).where(CompanyJoinRequest.user_id == user_id)
        if status:
            stmt = stmt.where(CompanyJoinRequest.status == status)
        stmt = stmt.order_by(CompanyJoinRequest.id.desc())
        return list(db.execute(stmt).scalars().all())

    def get_join_request(self, db: Session, request_id: int, *, company_id: int | None = None) -> CompanyJoinRequest | None:
        stmt = select(CompanyJoinRequest).where(CompanyJoinRequest.id == request_id)
        if company_id is not None:
            stmt = stmt.where(CompanyJoinRequest.company_id == company_id)
        return db.execute(stmt).scalars().first()

    def create_join_request(self, db: Session, *, company_id: int, user_id: int) -> CompanyJoinRequest:
        row = CompanyJoinRequest(company_id=company_id, user_id=user_id, status="PENDING")
        db.add(row)
        db.flush()
        return row

    def find_users_by_email(self, db: Session, *, email: str) -> list[User]:
        stmt = select(User).where(func.lower(User.email) == email.strip().lower()).order_by(User.id.asc())
        return list(db.execute(stmt).scalars().all())

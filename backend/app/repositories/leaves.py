from __future__ import annotations

from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.leave_request import LeaveRequest
from app.models.user import User


class LeaveRepository:
    def create(
        self,
        db: Session,
        *,
        user_id: int,
        type: str,
        start_date: date,
        end_date: date,
        reason: str | None = None,
    ) -> LeaveRequest:
        leave = LeaveRequest(
            user_id=user_id,
            type=type,
            start_date=start_date,
            end_date=end_date,
            reason=reason,
            status="pending",
        )
        db.add(leave)
        db.flush()
        return leave

    def get(self, db: Session, leave_id: int, *, company_id: int | None = None) -> LeaveRequest | None:
        if company_id is None:
            return db.get(LeaveRequest, leave_id)
        stmt = (
            select(LeaveRequest)
            .join(User, User.id == LeaveRequest.user_id)
            .where(LeaveRequest.id == leave_id, User.company_id == company_id)
            .limit(1)
        )
        return db.execute(stmt).scalars().first()

    def get_with_user(self, db: Session, leave_id: int, *, company_id: int | None = None) -> tuple[LeaveRequest, User] | None:
        stmt = select(LeaveRequest, User).join(User, User.id == LeaveRequest.user_id).where(LeaveRequest.id == leave_id)
        if company_id is not None:
            stmt = stmt.where(User.company_id == company_id)
        row = db.execute(stmt.limit(1)).first()
        return (row[0], row[1]) if row else None

    def delete(self, db: Session, *, leave_id: int, company_id: int | None = None) -> bool:
        leave = self.get(db, leave_id, company_id=company_id)
        if leave is None:
            return False
        db.delete(leave)
        db.flush()
        return True

    def update_fields(
        self,
        db: Session,
        *,
        leave_id: int,
        company_id: int | None = None,
        user_id: int,
        type: str,
        start_date: date,
        end_date: date,
        reason: str | None = None,
        status: str | None = None,
    ) -> LeaveRequest | None:
        leave = self.get(db, leave_id, company_id=company_id)
        if leave is None:
            return None
        leave.user_id = user_id
        leave.type = type
        leave.start_date = start_date
        leave.end_date = end_date
        leave.reason = reason
        if status:
            leave.status = status
        db.add(leave)
        db.flush()
        return leave

    def set_status(self, db: Session, *, leave_id: int, company_id: int | None = None, status: str) -> LeaveRequest | None:
        leave = self.get(db, leave_id, company_id=company_id)
        if leave is None:
            return None
        leave.status = status
        db.add(leave)
        db.flush()
        return leave

    def count(
        self,
        db: Session,
        *,
        company_id: int | None = None,
        q: str | None = None,
        status: str | None = None,
        user_id: int | None = None,
        department_id: int | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> int:
        stmt = select(func.count(LeaveRequest.id)).select_from(LeaveRequest).join(User, User.id == LeaveRequest.user_id)
        stmt = self._apply_filters(
            stmt,
            company_id=company_id,
            q=q,
            status=status,
            user_id=user_id,
            department_id=department_id,
            from_date=from_date,
            to_date=to_date,
        )
        return int(db.execute(stmt).scalar_one() or 0)

    def list(
        self,
        db: Session,
        *,
        company_id: int | None = None,
        limit: int = 100,
        offset: int = 0,
        q: str | None = None,
        status: str | None = None,
        user_id: int | None = None,
        department_id: int | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> list[tuple[LeaveRequest, User]]:
        stmt = select(LeaveRequest, User).join(User, User.id == LeaveRequest.user_id)
        stmt = self._apply_filters(
            stmt,
            company_id=company_id,
            q=q,
            status=status,
            user_id=user_id,
            department_id=department_id,
            from_date=from_date,
            to_date=to_date,
        )
        stmt = stmt.order_by(LeaveRequest.id.desc()).limit(limit).offset(offset)
        return list(db.execute(stmt).all())

    def _apply_filters(
        self,
        stmt,
        *,
        company_id: int | None,
        q: str | None,
        status: str | None,
        user_id: int | None,
        department_id: int | None,
        from_date: date | None,
        to_date: date | None,
    ):
        if company_id is not None:
            stmt = stmt.where(User.company_id == company_id)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(or_(User.name.ilike(like), User.code.ilike(like)))
        if status:
            stmt = stmt.where(LeaveRequest.status == status)
        if user_id is not None:
            stmt = stmt.where(LeaveRequest.user_id == user_id)
        if department_id is not None:
            stmt = stmt.where(User.department_id == department_id)
        if from_date:
            stmt = stmt.where(LeaveRequest.start_date >= from_date)
        if to_date:
            stmt = stmt.where(LeaveRequest.end_date <= to_date)
        return stmt

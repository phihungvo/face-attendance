from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.repositories.leaves import LeaveRepository
from app.repositories.users import UserRepository


class LeaveService:
    def __init__(self) -> None:
        self._leaves = LeaveRepository()
        self._users = UserRepository()

    def list(
        self,
        db: Session,
        *,
        limit: int = 100,
        offset: int = 0,
        q: str | None = None,
        status: str | None = None,
        user_id: int | None = None,
        department_id: int | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
    ):
        total = self._leaves.count(
            db,
            q=q,
            status=status,
            user_id=user_id,
            department_id=department_id,
            from_date=from_date,
            to_date=to_date,
        )
        rows = self._leaves.list(
            db,
            limit=limit,
            offset=offset,
            q=q,
            status=status,
            user_id=user_id,
            department_id=department_id,
            from_date=from_date,
            to_date=to_date,
        )
        items = []
        for leave, user in rows:
            items.append(
                {
                    "id": leave.id,
                    "user_id": leave.user_id,
                    "user_name": user.name,
                    "user_code": user.code,
                    "department_id": user.department_id,
                    "type": leave.type,
                    "start_date": leave.start_date,
                    "end_date": leave.end_date,
                    "reason": leave.reason,
                    "status": leave.status,
                    "created_at": leave.created_at,
                    "updated_at": leave.updated_at,
                }
            )
        return {"items": items, "total": total}

    def get(self, db: Session, *, leave_id: int):
        leave = self._leaves.get(db, leave_id)
        if leave is None:
            raise ValueError("Leave request not found")
        user = self._users.get(db, leave.user_id)
        return {
            "id": leave.id,
            "user_id": leave.user_id,
            "user_name": user.name if user else None,
            "user_code": user.code if user else None,
            "department_id": user.department_id if user else None,
            "type": leave.type,
            "start_date": leave.start_date,
            "end_date": leave.end_date,
            "reason": leave.reason,
            "status": leave.status,
            "created_at": leave.created_at,
            "updated_at": leave.updated_at,
        }

    def create(
        self,
        db: Session,
        *,
        user_id: int,
        type: str,
        start_date: date,
        end_date: date,
        reason: str | None = None,
    ):
        if self._users.get(db, user_id) is None:
            raise ValueError("User not found")
        type = type.strip()
        if not type:
            raise ValueError("type is required")
        if end_date < start_date:
            raise ValueError("end_date must be >= start_date")
        leave = self._leaves.create(db, user_id=user_id, type=type, start_date=start_date, end_date=end_date, reason=reason.strip() if reason else None)
        db.commit()
        db.refresh(leave)
        return self.get(db, leave_id=leave.id)

    def update(
        self,
        db: Session,
        *,
        leave_id: int,
        user_id: int,
        type: str,
        start_date: date,
        end_date: date,
        reason: str | None = None,
        status: str | None = None,
    ):
        if self._users.get(db, user_id) is None:
            raise ValueError("User not found")
        type = type.strip()
        if not type:
            raise ValueError("type is required")
        if end_date < start_date:
            raise ValueError("end_date must be >= start_date")
        if status is not None:
            status = status.strip()
            if status and status not in {"pending", "approved", "rejected"}:
                raise ValueError("Invalid status")
        leave = self._leaves.update_fields(
            db,
            leave_id=leave_id,
            user_id=user_id,
            type=type,
            start_date=start_date,
            end_date=end_date,
            reason=reason.strip() if reason else None,
            status=status if status else None,
        )
        if leave is None:
            raise ValueError("Leave request not found")
        db.commit()
        db.refresh(leave)
        return self.get(db, leave_id=leave.id)

    def delete(self, db: Session, *, leave_id: int) -> None:
        ok = self._leaves.delete(db, leave_id=leave_id)
        if not ok:
            raise ValueError("Leave request not found")
        db.commit()

    def approve(self, db: Session, *, leave_id: int):
        leave = self._leaves.set_status(db, leave_id=leave_id, status="approved")
        if leave is None:
            raise ValueError("Leave request not found")
        db.commit()
        db.refresh(leave)
        return self.get(db, leave_id=leave.id)

    def reject(self, db: Session, *, leave_id: int):
        leave = self._leaves.set_status(db, leave_id=leave_id, status="rejected")
        if leave is None:
            raise ValueError("Leave request not found")
        db.commit()
        db.refresh(leave)
        return self.get(db, leave_id=leave.id)

    def my_balance(self, db: Session, *, user_id: int, year: int) -> dict[str, object]:
        """
        Basic leave balance: annual/sick allowances minus APPROVED days in the given year.
        (WFH/other are excluded from balance.)
        """
        # Default allowances (can be made configurable later).
        allowances = {"annual": 12, "sick": 8}

        # Fetch approved leaves for the year.
        from_date = date(year, 1, 1)
        to_date = date(year, 12, 31)
        rows = self._leaves.list(db, limit=5000, offset=0, user_id=user_id, status="approved", from_date=from_date, to_date=to_date)

        used: dict[str, int] = {k: 0 for k in allowances}
        for leave, _user in rows:
            t = (leave.type or "").strip()
            if t not in allowances:
                continue
            days = (leave.end_date - leave.start_date).days + 1
            used[t] += max(0, int(days))

        items = []
        for t, allow in allowances.items():
            u = int(used.get(t, 0))
            rem = max(0, int(allow) - u)
            items.append({"type": t, "allowance_days": int(allow), "used_days": u, "remaining_days": rem})
        return {"year": year, "items": items}

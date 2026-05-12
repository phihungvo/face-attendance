from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.clients.ml_client import MlClient
from app.core.attendance_engine import AttendanceConfig, compute_attendance, decide_scan_action
from app.repositories.attendance_logs import AttendanceLogRepository
from app.repositories.attendance_policy import AttendancePolicyRepository
from app.repositories.departments import DepartmentRepository
from app.repositories.face_embeddings import FaceEmbeddingRepository
from app.repositories.schedules import WorkScheduleRegistrationRepository, WorkScheduleRepository
from app.repositories.users import UserRepository
from app.models.company import Company


@dataclass(frozen=True)
class DailyComputed:
    user_id: int
    user_name: str
    day: date
    checkin_time: datetime | None
    checkout_time: datetime | None
    work_hours: float
    late: bool
    absent: bool


class AttendanceService:
    def __init__(self) -> None:
        self._logs = AttendanceLogRepository()
        self._policy = AttendancePolicyRepository()
        self._embeddings = FaceEmbeddingRepository()
        self._users = UserRepository()
        self._depts = DepartmentRepository()
        self._ml = MlClient()
        self._schedules = WorkScheduleRepository()
        self._schedule_regs = WorkScheduleRegistrationRepository()

    def _policy_cfg(self, policy) -> AttendanceConfig:
        return AttendanceConfig(
            shift_start=policy.shift_start,
            shift_end=policy.shift_end,
            late_grace_minutes=int(policy.late_grace_minutes),
            early_leave_grace_minutes=int(policy.early_leave_grace_minutes),
            break_start=policy.break_start,
            break_end=policy.break_end,
            break_duration_minutes=int(policy.break_duration_minutes),
            break_threshold_hours=float(policy.break_threshold_hours),
            auto_checkout_time=policy.auto_checkout_time,
        )

    def _schedule_cfg_map(
        self,
        db: Session,
        *,
        company_id: int | None,
        from_day: date,
        to_day: date,
        user_ids: list[int] | None = None,
    ) -> dict[tuple[int, date], AttendanceConfig]:
        """
        Build per-user per-day attendance configs from approved schedule registrations.
        Falls back to policy config when not present.
        """
        if company_id is None:
            return {}
        regs = self._schedule_regs.list_approved_in_range(db, company_id=company_id, from_date=from_day, to_date=to_day, user_ids=user_ids)
        if not regs:
            return {}
        schedule_ids = sorted({int(r.schedule_id) for r in regs})
        schedules = {int(s.id): s for s in self._schedules.list_by_ids(db, company_id=company_id, ids=schedule_ids)}

        out: dict[tuple[int, date], AttendanceConfig] = {}
        for r in regs:
            s = schedules.get(int(r.schedule_id))
            if s is None:
                continue
            if getattr(s, "status", "active") != "active":
                continue
            out[(int(r.user_id), r.day)] = AttendanceConfig(
                shift_start=str(s.shift_start),
                shift_end=str(s.shift_end),
                late_grace_minutes=int(getattr(s, "late_grace_minutes", 0) or 0),
                early_leave_grace_minutes=int(getattr(s, "early_leave_grace_minutes", 0) or 0),
                break_start=str(s.break_start),
                break_end=str(s.break_end),
                break_duration_minutes=int(getattr(s, "break_duration_minutes", 0) or 0),
                break_threshold_hours=float(getattr(s, "break_threshold_hours", 0.0) or 0.0),
                auto_checkout_time=str(getattr(s, "auto_checkout_time", "23:59")),
            )
        return out

    def checkin(
        self,
        db: Session,
        *,
        company_id: int | None = None,
        image_bytes: bytes,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> tuple[str, float, object]:
        policy = self._policy.get_or_create(db)
        now = _now_in_policy_tz(policy.timezone)
        _enforce_time_window(now, policy.checkin_from, policy.checkin_to, label="check-in")

        user, confidence = self._match_user(db, company_id=company_id, image_bytes=image_bytes, threshold=float(policy.face_match_threshold))
        geo = self._enforce_geo(db, user_company_id=int(getattr(user, "company_id", 0) or 0), latitude=latitude, longitude=longitude)

        _enforce_min_interval(db, self._logs, user_id=user.id, log_type="checkin", now=now, min_minutes=policy.min_minutes_between_same_type)
        log = self._logs.create(db, user_id=user.id, log_type="checkin", confidence=confidence, timestamp=now, **geo)
        db.commit()
        db.refresh(log)
        return (user.name, confidence, log.timestamp)

    def checkout(
        self,
        db: Session,
        *,
        company_id: int | None = None,
        image_bytes: bytes,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> tuple[str, float, object]:
        policy = self._policy.get_or_create(db)
        now = _now_in_policy_tz(policy.timezone)
        _enforce_time_window(now, policy.checkout_from, policy.checkout_to, label="check-out")

        user, confidence = self._match_user(db, company_id=company_id, image_bytes=image_bytes, threshold=float(policy.face_match_threshold))
        geo = self._enforce_geo(db, user_company_id=int(getattr(user, "company_id", 0) or 0), latitude=latitude, longitude=longitude)

        _enforce_min_interval(
            db,
            self._logs,
            user_id=user.id,
            log_type="checkout",
            now=now,
            min_minutes=policy.min_minutes_between_same_type,
        )
        log = self._logs.create(db, user_id=user.id, log_type="checkout", confidence=confidence, timestamp=now, **geo)
        db.commit()
        db.refresh(log)
        return (user.name, confidence, log.timestamp)

    def scan(
        self,
        db: Session,
        *,
        company_id: int | None = None,
        image_bytes: bytes,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> tuple[str, float, object, str]:
        """
        One-shot scan: auto decide check-in/check-out based on policy windows and existing logs.
        """
        policy = self._policy.get_or_create(db)
        now = _now_in_policy_tz(policy.timezone)

        in_checkin = _in_time_window(now, policy.checkin_from, policy.checkin_to)
        in_checkout = _in_time_window(now, policy.checkout_from, policy.checkout_to)
        if not in_checkin and not in_checkout:
            raise ValueError("Ngoài khung giờ check-in/check-out")

        user, confidence = self._match_user(db, company_id=company_id, image_bytes=image_bytes, threshold=float(policy.face_match_threshold))
        geo = self._enforce_geo(db, user_company_id=int(getattr(user, "company_id", 0) or 0), latitude=latitude, longitude=longitude)

        day = _attendance_day_for_ts(now, shift_start=policy.shift_start, shift_end=policy.shift_end)
        overnight = _is_overnight_shift(policy.shift_start, policy.shift_end)
        start = datetime.combine(day, time(0, 0, 0))
        end = start + (timedelta(days=2) if overnight else timedelta(days=1))
        logs = self._logs.list_in_range(db, start=start, end=end, user_id=user.id)

        first_checkin: datetime | None = None
        last_checkout: datetime | None = None
        for l in logs:
            if _attendance_day_for_ts(l.timestamp, shift_start=policy.shift_start, shift_end=policy.shift_end) != day:
                continue
            if l.type == "checkin":
                if first_checkin is None or l.timestamp < first_checkin:
                    first_checkin = l.timestamp
            else:
                if last_checkout is None or l.timestamp > last_checkout:
                    last_checkout = l.timestamp

        action = decide_scan_action(
            in_checkin_window=in_checkin,
            in_checkout_window=in_checkout,
            has_checkin=first_checkin is not None,
            has_checkout=last_checkout is not None,
        )

        _enforce_min_interval(db, self._logs, user_id=user.id, log_type=action, now=now, min_minutes=policy.min_minutes_between_same_type)
        log = self._logs.create(db, user_id=user.id, log_type=action, confidence=confidence, timestamp=now, **geo)
        db.commit()
        db.refresh(log)
        return (user.name, confidence, log.timestamp, action)

    def scan_for_user(
        self,
        db: Session,
        *,
        user_id: int,
        image_bytes: bytes,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> tuple[str, float, object, str]:
        """
        Employee self-service scan: match face, then enforce matched user == current user.
        """
        policy = self._policy.get_or_create(db)
        now = _now_in_policy_tz(policy.timezone)

        in_checkin = _in_time_window(now, policy.checkin_from, policy.checkin_to)
        in_checkout = _in_time_window(now, policy.checkout_from, policy.checkout_to)

        me = self._users.get(db, user_id)
        if me is None:
            raise ValueError("User not found")
        user, confidence = self._match_user(db, company_id=int(getattr(me, "company_id", 0) or 0) or None, image_bytes=image_bytes, threshold=float(policy.face_match_threshold))
        if int(getattr(user, "id")) != int(user_id):
            raise ValueError("Khuôn mặt không khớp tài khoản đang đăng nhập")
        geo = self._enforce_geo(db, user_company_id=int(getattr(user, "company_id", 0) or 0), latitude=latitude, longitude=longitude)

        day = _attendance_day_for_ts(now, shift_start=policy.shift_start, shift_end=policy.shift_end)
        overnight = _is_overnight_shift(policy.shift_start, policy.shift_end)
        start = datetime.combine(day, time(0, 0, 0))
        end = start + (timedelta(days=2) if overnight else timedelta(days=1))
        logs = self._logs.list_in_range(db, start=start, end=end, user_id=user.id)

        first_checkin: datetime | None = None
        last_checkout: datetime | None = None
        for l in logs:
            if _attendance_day_for_ts(l.timestamp, shift_start=policy.shift_start, shift_end=policy.shift_end) != day:
                continue
            if l.type == "checkin":
                if first_checkin is None or l.timestamp < first_checkin:
                    first_checkin = l.timestamp
            else:
                if last_checkout is None or l.timestamp > last_checkout:
                    last_checkout = l.timestamp

        action = decide_scan_action(
            in_checkin_window=in_checkin,
            in_checkout_window=in_checkout,
            has_checkin=first_checkin is not None,
            has_checkout=last_checkout is not None,
        )

        _enforce_min_interval(db, self._logs, user_id=user.id, log_type=action, now=now, min_minutes=policy.min_minutes_between_same_type)
        log = self._logs.create(db, user_id=user.id, log_type=action, confidence=confidence, timestamp=now, **geo)
        db.commit()
        db.refresh(log)
        return (user.name, confidence, log.timestamp, action)

    def _enforce_geo(self, db: Session, *, user_company_id: int, latitude: float | None, longitude: float | None) -> dict[str, object]:
        """
        If company has geo-fence configured (lat/lng + radius_meters):
        - require client location (lat/lng)
        - enforce distance <= radius
        Store latitude/longitude + computed distance in log.
        """
        if not user_company_id:
            return {"latitude": latitude, "longitude": longitude, "distance_meters": None, "geo_ok": True}

        company = db.execute(select(Company).where(Company.id == user_company_id)).scalars().first()
        if company is None:
            return {"latitude": latitude, "longitude": longitude, "distance_meters": None, "geo_ok": True}

        clat = getattr(company, "latitude", None)
        clng = getattr(company, "longitude", None)
        radius = getattr(company, "geo_radius_meters", None)
        if clat is None or clng is None or radius is None:
            return {"latitude": latitude, "longitude": longitude, "distance_meters": None, "geo_ok": True}

        if latitude is None or longitude is None:
            raise ValueError("Thiếu vị trí GPS. Vui lòng bật định vị để chấm công.")

        dist = _haversine_meters(latitude, longitude, float(clat), float(clng))
        ok_geo = dist <= float(radius)
        if not ok_geo:
            raise ValueError(f"Ngoài phạm vi chấm công (cách công ty ~{int(dist)}m, giới hạn {int(float(radius))}m)")
        return {"latitude": latitude, "longitude": longitude, "distance_meters": float(dist), "geo_ok": True}

    def list_logs_for_user(self, db: Session, *, user_id: int, limit: int = 50, offset: int = 0):
        pairs = self._logs.list_with_user_for_user(db, user_id=user_id, limit=limit, offset=offset)
        out = []
        for log, user_name in pairs:
            setattr(log, "user_name", user_name)
            out.append(log)
        return out

    def timelog_range_for_user(
        self,
        db: Session,
        *,
        user_id: int,
        from_day: date,
        to_day_inclusive: date,
    ) -> list[dict[str, object]]:
        if to_day_inclusive < from_day:
            raise ValueError("to_date must be >= from_date")

        policy = self._policy.get_or_create(db)
        overnight = _is_overnight_shift(policy.shift_start, policy.shift_end)
        start = datetime.combine(from_day, time(0, 0, 0))
        end = datetime.combine(to_day_inclusive + timedelta(days=1), time(0, 0, 0)) + (timedelta(days=1) if overnight else timedelta(days=0))

        user = self._users.get(db, user_id)
        if user is None:
            raise ValueError("User not found")

        logs = self._logs.list_in_range(db, start=start, end=end, user_id=user_id)

        per_day: dict[date, dict[str, datetime]] = {}
        for log in logs:
            d = _attendance_day_for_ts(log.timestamp, shift_start=policy.shift_start, shift_end=policy.shift_end)
            if d < from_day or d > to_day_inclusive:
                continue
            bucket = per_day.setdefault(d, {})
            if log.type == "checkin":
                prev = bucket.get("checkin")
                if prev is None or log.timestamp < prev:
                    bucket["checkin"] = log.timestamp
            else:
                prev = bucket.get("checkout")
                if prev is None or log.timestamp > prev:
                    bucket["checkout"] = log.timestamp

        base_cfg = self._policy_cfg(policy)
        cid = int(getattr(user, "company_id", 0) or 0) or None
        cfg_map = self._schedule_cfg_map(db, company_id=cid, from_day=from_day, to_day=to_day_inclusive, user_ids=[int(user.id)])

        rows: list[dict[str, object]] = []
        day_cursor = from_day
        while day_cursor <= to_day_inclusive:
            times = per_day.get(day_cursor, {})
            cin = times.get("checkin")
            cout = times.get("checkout")
            absent = cin is None
            cfg = cfg_map.get((int(user.id), day_cursor), base_cfg)
            computed = compute_attendance(day=day_cursor, checkin_time=cin, checkout_time=cout, cfg=cfg)
            late = (cin is not None) and (computed.late_minutes > 0)
            rows.append(
                {
                    "user_id": user.id,
                    "user_name": user.name,
                    "user_code": user.code,
                    "department_id": user.department_id,
                    "department_name": None,
                    "date": day_cursor.isoformat(),
                    "checkin_time": cin,
                    "checkout_time": cout,
                    "work_hours": round(computed.working_minutes / 60.0, 3),
                    "late": late,
                    "absent": absent,
                    "break_minutes": computed.break_minutes if cin is not None else 0,
                    "working_minutes": computed.working_minutes if cin is not None else 0,
                    "late_minutes": computed.late_minutes if cin is not None else 0,
                    "early_leave_minutes": computed.early_leave_minutes if cin is not None else 0,
                    "overtime_minutes": computed.overtime_minutes if cin is not None else 0,
                    "auto_checkout_applied": computed.auto_checkout_applied if cin is not None else False,
                    "method": "Face",
                }
            )
            day_cursor = day_cursor + timedelta(days=1)
        return rows

    def _match_user(self, db: Session, *, company_id: int | None = None, image_bytes: bytes, threshold: float) -> tuple[object, float]:
        # Probe embedding from ML service
        probe = self._ml.extract_embedding(image_bytes=image_bytes)

        # Build candidate list (user_id, embedding)
        candidates: list[tuple[int, list[float]]] = []
        for record in self._embeddings.list_all(db, company_id=company_id):
            candidates.append((record.user_id, embedding_from_json(record.embedding)))

        match = match_best(probe_embedding=probe, candidates=candidates, threshold=float(threshold))
        if match is None:
            raise ValueError("No matched user (below threshold)")

        user = self._users.get(db, match.user_id, company_id=company_id)
        if user is None:
            raise ValueError("Matched user not found")
        return (user, float(match.confidence))

    def list_logs(self, db: Session, *, company_id: int | None = None, limit: int = 200, offset: int = 0):
        pairs = self._logs.list_with_user(db, company_id=company_id, limit=limit, offset=offset)
        # Attach user_name dynamically (Pydantic from_attributes can read it)
        out = []
        for log, user_name in pairs:
            setattr(log, "user_name", user_name)
            out.append(log)
        return out

    def daily_report(self, db: Session, *, company_id: int | None = None, day: date) -> list[DailyComputed]:
        policy = self._policy.get_or_create(db)
        overnight = _is_overnight_shift(policy.shift_start, policy.shift_end)
        start = datetime.combine(day, time(0, 0, 0))
        end = start + (timedelta(days=2) if overnight else timedelta(days=1))
        logs = self._logs.list_in_range(db, start=start, end=end, company_id=company_id)
        users = {u.id: u.name for u in self._users.list(db, company_id=company_id, limit=10000, offset=0)}

        by_user: dict[int, dict[str, datetime]] = {}
        for log in logs:
            if _attendance_day_for_ts(log.timestamp, shift_start=policy.shift_start, shift_end=policy.shift_end) != day:
                continue
            bucket = by_user.setdefault(log.user_id, {})
            if log.type == "checkin":
                prev = bucket.get("checkin")
                if prev is None or log.timestamp < prev:
                    bucket["checkin"] = log.timestamp
            else:
                prev = bucket.get("checkout")
                if prev is None or log.timestamp > prev:
                    bucket["checkout"] = log.timestamp

        base_cfg = self._policy_cfg(policy)
        cfg_map = self._schedule_cfg_map(db, company_id=company_id, from_day=day, to_day=day, user_ids=list(users.keys()))

        rows: list[DailyComputed] = []
        for user_id, user_name in users.items():
            times = by_user.get(user_id, {})
            cin = times.get("checkin")
            cout = times.get("checkout")
            absent = cin is None
            late = False
            work_hours = 0.0
            if cin is not None:
                cfg = cfg_map.get((int(user_id), day), base_cfg)
                computed = compute_attendance(day=day, checkin_time=cin, checkout_time=cout, cfg=cfg)
                late = computed.late_minutes > 0
                work_hours = computed.working_minutes / 60.0
            rows.append(
                DailyComputed(
                    user_id=user_id,
                    user_name=user_name,
                    day=day,
                    checkin_time=cin,
                    checkout_time=cout,
                    work_hours=round(work_hours, 3),
                    late=late,
                    absent=absent,
                )
            )
        rows.sort(key=lambda r: (r.absent, r.user_name))
        return rows

    def monthly_report(self, db: Session, *, company_id: int | None = None, year: int, month: int) -> list[dict[str, object]]:
        month_start = date(year, month, 1)
        if month == 12:
            next_month = date(year + 1, 1, 1)
        else:
            next_month = date(year, month + 1, 1)
        policy = self._policy.get_or_create(db)
        overnight = _is_overnight_shift(policy.shift_start, policy.shift_end)
        start = datetime.combine(month_start, time(0, 0, 0))
        end = datetime.combine(next_month, time(0, 0, 0)) + (timedelta(days=1) if overnight else timedelta(days=0))

        logs = self._logs.list_in_range(db, start=start, end=end, company_id=company_id)
        users = {u.id: u.name for u in self._users.list(db, company_id=company_id, limit=10000, offset=0)}

        # First check-in + last check-out per user per attendance day
        per_user_day: dict[tuple[int, date], dict[str, datetime]] = {}
        for log in logs:
            d = _attendance_day_for_ts(log.timestamp, shift_start=policy.shift_start, shift_end=policy.shift_end)
            if d < month_start or d >= next_month:
                continue
            key = (log.user_id, d)
            bucket = per_user_day.setdefault(key, {})
            if log.type == "checkin":
                prev = bucket.get("checkin")
                if prev is None or log.timestamp < prev:
                    bucket["checkin"] = log.timestamp
            else:
                prev = bucket.get("checkout")
                if prev is None or log.timestamp > prev:
                    bucket["checkout"] = log.timestamp

        base_cfg = self._policy_cfg(policy)
        cfg_map = self._schedule_cfg_map(db, company_id=company_id, from_day=month_start, to_day=(next_month - timedelta(days=1)), user_ids=list(users.keys()))
        days_in_month = (next_month - month_start).days

        # Aggregate per user
        totals: dict[int, dict[str, object]] = {
            uid: {"total_work_hours": 0.0, "late_days": 0, "present_days": 0} for uid in users.keys()
        }
        for (uid, d), times in per_user_day.items():
            cin = times.get("checkin")
            cout = times.get("checkout")
            if cin is None:
                continue
            totals[uid]["present_days"] = int(totals[uid]["present_days"]) + 1
            cfg = cfg_map.get((int(uid), d), base_cfg)
            computed = compute_attendance(day=d, checkin_time=cin, checkout_time=cout, cfg=cfg)
            if computed.late_minutes > 0:
                totals[uid]["late_days"] = int(totals[uid]["late_days"]) + 1
            totals[uid]["total_work_hours"] = float(totals[uid]["total_work_hours"]) + (computed.working_minutes / 60.0)

        rows: list[dict[str, object]] = []
        for uid, name in users.items():
            present_days = int(totals[uid]["present_days"])
            absent_days = max(0, days_in_month - present_days)
            rows.append(
                {
                    "user_id": uid,
                    "user_name": name,
                    "month": f"{year:04d}-{month:02d}",
                    "total_work_hours": round(float(totals[uid]["total_work_hours"]), 3),
                    "late_days": int(totals[uid]["late_days"]),
                    "absent_days": absent_days,
                }
            )
        rows.sort(key=lambda r: (r["absent_days"], r["user_name"]))
        return rows

    def timelog_range(
        self,
        db: Session,
        *,
        company_id: int | None = None,
        from_day: date,
        to_day_inclusive: date,
        department_id: int | None = None,
        status: str | None = None,  # "on-time" | "late" | "absent"
        include_absent: bool = False,
    ) -> list[dict[str, object]]:
        if to_day_inclusive < from_day:
            raise ValueError("to_date must be >= from_date")
        start = datetime.combine(from_day, time(0, 0, 0))
        end = datetime.combine(to_day_inclusive + timedelta(days=1), time(0, 0, 0))
        policy = self._policy.get_or_create(db)
        if _is_overnight_shift(policy.shift_start, policy.shift_end):
            end = end + timedelta(days=1)

        logs = self._logs.list_in_range(db, start=start, end=end, company_id=company_id)
        users = self._users.list(db, company_id=company_id, limit=10000, offset=0)
        depts = {d.id: d for d in self._depts.list(db, company_id=company_id, limit=10000, offset=0)}

        # Optional filters (by department)
        if department_id is not None and department_id not in depts:
            # Dept not in scope -> empty result instead of cross-company leak.
            return []
        users_f = []
        for u in users:
            if department_id is not None and u.department_id != department_id:
                continue
            users_f.append(u)

        users_by_id = {u.id: u for u in users_f}

        # First check-in + last check-out per user per attendance day
        per_user_day: dict[tuple[int, date], dict[str, datetime]] = {}
        for log in logs:
            if log.user_id not in users_by_id:
                continue
            d = _attendance_day_for_ts(log.timestamp, shift_start=policy.shift_start, shift_end=policy.shift_end)
            key = (log.user_id, d)
            bucket = per_user_day.setdefault(key, {})
            if log.type == "checkin":
                prev = bucket.get("checkin")
                if prev is None or log.timestamp < prev:
                    bucket["checkin"] = log.timestamp
            else:
                prev = bucket.get("checkout")
                if prev is None or log.timestamp > prev:
                    bucket["checkout"] = log.timestamp

        base_cfg = self._policy_cfg(policy)
        cfg_map = self._schedule_cfg_map(db, company_id=company_id, from_day=from_day, to_day=to_day_inclusive, user_ids=list(users_by_id.keys()))

        def _match_status(*, late: bool, absent: bool) -> bool:
            if status is None:
                return True
            if status == "late":
                return late and (not absent)
            if status == "absent":
                return absent
            if status == "on-time":
                return (not absent) and (not late)
            return True

        rows: list[dict[str, object]] = []
        day_cursor = from_day
        while day_cursor <= to_day_inclusive:
            for uid, u in users_by_id.items():
                times = per_user_day.get((uid, day_cursor), {})
                cin = times.get("checkin")
                cout = times.get("checkout")
                if not include_absent and cin is None and cout is None:
                    continue
                absent = cin is None
                cfg = cfg_map.get((int(uid), day_cursor), base_cfg)
                computed = compute_attendance(day=day_cursor, checkin_time=cin, checkout_time=cout, cfg=cfg)
                late = (cin is not None) and (computed.late_minutes > 0)
                if not _match_status(late=late, absent=absent):
                    continue
                work_hours = computed.working_minutes / 60.0
                dept = depts.get(u.department_id) if u.department_id is not None else None
                rows.append(
                    {
                        "user_id": uid,
                        "user_name": u.name,
                        "user_code": u.code,
                        "department_id": u.department_id,
                        "department_name": dept.name if dept else None,
                        "date": day_cursor.isoformat(),
                        "checkin_time": cin,
                        "checkout_time": cout,
                        "work_hours": round(work_hours, 3),
                        "late": late,
                        "absent": absent,
                        "break_minutes": computed.break_minutes if cin is not None else 0,
                        "working_minutes": computed.working_minutes if cin is not None else 0,
                        "late_minutes": computed.late_minutes if cin is not None else 0,
                        "early_leave_minutes": computed.early_leave_minutes if cin is not None else 0,
                        "overtime_minutes": computed.overtime_minutes if cin is not None else 0,
                        "auto_checkout_applied": computed.auto_checkout_applied if cin is not None else False,
                        "method": "Face",
                    }
                )
            day_cursor = day_cursor + timedelta(days=1)
        rows.sort(key=lambda r: (r["date"], r["user_name"]))
        return rows

    def timelog_upsert_day(
        self,
        db: Session,
        *,
        company_id: int | None = None,
        user_id: int,
        day: date,
        checkin_time: datetime | None,
        checkout_time: datetime | None,
    ) -> dict[str, object]:
        user = self._users.get(db, user_id, company_id=company_id)
        if user is None:
            raise ValueError("User not found")
        start = datetime.combine(day, time(0, 0, 0))
        end = start + timedelta(days=1)

        policy = self._policy.get_or_create(db)
        overnight = _is_overnight_shift(policy.shift_start, policy.shift_end)

        # Clear existing logs in the window that maps to this attendance day.
        clear_end = end + (timedelta(days=1) if overnight else timedelta(days=0))
        self._logs.delete_in_range(db, start=start, end=clear_end, user_id=user_id)

        if checkin_time is not None:
            mapped = _attendance_day_for_ts(checkin_time, shift_start=policy.shift_start, shift_end=policy.shift_end)
            if mapped != day:
                raise ValueError("checkin_time không thuộc ngày công (theo policy) của day")
        if checkout_time is not None:
            mapped = _attendance_day_for_ts(checkout_time, shift_start=policy.shift_start, shift_end=policy.shift_end)
            if mapped != day:
                raise ValueError("checkout_time không thuộc ngày công (theo policy) của day")
        if checkin_time is not None and checkout_time is not None and checkout_time < checkin_time:
            raise ValueError("checkout_time phải >= checkin_time")

        if checkin_time is not None:
            self._logs.create(db, user_id=user_id, log_type="checkin", confidence=1.0, timestamp=checkin_time)
        if checkout_time is not None:
            self._logs.create(db, user_id=user_id, log_type="checkout", confidence=1.0, timestamp=checkout_time)
        db.commit()

        # Return computed row (include_absent so UI can see cleared state)
        dept = self._depts.get(db, user.department_id, company_id=company_id) if user.department_id is not None else None
        cin = checkin_time
        cout = checkout_time

        base_cfg = self._policy_cfg(policy)
        cfg_map = self._schedule_cfg_map(db, company_id=company_id, from_day=day, to_day=day, user_ids=[int(user.id)])
        cfg = cfg_map.get((int(user.id), day), base_cfg)

        absent = cin is None
        computed = compute_attendance(day=day, checkin_time=cin, checkout_time=cout, cfg=cfg)
        late = (cin is not None) and (computed.late_minutes > 0)
        work_hours = computed.working_minutes / 60.0

        return {
            "user_id": user.id,
            "user_name": user.name,
            "user_code": user.code,
            "department_id": user.department_id,
            "department_name": dept.name if dept else None,
            "date": day.isoformat(),
            "checkin_time": cin,
            "checkout_time": cout,
            "work_hours": round(work_hours, 3),
            "late": late,
            "absent": absent,
            "break_minutes": computed.break_minutes if cin is not None else 0,
            "working_minutes": computed.working_minutes if cin is not None else 0,
            "late_minutes": computed.late_minutes if cin is not None else 0,
            "early_leave_minutes": computed.early_leave_minutes if cin is not None else 0,
            "overtime_minutes": computed.overtime_minutes if cin is not None else 0,
            "auto_checkout_applied": computed.auto_checkout_applied if cin is not None else False,
            "method": "Manual",
        }

    def timelog_delete_day(self, db: Session, *, company_id: int | None = None, user_id: int, day: date) -> None:
        user = self._users.get(db, user_id, company_id=company_id)
        if user is None:
            raise ValueError("User not found")
        start = datetime.combine(day, time(0, 0, 0))
        end = start + timedelta(days=1)
        self._logs.delete_in_range(db, start=start, end=end, user_id=user_id)
        db.commit()

    def stats(self, db: Session, *, company_id: int | None = None, from_day: date, to_day_inclusive: date) -> dict[str, object]:
        if to_day_inclusive < from_day:
            raise ValueError("to_date must be >= from_date")
        start = datetime.combine(from_day, time(0, 0, 0))
        end = datetime.combine(to_day_inclusive + timedelta(days=1), time(0, 0, 0))
        policy = self._policy.get_or_create(db)
        if _is_overnight_shift(policy.shift_start, policy.shift_end):
            end = end + timedelta(days=1)
        logs = self._logs.list_in_range(db, start=start, end=end, company_id=company_id)
        users = self._users.list(db, company_id=company_id, limit=10000, offset=0)

        base_cfg = self._policy_cfg(policy)
        cfg_map = self._schedule_cfg_map(db, company_id=company_id, from_day=from_day, to_day=to_day_inclusive, user_ids=[int(u.id) for u in users])

        late_count = 0
        for log in logs:
            if log.type != "checkin":
                continue
            d = _attendance_day_for_ts(log.timestamp, shift_start=policy.shift_start, shift_end=policy.shift_end)
            if d < from_day or d > to_day_inclusive:
                continue
            cfg = cfg_map.get((int(log.user_id), d), base_cfg)
            shift_start = _parse_hhmm(cfg.shift_start)
            grace = timedelta(minutes=int(cfg.late_grace_minutes))
            if log.timestamp > (datetime.combine(d, shift_start) + grace):
                late_count += 1

        return {
            "from_date": from_day.isoformat(),
            "to_date": to_day_inclusive.isoformat(),
            "total_users": len(users),
            "total_checkins": sum(1 for l in logs if l.type == "checkin"),
            "total_checkouts": sum(1 for l in logs if l.type == "checkout"),
            "late_count": late_count,
        }


def _parse_hhmm(value: str) -> time:
    hh, mm = value.split(":", 1)
    return time(int(hh), int(mm))


def _enforce_time_window(now: datetime, start_hhmm: str, end_hhmm: str, *, label: str) -> None:
    start_t = _parse_hhmm(start_hhmm)
    end_t = _parse_hhmm(end_hhmm)
    now_t = now.time().replace(microsecond=0)
    # Normal window: start <= end (same day)
    if start_t <= end_t:
        if now_t < start_t or now_t > end_t:
            raise ValueError(f"Ngoài khung giờ cho phép {label} ({start_hhmm}–{end_hhmm})")
        return
    # Overnight window (wrap): allow if time >= start OR time <= end
    if not (now_t >= start_t or now_t <= end_t):
        raise ValueError(f"Ngoài khung giờ cho phép {label} ({start_hhmm}–{end_hhmm})")


def _in_time_window(now: datetime, start_hhmm: str, end_hhmm: str) -> bool:
    start_t = _parse_hhmm(start_hhmm)
    end_t = _parse_hhmm(end_hhmm)
    now_t = now.time().replace(microsecond=0)
    if start_t <= end_t:
        return not (now_t < start_t or now_t > end_t)
    return bool(now_t >= start_t or now_t <= end_t)


def _now_in_policy_tz(tz_name: str) -> datetime:
    tz = ZoneInfo(tz_name)
    return datetime.now(tz).replace(tzinfo=None)


def _is_overnight_shift(shift_start: str, shift_end: str) -> bool:
    return _parse_hhmm(shift_end) < _parse_hhmm(shift_start)


def _attendance_day_for_ts(ts: datetime, *, shift_start: str, shift_end: str) -> date:
    """
    Map a timestamp to an "attendance day" (ngày công) based on shift boundaries.
    - Non-overnight: attendance day = calendar date.
    - Overnight: early-morning times (before shift_end) belong to previous day.
    """
    if not _is_overnight_shift(shift_start, shift_end):
        return ts.date()
    end_t = _parse_hhmm(shift_end)
    if ts.time() < end_t:
        return ts.date() - timedelta(days=1)
    return ts.date()


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    from math import asin, cos, radians, sin, sqrt

    r = 6371000.0
    p1 = radians(lat1)
    p2 = radians(lat2)
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(p1) * cos(p2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    return float(r * c)


def _enforce_min_interval(
    db: Session,
    repo: AttendanceLogRepository,
    *,
    user_id: int,
    log_type: str,
    now: datetime,
    min_minutes: int,
) -> None:
    if min_minutes <= 0:
        return
    latest = repo.get_latest_of_type_for_user(db, user_id=user_id, log_type=log_type)
    if latest is None:
        return
    diff = (now - latest.timestamp).total_seconds() / 60.0
    if diff < float(min_minutes):
        raise ValueError(f"Vui lòng chờ {min_minutes} phút trước khi {log_type} lại")



def embedding_from_json(embedding_json: str) -> list[float]:
    import json

    data = json.loads(embedding_json)
    return [float(x) for x in data]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    # no numpy dependency in API service
    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b, strict=False):
        dot += x * y
        na += x * x
        nb += y * y
    denom = (na**0.5) * (nb**0.5) + 1e-12
    return dot / denom


def match_best(
    *,
    probe_embedding: list[float],
    candidates: list[tuple[int, list[float]]],
    threshold: float | None = None,
):
    from app.ml.face_engine import FaceMatch  # reuse dataclass only (no heavy deps after earlier changes)
    from app.core.settings import settings

    th = settings.FACE_MATCH_THRESHOLD if threshold is None else threshold
    best_user_id = -1
    best_sim = -1.0
    for user_id, emb in candidates:
        sim = cosine_similarity(probe_embedding, emb)
        if sim > best_sim:
            best_sim = sim
            best_user_id = user_id
    if best_sim < th:
        return None
    return FaceMatch(user_id=best_user_id, confidence=float(best_sim))

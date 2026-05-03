from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.clients.ml_client import MlClient
from app.repositories.attendance_logs import AttendanceLogRepository
from app.repositories.attendance_policy import AttendancePolicyRepository
from app.repositories.departments import DepartmentRepository
from app.repositories.face_embeddings import FaceEmbeddingRepository
from app.repositories.users import UserRepository


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

    def checkin(self, db: Session, *, image_bytes: bytes) -> tuple[str, float, object]:
        policy = self._policy.get_or_create(db)
        now = _now_in_policy_tz(policy.timezone)
        _enforce_time_window(now, policy.checkin_from, policy.checkin_to, label="check-in")

        # Probe embedding from ML service
        probe = self._ml.extract_embedding(image_bytes=image_bytes)

        # Build candidate list (user_id, embedding)
        candidates: list[tuple[int, list[float]]] = []
        for record in self._embeddings.list_all(db):
            candidates.append((record.user_id, embedding_from_json(record.embedding)))

        match = match_best(probe_embedding=probe, candidates=candidates, threshold=float(policy.face_match_threshold))
        if match is None:
            raise ValueError("No matched user (below threshold)")

        user = self._users.get(db, match.user_id)
        if user is None:
            raise ValueError("Matched user not found")

        _enforce_min_interval(db, self._logs, user_id=user.id, log_type="checkin", now=now, min_minutes=policy.min_minutes_between_same_type)
        log = self._logs.create(db, user_id=user.id, log_type="checkin", confidence=match.confidence, timestamp=now)
        db.commit()
        db.refresh(log)
        return (user.name, match.confidence, log.timestamp)

    def checkout(self, db: Session, *, image_bytes: bytes) -> tuple[str, float, object]:
        policy = self._policy.get_or_create(db)
        now = _now_in_policy_tz(policy.timezone)
        _enforce_time_window(now, policy.checkout_from, policy.checkout_to, label="check-out")

        probe = self._ml.extract_embedding(image_bytes=image_bytes)

        candidates: list[tuple[int, list[float]]] = []
        for record in self._embeddings.list_all(db):
            candidates.append((record.user_id, embedding_from_json(record.embedding)))

        match = match_best(probe_embedding=probe, candidates=candidates, threshold=float(policy.face_match_threshold))
        if match is None:
            raise ValueError("No matched user (below threshold)")

        user = self._users.get(db, match.user_id)
        if user is None:
            raise ValueError("Matched user not found")

        _enforce_min_interval(
            db,
            self._logs,
            user_id=user.id,
            log_type="checkout",
            now=now,
            min_minutes=policy.min_minutes_between_same_type,
        )
        log = self._logs.create(db, user_id=user.id, log_type="checkout", confidence=match.confidence, timestamp=now)
        db.commit()
        db.refresh(log)
        return (user.name, match.confidence, log.timestamp)

    def list_logs(self, db: Session, *, limit: int = 200, offset: int = 0):
        pairs = self._logs.list_with_user(db, limit=limit, offset=offset)
        # Attach user_name dynamically (Pydantic from_attributes can read it)
        out = []
        for log, user_name in pairs:
            setattr(log, "user_name", user_name)
            out.append(log)
        return out

    def daily_report(self, db: Session, *, day: date) -> list[DailyComputed]:
        policy = self._policy.get_or_create(db)
        overnight = _is_overnight_shift(policy.shift_start, policy.shift_end)
        start = datetime.combine(day, time(0, 0, 0))
        end = start + (timedelta(days=2) if overnight else timedelta(days=1))
        logs = self._logs.list_in_range(db, start=start, end=end)
        users = {u.id: u.name for u in self._users.list(db, limit=10000, offset=0)}

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

        shift_start = _parse_hhmm(policy.shift_start)
        late_cutoff = datetime.combine(day, shift_start) + timedelta(minutes=int(policy.late_grace_minutes))

        rows: list[DailyComputed] = []
        for user_id, user_name in users.items():
            times = by_user.get(user_id, {})
            cin = times.get("checkin")
            cout = times.get("checkout")
            absent = cin is None
            late = (cin is not None) and (cin > late_cutoff)
            work_hours = 0.0
            if cin is not None and cout is not None and cout > cin:
                work_hours = (cout - cin).total_seconds() / 3600.0
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

    def monthly_report(self, db: Session, *, year: int, month: int) -> list[dict[str, object]]:
        month_start = date(year, month, 1)
        if month == 12:
            next_month = date(year + 1, 1, 1)
        else:
            next_month = date(year, month + 1, 1)
        policy = self._policy.get_or_create(db)
        overnight = _is_overnight_shift(policy.shift_start, policy.shift_end)
        start = datetime.combine(month_start, time(0, 0, 0))
        end = datetime.combine(next_month, time(0, 0, 0)) + (timedelta(days=1) if overnight else timedelta(days=0))

        logs = self._logs.list_in_range(db, start=start, end=end)
        users = {u.id: u.name for u in self._users.list(db, limit=10000, offset=0)}

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

        shift_start = _parse_hhmm(policy.shift_start)
        grace = timedelta(minutes=int(policy.late_grace_minutes))
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
            late_cutoff = datetime.combine(d, shift_start) + grace
            if cin > late_cutoff:
                totals[uid]["late_days"] = int(totals[uid]["late_days"]) + 1
            if cout is not None and cout > cin:
                totals[uid]["total_work_hours"] = float(totals[uid]["total_work_hours"]) + (
                    (cout - cin).total_seconds() / 3600.0
                )

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

        logs = self._logs.list_in_range(db, start=start, end=end)
        users = self._users.list(db, limit=10000, offset=0)
        depts = {d.id: d for d in self._depts.list(db, limit=10000, offset=0)}

        # Optional filters (by department)
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

        shift_start = _parse_hhmm(policy.shift_start)
        grace = timedelta(minutes=int(policy.late_grace_minutes))

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
                late_cutoff = datetime.combine(day_cursor, shift_start) + grace
                late = (cin is not None) and (cin > late_cutoff)
                if not _match_status(late=late, absent=absent):
                    continue
                work_hours = 0.0
                if cin is not None and cout is not None and cout > cin:
                    work_hours = (cout - cin).total_seconds() / 3600.0
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
        user_id: int,
        day: date,
        checkin_time: datetime | None,
        checkout_time: datetime | None,
    ) -> dict[str, object]:
        user = self._users.get(db, user_id)
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
        dept = self._depts.get(db, user.department_id) if user.department_id is not None else None
        cin = checkin_time
        cout = checkout_time

        shift_start = _parse_hhmm(policy.shift_start)
        grace = timedelta(minutes=int(policy.late_grace_minutes))
        late_cutoff = datetime.combine(day, shift_start) + grace
        absent = cin is None
        late = (cin is not None) and (cin > late_cutoff)
        work_hours = 0.0
        if cin is not None and cout is not None and cout > cin:
            work_hours = (cout - cin).total_seconds() / 3600.0

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
            "method": "Manual",
        }

    def timelog_delete_day(self, db: Session, *, user_id: int, day: date) -> None:
        user = self._users.get(db, user_id)
        if user is None:
            raise ValueError("User not found")
        start = datetime.combine(day, time(0, 0, 0))
        end = start + timedelta(days=1)
        self._logs.delete_in_range(db, start=start, end=end, user_id=user_id)
        db.commit()

    def stats(self, db: Session, *, from_day: date, to_day_inclusive: date) -> dict[str, object]:
        if to_day_inclusive < from_day:
            raise ValueError("to_date must be >= from_date")
        start = datetime.combine(from_day, time(0, 0, 0))
        end = datetime.combine(to_day_inclusive + timedelta(days=1), time(0, 0, 0))
        policy = self._policy.get_or_create(db)
        if _is_overnight_shift(policy.shift_start, policy.shift_end):
            end = end + timedelta(days=1)
        logs = self._logs.list_in_range(db, start=start, end=end)
        users = self._users.list(db, limit=10000, offset=0)

        shift_start = _parse_hhmm(policy.shift_start)
        grace = timedelta(minutes=int(policy.late_grace_minutes))

        late_count = 0
        for log in logs:
            if log.type != "checkin":
                continue
            d = _attendance_day_for_ts(log.timestamp, shift_start=policy.shift_start, shift_end=policy.shift_end)
            if d < from_day or d > to_day_inclusive:
                continue
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

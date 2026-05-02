from __future__ import annotations

from sqlalchemy.orm import Session

from app.clients.ml_client import MlClient
from app.repositories.attendance_logs import AttendanceLogRepository
from app.repositories.face_embeddings import FaceEmbeddingRepository
from app.repositories.users import UserRepository


class AttendanceService:
    def __init__(self) -> None:
        self._logs = AttendanceLogRepository()
        self._embeddings = FaceEmbeddingRepository()
        self._users = UserRepository()
        self._ml = MlClient()

    def checkin(self, db: Session, *, image_bytes: bytes) -> tuple[str, float, object]:
        # Probe embedding from ML service
        probe = self._ml.extract_embedding(image_bytes=image_bytes)

        # Build candidate list (user_id, embedding)
        candidates: list[tuple[int, list[float]]] = []
        for record in self._embeddings.list_all(db):
            candidates.append((record.user_id, embedding_from_json(record.embedding)))

        match = match_best(probe_embedding=probe, candidates=candidates)
        if match is None:
            raise ValueError("No matched user (below threshold)")

        user = self._users.get(db, match.user_id)
        if user is None:
            raise ValueError("Matched user not found")

        log = self._logs.create(db, user_id=user.id, log_type="checkin", confidence=match.confidence)
        db.commit()
        db.refresh(log)
        return (user.name, match.confidence, log.timestamp)

    def list_logs(self, db: Session, *, limit: int = 200, offset: int = 0):
        return self._logs.list(db, limit=limit, offset=offset)


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

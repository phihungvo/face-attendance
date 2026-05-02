from __future__ import annotations

from sqlalchemy import Engine, text


def _column_exists(engine: Engine, *, table: str, column: str, schema: str) -> bool:
    q = text(
        """
        SELECT COUNT(*) AS c
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = :schema AND TABLE_NAME = :table AND COLUMN_NAME = :column
        """
    )
    with engine.connect() as conn:
        c = conn.execute(q, {"schema": schema, "table": table, "column": column}).scalar_one()
        return int(c or 0) > 0


def _exec(engine: Engine, sql: str) -> None:
    with engine.begin() as conn:
        conn.execute(text(sql))


def run_lightweight_migrations(engine: Engine, *, schema: str) -> None:
    """
    Minimal, non-Alembic migrations for local/dev:
    - Add missing columns for business fields (users, departments)
    This is best-effort: safe to run multiple times.
    """

    # users table extensions (if project was created before these fields existed)
    if not _column_exists(engine, table="users", column="code", schema=schema):
        _exec(engine, "ALTER TABLE users ADD COLUMN code VARCHAR(32) NULL, ADD UNIQUE KEY uq_users_code (code)")
    if not _column_exists(engine, table="users", column="email", schema=schema):
        _exec(engine, "ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL, ADD UNIQUE KEY uq_users_email (email)")
    if not _column_exists(engine, table="users", column="role", schema=schema):
        _exec(engine, "ALTER TABLE users ADD COLUMN role VARCHAR(64) NULL")
    if not _column_exists(engine, table="users", column="status", schema=schema):
        _exec(engine, "ALTER TABLE users ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'active'")
    if not _column_exists(engine, table="users", column="department_id", schema=schema):
        _exec(engine, "ALTER TABLE users ADD COLUMN department_id INT NULL, ADD KEY ix_users_department_id (department_id)")


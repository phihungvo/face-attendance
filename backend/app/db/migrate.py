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


def _table_exists(engine: Engine, *, table: str, schema: str) -> bool:
    q = text(
        """
        SELECT COUNT(*) AS c
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = :schema AND TABLE_NAME = :table
        """
    )
    with engine.connect() as conn:
        c = conn.execute(q, {"schema": schema, "table": table}).scalar_one()
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
    if not _column_exists(engine, table="users", column="username", schema=schema):
        _exec(engine, "ALTER TABLE users ADD COLUMN username VARCHAR(64) NULL, ADD UNIQUE KEY uq_users_username (username), ADD KEY ix_users_username (username)")
    if not _column_exists(engine, table="users", column="password_hash", schema=schema):
        _exec(engine, "ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL")
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

    # IAM join tables (new): user_roles, user_permissions
    if not _table_exists(engine, table="user_roles", schema=schema):
        _exec(
            engine,
            """
            CREATE TABLE user_roles (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT NOT NULL,
              role_id INT NOT NULL,
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE KEY uq_user_roles (user_id, role_id),
              KEY ix_user_roles_user_id (user_id),
              KEY ix_user_roles_role_id (role_id),
              CONSTRAINT fk_user_roles_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              CONSTRAINT fk_user_roles_role_id FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
            )
            """,
        )
    if not _table_exists(engine, table="user_permissions", schema=schema):
        _exec(
            engine,
            """
            CREATE TABLE user_permissions (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT NOT NULL,
              permission_id INT NOT NULL,
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE KEY uq_user_permissions (user_id, permission_id),
              KEY ix_user_permissions_user_id (user_id),
              KEY ix_user_permissions_permission_id (permission_id),
              CONSTRAINT fk_user_permissions_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              CONSTRAINT fk_user_permissions_permission_id FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            )
            """,
        )

    # Best-effort data migration from legacy IAM tables (accounts/account_roles/account_permissions).
    if _table_exists(engine, table="accounts", schema=schema):
        try:
            # 1) Move account rows into users (by username).
            _exec(
                engine,
                """
                INSERT IGNORE INTO users (username, password_hash, name)
                SELECT a.username, a.password_hash, a.username
                FROM accounts a
                """,
            )
            # 2) Move role assignments by username mapping.
            if _table_exists(engine, table="account_roles", schema=schema):
                _exec(
                    engine,
                    """
                    INSERT IGNORE INTO user_roles (user_id, role_id)
                    SELECT u.id, ar.role_id
                    FROM account_roles ar
                    JOIN accounts a ON a.id = ar.account_id
                    JOIN users u ON u.username = a.username
                    """,
                )
            # 3) Move direct permission assignments by username mapping.
            if _table_exists(engine, table="account_permissions", schema=schema):
                _exec(
                    engine,
                    """
                    INSERT IGNORE INTO user_permissions (user_id, permission_id)
                    SELECT u.id, ap.permission_id
                    FROM account_permissions ap
                    JOIN accounts a ON a.id = ap.account_id
                    JOIN users u ON u.username = a.username
                    """,
                )
        except Exception:
            # Migration is best-effort; ignore any failures due to partial schema differences.
            pass

    # attendance_policies table extensions
    if not _column_exists(engine, table="attendance_policies", column="timezone", schema=schema):
        _exec(engine, "ALTER TABLE attendance_policies ADD COLUMN timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh'")
    if not _column_exists(engine, table="attendance_policies", column="face_match_threshold", schema=schema):
        _exec(engine, "ALTER TABLE attendance_policies ADD COLUMN face_match_threshold DOUBLE NOT NULL DEFAULT 0.5")
    if not _column_exists(engine, table="attendance_policies", column="shift_end", schema=schema):
        _exec(engine, "ALTER TABLE attendance_policies ADD COLUMN shift_end VARCHAR(5) NOT NULL DEFAULT '18:00'")
    if not _column_exists(engine, table="attendance_policies", column="early_leave_grace_minutes", schema=schema):
        _exec(engine, "ALTER TABLE attendance_policies ADD COLUMN early_leave_grace_minutes INT NOT NULL DEFAULT 0")

    # leave_requests table (added later)
    # Keep migration best-effort: if table does not exist, skip.
    try:
        if not _column_exists(engine, table="leave_requests", column="status", schema=schema):
            # table exists but missing some column; do nothing special now
            pass
    except Exception:
        pass

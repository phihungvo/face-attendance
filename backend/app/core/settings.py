from __future__ import annotations

from urllib.parse import urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Face Attendance"
    ENV: str = "production"

    # MySQL
    MYSQL_HOST: str = "mysql"
    MYSQL_PORT: int = 3306
    MYSQL_USER: str = "app"
    MYSQL_PASSWORD: str = "app_password"
    MYSQL_DB: str = "face_attendance"
    DB_STARTUP_RETRIES: int = 30
    DB_STARTUP_RETRY_SLEEP_SECONDS: float = 2.0
    DB_STARTUP_FAIL_FAST: bool = False

    # ML
    FACE_MATCH_THRESHOLD: float = 0.5

    # Attendance rules
    SHIFT_START: str = "09:00"  # HH:MM
    SHIFT_END: str = "18:00"  # HH:MM
    LATE_GRACE_MINUTES: int = 0
    EARLY_LEAVE_GRACE_MINUTES: int = 0
    ATTENDANCE_TIMEZONE: str = "Asia/Ho_Chi_Minh"

    # JWT Auth
    JWT_SECRET: str = "change_me"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    JWT_SECRET_MIN_LENGTH: int = 32

    # Security / CORS
    CORS_ALLOW_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8081,http://127.0.0.1:8081"
    AUTH_PUBLIC_REGISTRATION_ENABLED: bool = False
    LOGIN_MAX_FAILURES: int = 5
    LOGIN_WINDOW_SECONDS: int = 300
    LOGIN_BLOCK_SECONDS: int = 900
    AUTH_WRITE_MAX_ATTEMPTS: int = 10
    AUTH_WRITE_WINDOW_SECONDS: int = 600
    AUTH_WRITE_BLOCK_SECONDS: int = 900
    FACE_UPLOAD_MAX_BYTES: int = 5 * 1024 * 1024
    FACE_UPLOAD_MAX_REQUESTS: int = 30
    FACE_UPLOAD_WINDOW_SECONDS: int = 60
    FACE_UPLOAD_BLOCK_SECONDS: int = 120
    LOGO_UPLOAD_MAX_REQUESTS: int = 10
    LOGO_UPLOAD_WINDOW_SECONDS: int = 300
    LOGO_UPLOAD_BLOCK_SECONDS: int = 300

    # Attendance evidence storage / queue
    ATTENDANCE_EVIDENCE_SPOOL_DIR: str = "/tmp/attendance-evidence-spool"
    ATTENDANCE_EVIDENCE_MAX_RETRIES: int = 3
    ATTENDANCE_EVIDENCE_BACKOFF_BASE_SECONDS: int = 30
    ATTENDANCE_EVIDENCE_WORKER_POLL_SECONDS: float = 2.0
    ATTENDANCE_EVIDENCE_CLEANUP_INTERVAL_SECONDS: int = 86400
    ATTENDANCE_EVIDENCE_PRESIGNED_EXPIRE_SECONDS: int = 600
    ATTENDANCE_EVIDENCE_DEFAULT_ENABLED: bool = True
    ATTENDANCE_EVIDENCE_DEFAULT_QUALITY: int = 65
    ATTENDANCE_EVIDENCE_DEFAULT_MAX_WIDTH: int = 720
    ATTENDANCE_EVIDENCE_DEFAULT_FORMAT: str = "webp"
    ATTENDANCE_EVIDENCE_DEFAULT_RETENTION_DAYS: int = 30

    # MinIO / S3-compatible object storage
    MINIO_ENDPOINT: str = "http://minio:9000"
    MINIO_PUBLIC_ENDPOINT: str = "http://localhost:9010"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_REGION: str = "us-east-1"
    MINIO_BUCKET_ATTENDANCE: str = "attendance"
    MINIO_SECURE: bool = False

    # Frontend URL (used for invite activation links)
    FRONTEND_BASE_URL: str = "http://localhost:3000"

    # Invite / activation
    INVITE_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 3  # 3 days

    # SMTP (invite emails)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "Face Attendance <no-reply@example.com>"
    SMTP_USE_STARTTLS: bool = True

    # ML Service (internal)
    ML_SERVICE_URL: str = "http://ml:8001"
    ML_SERVICE_TIMEOUT_SECONDS: float = 15.0

    # Bootstrap admin (created on first start if missing)
    BOOTSTRAP_ADMIN_USERNAME: str = "admin"
    BOOTSTRAP_ADMIN_PASSWORD: str = "admin123"
    BOOTSTRAP_ADMIN_COMPANY_CODE: str = "default"
    BOOTSTRAP_ADMIN_COMPANY_NAME: str = "Default Company"

    # Bootstrap test accounts (created on first start if missing)
    BOOTSTRAP_TEST_USERS_ENABLED: bool = False
    BOOTSTRAP_MANAGER_USERNAME: str = "manager"
    BOOTSTRAP_MANAGER_PASSWORD: str = "manager123"
    BOOTSTRAP_EMPLOYEE_USERNAME: str = "employee"
    BOOTSTRAP_EMPLOYEE_PASSWORD: str = "employee123"

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        # Sync engine (simple and robust for starters).
        return (
            f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DB}"
            "?charset=utf8mb4"
        )

    @property
    def cors_allow_origins_list(self) -> list[str]:
        origins = [x.strip() for x in self.CORS_ALLOW_ORIGINS.split(",") if x.strip()]
        frontend = self.FRONTEND_BASE_URL.strip()
        if frontend:
            parsed = urlparse(frontend)
            if parsed.scheme and parsed.netloc:
                origin = f"{parsed.scheme}://{parsed.netloc}"
                if origin not in origins:
                    origins.append(origin)
        return origins

    @property
    def is_production_like(self) -> bool:
        return self.ENV.strip().lower() not in {"dev", "development", "test", "testing", "local"}


settings = Settings()

from __future__ import annotations

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

    # ML Service (internal)
    ML_SERVICE_URL: str = "http://ml:8001"
    ML_SERVICE_TIMEOUT_SECONDS: float = 15.0

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        # Sync engine (simple and robust for starters).
        return (
            f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DB}"
            "?charset=utf8mb4"
        )


settings = Settings()

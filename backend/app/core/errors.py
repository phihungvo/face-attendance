from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ErrorCode:
    """
    Convention giống ez_tro: code + message + http_status.
    - code: mã lỗi nội bộ (1000 = OK)
    - message: thông báo tiếng Việt cho client
    """

    code: int
    message: str
    http_status: int


OK = ErrorCode(code=1000, message="Thành công", http_status=200)

UNCATEGORIZED_EXCEPTION = ErrorCode(code=9999, message="Lỗi hệ thống, vui lòng thử lại sau", http_status=500)
VALIDATION_FAILED = ErrorCode(code=1001, message="Dữ liệu không hợp lệ", http_status=400)
UNAUTHORIZED = ErrorCode(code=1002, message="Bạn chưa đăng nhập hoặc token không hợp lệ", http_status=401)
FORBIDDEN = ErrorCode(code=1003, message="Bạn không có quyền truy cập", http_status=403)
NOT_FOUND = ErrorCode(code=1004, message="Không tìm thấy dữ liệu", http_status=404)
TOO_MANY_REQUESTS = ErrorCode(code=1005, message="Bạn thao tác quá nhanh, vui lòng thử lại sau", http_status=429)

BAD_REQUEST = ErrorCode(code=1100, message="Yêu cầu không hợp lệ", http_status=400)
DB_ERROR = ErrorCode(code=1200, message="Lỗi cơ sở dữ liệu", http_status=500)

AUTH_USERNAME_TAKEN = ErrorCode(code=2001, message="Tên đăng nhập đã tồn tại", http_status=400)
AUTH_INVALID_CREDENTIALS = ErrorCode(code=2002, message="Tên đăng nhập hoặc mật khẩu không đúng", http_status=401)
AUTH_ACCOUNT_PENDING = ErrorCode(code=2003, message="Tài khoản chưa được kích hoạt", http_status=403)
AUTH_INVITE_INVALID = ErrorCode(code=2004, message="Link kích hoạt không hợp lệ", http_status=400)
AUTH_INVITE_EXPIRED = ErrorCode(code=2005, message="Link kích hoạt đã hết hạn", http_status=400)
AUTH_IDENTIFIER_AMBIGUOUS = ErrorCode(
    code=2006,
    message="Email này tồn tại ở nhiều công ty. Vui lòng đăng nhập bằng username hoặc mã nhân viên.",
    http_status=400,
)
AUTH_ACCOUNT_DISABLED = ErrorCode(code=2007, message="Tài khoản đã bị vô hiệu hóa", http_status=403)
AUTH_PUBLIC_REGISTRATION_DISABLED = ErrorCode(code=2008, message="Tính năng tự đăng ký đang bị tắt", http_status=403)

ML_NOT_READY = ErrorCode(
    code=3001,
    message="Chức năng nhận diện khuôn mặt chưa sẵn sàng trên server",
    http_status=503,
)

ML_INVALID_INPUT = ErrorCode(
    code=3002,
    message="Ảnh khuôn mặt không hợp lệ hoặc không phát hiện khuôn mặt",
    http_status=400,
)


class AppException(Exception):
    def __init__(self, error: ErrorCode, *, detail: str | None = None, headers: dict[str, str] | None = None) -> None:
        super().__init__(detail or error.message)
        self.error = error
        self.detail = detail
        self.headers = headers or {}

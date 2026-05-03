from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.core.settings import settings


class EmailClient:
    def send_invite_email(self, *, to_email: str, invite_link: str) -> None:
        if not settings.SMTP_HOST:
            raise ValueError("SMTP chưa được cấu hình (SMTP_HOST)")

        msg = EmailMessage()
        msg["Subject"] = "Kích hoạt tài khoản Face Attendance"
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to_email
        text = "\n".join(
            [
                "Bạn được mời kích hoạt tài khoản để đăng nhập hệ thống Face Attendance.",
                "",
                f"Link kích hoạt: {invite_link}",
                "",
                "Nếu bạn không yêu cầu email này, vui lòng bỏ qua.",
            ]
        )
        msg.set_content(text)
        msg.add_alternative(self._render_invite_html(invite_link=invite_link), subtype="html")

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as smtp:
            smtp.ehlo()
            if settings.SMTP_USE_STARTTLS:
                smtp.starttls()
                smtp.ehlo()
            if settings.SMTP_USER:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)

    def _render_invite_html(self, *, invite_link: str) -> str:
        # Keep it self-contained with inline CSS for broad email client support.
        safe_link = invite_link.replace('"', "%22")
        return f"""\
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kích hoạt tài khoản</title>
  </head>
  <body style="margin:0;background:#0b1220;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <div style="padding:32px 12px;">
      <div style="max-width:560px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,.22);border-radius:16px;overflow:hidden;">
        <div style="padding:18px 20px;background:linear-gradient(135deg, rgba(16,185,129,.22), rgba(59,130,246,.18));border-bottom:1px solid rgba(148,163,184,.18);">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;font-weight:900;color:#e2e8f0;">FT</div>
            <div>
              <div style="font-size:16px;font-weight:900;color:#e2e8f0;line-height:1.2;">Face Attendance</div>
              <div style="font-size:12px;color:rgba(226,232,240,.78);line-height:1.2;">Kích hoạt tài khoản đăng nhập</div>
            </div>
          </div>
        </div>
        <div style="padding:22px 20px;color:#e2e8f0;">
          <div style="font-size:18px;font-weight:900;margin:0 0 8px;">Hoàn tất kích hoạt</div>
          <div style="font-size:13px;line-height:1.55;color:rgba(226,232,240,.82);margin:0 0 16px;">
            Bạn được mời kích hoạt tài khoản để đăng nhập hệ thống. Nhấn nút bên dưới để tạo mật khẩu.
          </div>
          <div style="margin:18px 0;">
            <a href="{safe_link}" style="display:inline-block;background:#22c55e;color:#052e16;text-decoration:none;font-weight:900;padding:12px 16px;border-radius:12px;">
              Kích hoạt tài khoản
            </a>
          </div>
          <div style="font-size:12px;line-height:1.55;color:rgba(226,232,240,.72);margin-top:14px;">
            Nếu nút không bấm được, copy link này vào trình duyệt:
            <div style="margin-top:8px;word-break:break-all;background:rgba(2,6,23,.55);border:1px solid rgba(148,163,184,.18);padding:10px 12px;border-radius:12px;color:rgba(226,232,240,.9);">
              {safe_link}
            </div>
          </div>
        </div>
        <div style="padding:14px 20px;border-top:1px solid rgba(148,163,184,.18);font-size:12px;color:rgba(226,232,240,.55);line-height:1.45;">
          Nếu bạn không yêu cầu email này, vui lòng bỏ qua.
        </div>
      </div>
    </div>
  </body>
</html>
"""

# CI/CD deploy lên VPS (Docker Compose + GHCR)

Workflow: `.github/workflows/deploy-vps.yml`.

## 1) Chuẩn bị VPS (1 lần)

- Cài Docker + Docker Compose v2.
- Tạo thư mục app, ví dụ: `/opt/face-attendance`.
- Tạo file `.env` trên VPS (copy từ `.env.sample` rồi chỉnh):
  - `JWT_SECRET` bắt buộc đổi.
  - `MYSQL_*` nếu muốn đổi user/pass/db.

Ví dụ:
```bash
sudo mkdir -p /opt/face-attendance
sudo chown -R $USER:$USER /opt/face-attendance
cd /opt/face-attendance
cp .env.sample .env
vi .env
```

## 2) Tạo GHCR token (để VPS pull image)

Tạo Personal Access Token (PAT) có quyền đọc packages:
- `read:packages`

## 3) Thêm GitHub Actions secrets

Vào repo → Settings → Secrets and variables → Actions → New repository secret:

- `VPS_HOST`: IP/host VPS
- `VPS_USER`: user SSH (vd `root` hoặc `ubuntu`)
- `VPS_PORT`: port SSH (vd `22`)
- `VPS_SSH_KEY`: private key (PEM) để SSH vào VPS
- `VPS_APP_DIR`: thư mục trên VPS (vd `/opt/face-attendance`)
- `GHCR_USER`: username GitHub (owner)
- `GHCR_TOKEN`: PAT dùng cho VPS `docker login`
- `FRONTEND_PORT` (optional): port public (mặc định `80`)

## 4) Deploy

Push lên branch `main` hoặc chạy thủ công `workflow_dispatch`.

Sau khi chạy xong, trên VPS:
```bash
cd /opt/face-attendance
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=200
```

## HTTPS (tuỳ chọn)

Hiện compose expose `frontend` ra port 80 (HTTP). **Lưu ý:** tính năng camera (`getUserMedia`) trên Chrome/Edge
chỉ hoạt động ở **secure context** (HTTPS hoặc `localhost`). Vì vậy nếu deploy VPS mà truy cập bằng `http://...`
thì sẽ gặp lỗi kiểu “Trình duyệt không hỗ trợ camera (getUserMedia)” hoặc “Camera bị chặn do trang chưa chạy ở secure context”.

Nếu muốn domain + TLS, nên đặt Nginx/Caddy/Traefik phía trước hoặc mở rộng compose thêm reverse-proxy.

### Ví dụ nhanh với Caddy (khuyến nghị vì cấu hình gọn)

1) Trỏ domain về VPS.
2) Mở firewall port `80/443`.
3) Chạy Caddy trên VPS (host-level) hoặc chạy Caddy bằng Docker.

Ví dụ Caddyfile:
```caddyfile
your-domain.com {
  encode zstd gzip

  # Frontend (Vite build) đang listen ở port 80 trong container.
  reverse_proxy 127.0.0.1:8080

  # Nếu bạn muốn gọi backend trực tiếp từ browser (không qua nginx của frontend),
  # có thể thêm route /api -> backend:
  # handle_path /api/* {
  #   reverse_proxy 127.0.0.1:8000
  # }
}
```

Gợi ý mapping port khi chạy container frontend:
- Đổi `FRONTEND_PORT=8080` (thay vì 80) và để Caddy nghe `:443` ngoài host.

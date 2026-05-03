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

Hiện compose expose `frontend` ra port 80. Nếu muốn domain + TLS, nên đặt Nginx/Caddy/Traefik phía trước,
hoặc mở rộng compose thêm reverse-proxy. Nếu bạn cho mình domain + lựa chọn proxy, mình cấu hình tiếp.


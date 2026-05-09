# Face Attendance (InsightFace + FastAPI + React + MySQL)

Chạy production cơ bản bằng Docker Compose.  

## Yêu cầu
- Docker + Docker Compose 

## Chạy nhanh
```bash
cd face-attendance
docker compose up --build
```
 
## Dev mode (hot reload)
Chạy 1 lần và tự reload khi sửa code (frontend Vite HMR + backend uvicorn `--reload`):
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build backend mysql ml frontend_dev
```

## URL
- Backend: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- Frontend: `http://localhost:3000`
- phpMyAdmin (optional): `http://localhost:8080`
- ML service (internal): `http://localhost:8001`

## API chính (bắt buộc)
- `POST /api/v1/auth/register` (json: `username`, `password`)
- `POST /api/v1/auth/login` (json: `username`, `password`)
- `POST /api/v1/users/enroll` (multipart: `name`, `image`) *(cần JWT)*
- `POST /api/v1/users` (json: `code?`, `name`, `email?`, `role?`, `status?`, `department_id?`) *(cần JWT)*
- `PUT /api/v1/users/{id}` (json: như trên) *(cần JWT)*
- `DELETE /api/v1/users/{id}` *(cần JWT)*
- `GET /api/v1/departments` *(cần JWT)*
- `POST /api/v1/departments` (json: `code`, `name`, `location?`) *(cần JWT)*
- `PUT /api/v1/departments/{id}` (json: như trên) *(cần JWT)*
- `DELETE /api/v1/departments/{id}` *(cần JWT)*
- `POST /api/v1/attendance/checkin` (multipart: `image`) *(cần JWT)*
- `GET /api/v1/attendance/logs` *(cần JWT)*

## API Response chuẩn
Backend trả format thống nhất kiểu ez_tro:
`{ "code": 1000, "message": "Thành công", "result": ... }`

## Notes
- Best practice production: tách `backend` (API/JWT/DB) và `ml_service` (InsightFace inference). `backend` gọi `ml_service` qua internal network.
- Lần chạy đầu, ML service sẽ tải model `buffalo_l` (đã cache ở volume `insightface_cache`).
- Backend hiện dùng `Base.metadata.create_all()` để tạo bảng. Với production nghiêm túc, nên dùng Alembic migrations.
- Dev/local: backend có chạy migration nhẹ để tự add cột mới cho bảng `users` khi nâng cấp (file `backend/app/db/migrate.py`). Nếu DB đã có dữ liệu trùng `code/email` thì có thể fail vì unique constraint → nên dọn/chuẩn hóa dữ liệu hoặc recreate DB.
- Nếu chạy local không dùng Docker (hoặc Python của máy không phù hợp với `onnxruntime`), có thể cài tối thiểu bằng `backend/requirements.lite.txt` để test các endpoint không cần ML (ví dụ dashboard: `GET /api/v1/users`, `GET /api/v1/attendance/logs`).
- Khi chạy `frontend` local bằng Vite, set `VITE_BACKEND_URL=http://127.0.0.1:8000` để proxy `/api` về backend local (mặc định proxy tới `http://backend:8000` cho môi trường Docker).

## Share link frontend (Cloudflare Tunnel, không cần deploy)
Mục tiêu: người khác ở nơi khác mở 1 link public và dùng được UI, trong khi app vẫn chạy trên máy bạn.

1) Chạy backend (chọn 1):
- Docker dev: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build backend mysql ml`
- Hoặc backend local ở `http://localhost:8000`

2) Chạy frontend dev (Vite) và trỏ API về backend local:
```bash
cd frontend
VITE_BACKEND_URL=http://127.0.0.1:8000 npm run dev
```

3) Mở public link bằng Cloudflare Tunnel (chọn 1):
- Cách A (npm script): `cd frontend && npm run tunnel`
- Cách B (shell script): `./scripts/cloudflare-tunnel-frontend.sh 3000`

Cloudflared sẽ in ra 1 URL dạng `https://...trycloudflare.com` (hoặc domain Cloudflare khác). Gửi URL đó cho người khác truy cập.

Ghi chú:
- Nếu bạn dùng email “activate account”, set `FRONTEND_BASE_URL=<URL tunnel>` cho backend để link trong email trỏ đúng.
- Tunnel link dạng “quick” thường là tạm thời; muốn URL cố định thì tạo “Named Tunnel” + gắn domain trong Cloudflare.

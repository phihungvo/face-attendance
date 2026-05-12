# Phần mềm chấm công khuôn mặt (Face Attendance) – InsightFace + FastAPI + React + MySQL (Docker)

## Mô tả ngắn
Website **chấm công bằng khuôn mặt** chạy full-stack (React + FastAPI + MySQL) kèm **dịch vụ AI nhận diện khuôn mặt InsightFace** tách riêng, triển khai nhanh bằng Docker. Phù hợp cho doanh nghiệp/nhà máy/văn phòng cần **chấm công nhân viên online**, quản lý nhân sự cơ bản, phân quyền và xuất báo cáo.

## Cam kết hỗ trợ
- Hỗ trợ **cài đặt & chạy demo** (Docker Compose) đến khi lên được màn hình login và chấm công thành công.
- Hỗ trợ **setup domain/SSL + reverse proxy** (nếu bạn có VPS) theo nhu cầu.
- Hỗ trợ **tùy biến giao diện/màu sắc/logo** và thêm trường dữ liệu nhân viên cơ bản.
- Bàn giao **toàn bộ source code** + hướng dẫn vận hành + cấu hình môi trường.

## Từ khóa (tối đa 6)
- chấm công khuôn mặt
- chấm công bằng khuôn mặt
- phần mềm chấm công nhân viên
- hệ thống chấm công online
- nhận diện khuôn mặt InsightFace
- Face Attendance

## MÔ TẢ CHI TIẾT
### 1) Tổng quan kiến trúc
- **Frontend:** React (Vite) – giao diện quản trị + cổng nhân viên.
- **Backend:** FastAPI – API chuẩn hóa response, JWT Auth, RBAC (roles/permissions), CRUD dữ liệu.
- **Database:** MySQL 8 – lưu nhân viên, phòng ban, log chấm công, nghỉ phép, cấu hình.
- **ML Service:** InsightFace (model `buffalo_l`) – suy luận nhận diện khuôn mặt, tách khỏi backend để dễ scale.
- **Triển khai:** Docker Compose – chạy nhanh production cơ bản, có profile phpMyAdmin.

### 2) Các chức năng nổi bật (đầy đủ luồng sử dụng)
#### Chấm công bằng khuôn mặt (AI)
- **Đăng ký gương mặt (enroll)** cho từng nhân viên từ camera hoặc ảnh.
- **Quét chấm công 1 chạm**: tự quyết định **check-in / check-out** theo logic hệ thống.
- Lưu **log chấm công** (thời gian, loại checkin/checkout, độ tin cậy).
- **Self-service cho nhân viên**: chấm công “đúng người” theo tài khoản đăng nhập (portal).

#### Quản lý nhân sự cơ bản
- Thêm/sửa/xóa nhân viên (mã NV, họ tên, email, phòng ban, vai trò, trạng thái hoạt động).
- Tìm kiếm nhanh, lọc theo phòng ban, hiển thị lưới/danh sách.
- Quản lý phòng ban (tạo/sửa/xóa, mã phòng ban, tên, vị trí).

#### Nhật ký giờ công & báo cáo
- Xem **timelog theo khoảng ngày**, lọc theo phòng ban, trạng thái (**đúng giờ/đi trễ/vắng**).
- **Chỉnh sửa timelog** theo ngày (upsert/delete) cho trường hợp cần đối soát.
- **Xuất CSV** phục vụ tổng hợp lương/báo cáo.
- API báo cáo: **daily report**, **monthly report**, **attendance stats**.

#### Nghỉ phép (Leave)
- Nhân viên tạo đơn nghỉ phép (self-service), xem danh sách theo trạng thái.
- Admin/HR: xem danh sách theo bộ lọc, **duyệt / từ chối**, xem chi tiết, xóa.
- Theo dõi **leave balance** theo năm.

#### Phân quyền (RBAC) – sẵn để mở rộng doanh nghiệp
- Có sẵn **roles/permissions** và cơ chế `require_permission(...)` bảo vệ endpoint.
- Có module IAM để quản lý:
  - danh sách permissions
  - vai trò (roles) + gán quyền
  - tài khoản đăng nhập + gán roles/permissions

#### Cấu hình hệ thống
- Có endpoint cấu hình **Attendance Policy** (ví dụ: quy định đi trễ/giờ làm… – dễ mở rộng theo nghiệp vụ).

### 3) Điểm mạnh khi bán/triển khai cho khách hàng
- **Tách ML service**: backend không “kẹt” vì inference, dễ scale theo tải camera.
- **Docker hóa toàn bộ**: chạy demo/production nhanh, đồng nhất môi trường.
- **API rõ ràng + Swagger**: dễ tích hợp app mobile, máy chấm công, hoặc hệ thống HRM/ERP.
- **Dễ tùy biến**: UI React, backend FastAPI, DB MySQL phổ biến.

## HƯỚNG DẪN CÀI ĐẶT
### Yêu cầu
- Cài **Docker** và **Docker Compose**.

### Chạy production cơ bản (khuyến nghị)
```bash
cd face-attendance
cp .env.sample .env
docker compose up --build
```

### Dev mode (hot reload)
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build backend mysql ml frontend_dev
```

### URL sau khi chạy
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- ML service (internal/port): `http://localhost:8001`
- phpMyAdmin (optional): `http://localhost:8080` (chạy thêm profile tools)

### Gợi ý quy trình vận hành nhanh
1. Tạo tài khoản quản trị (register/login, chọn `role=manager`).
2. Tạo phòng ban.
3. Tạo nhân viên.
4. Mở màn hình nhân viên → **đăng ký gương mặt**.
5. Vào màn hình **Chấm công** → bật camera → quét → xem log + timelog.

## [KHUYÊN DÙNG] Mẹo SEO để lên Top Google
- Nên chèn các cụm từ đúng insight tìm kiếm như:
  - **“phần mềm chấm công khuôn mặt”**
  - **“chấm công bằng khuôn mặt”**
  - **“hệ thống chấm công online cho doanh nghiệp”**
  - **“nhận diện khuôn mặt InsightFace”**
- Vị trí chèn hiệu quả:
  - **Tiêu đề** (H1) + 1–2 lần trong **Mô tả ngắn**
  - Danh sách **Từ khóa** (tối đa 6)
  - 2–4 lần rải trong **Mô tả chi tiết** (tập trung vào tính năng chấm công, quản lý nhân viên, báo cáo)
- Từ ngữ chuyển đổi (conversion) nên có: “demo”, “triển khai nhanh”, “Docker”, “bàn giao source”, “hỗ trợ cài đặt”.

## GỢI Ý TOP TỪ KHÓA GOOGLE (tham khảo)
- phần mềm chấm công khuôn mặt
- chấm công bằng khuôn mặt cho công ty
- hệ thống chấm công online
- giải pháp chấm công nhân viên
- nhận diện khuôn mặt AI chấm công
- face attendance insightface
- phần mềm chấm công nội bộ (on-premise)
- web chấm công nhân viên bằng camera

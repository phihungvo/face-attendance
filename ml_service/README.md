# ML Service (InsightFace Inference)

Service nội bộ để trích xuất embedding khuôn mặt từ ảnh.

## Endpoint
- `POST /v1/embedding` (multipart: `image`) -> `{ code, message, result: { embedding: number[] } }`
- `GET /health` -> OK

Service này chỉ nên được gọi từ backend API (internal network).


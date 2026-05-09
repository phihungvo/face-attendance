#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-3000}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared chưa được cài. Cài nhanh (macOS): brew install cloudflared" >&2
  exit 1
fi

if command -v curl >/dev/null 2>&1; then
  if ! curl -fsS "http://127.0.0.1:${PORT}/" | grep -q "/@vite/client"; then
    echo "Cảnh báo: http://127.0.0.1:${PORT} không giống Vite dev (không thấy /@vite/client)." >&2
    echo "Bạn có thể đang chạy container frontend (serve dist) nên sửa code không đổi." >&2
    echo "Gợi ý: dừng docker frontend đang chiếm port ${PORT}, rồi chạy: cd frontend && npm run dev" >&2
  fi
fi

echo "Starting Cloudflare Tunnel to local frontend: http://127.0.0.1:${PORT}"
echo "Nhấn Ctrl+C để dừng tunnel."
cloudflared tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate
